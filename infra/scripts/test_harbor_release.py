#!/usr/bin/env python3
"""Behavior tests for immutable publication reuse and marker convergence."""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


MODULE_PATH = Path(__file__).with_name("harbor_release.py")
SPEC = importlib.util.spec_from_file_location("fest_compass_harbor_release", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
RELEASE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = RELEASE
SPEC.loader.exec_module(RELEASE)


SHA = "a" * 40
D0 = "sha256:" + "0" * 63 + "1"
D1 = "sha256:" + "0" * 63 + "2"
D2 = "sha256:" + "0" * 63 + "3"
PLATFORM = "sha256:" + "1" * 64
ATTESTATION = "sha256:" + "2" * 64
CONFIG = "sha256:" + "3" * 64


def encoded(document: dict[str, object]) -> bytes:
    return json.dumps(document, separators=(",", ":")).encode()


class FakeRegistry:
    def __init__(self) -> None:
        self.tags: dict[str, str] = {}
        self.manifests: dict[str, object] = {}
        self.blobs: dict[str, bytes] = {}
        self.copies: list[tuple[str, str]] = []
        self.fail_after_put_marker: str | None = None

    def head(self, reference: str) -> str | None:
        return self.tags.get(reference)

    def get_manifest(
        self,
        reference: str,
        *,
        expected_digest: str | None = None,
        accept: str = RELEASE.ACCEPT_ALL,
    ) -> object:
        del accept
        digest = self.tags.get(reference, reference)
        if expected_digest is not None and digest != expected_digest:
            raise RELEASE.ReleaseError("fake manifest digest mismatch")
        try:
            return self.manifests[digest]
        except KeyError as exc:
            raise RELEASE.ReleaseError("fake manifest missing") from exc

    def get_blob(self, digest: str) -> bytes:
        try:
            return self.blobs[digest]
        except KeyError as exc:
            raise RELEASE.ReleaseError("fake blob missing") from exc

    def copy_digest_to_marker(self, digest: str, marker: str) -> None:
        self.copies.append((digest, marker))
        self.tags[marker] = digest
        if self.fail_after_put_marker == marker:
            self.fail_after_put_marker = None
            raise RELEASE.ReleaseError("injected final marker readback failure")


class PublicationResumeTests(unittest.TestCase):
    def test_put_success_then_final_failure_reuses_d1_without_rebuild(self) -> None:
        registry = FakeRegistry()
        registry.tags["deploy-current"] = D0
        release = RELEASE.HarborRelease(registry)
        build_count = 0

        first = release.resolve(SHA)
        self.assertEqual(first.mode, "build")
        build_count += 1
        registry.tags[SHA] = D1

        registry.fail_after_put_marker = "deploy-current"
        with self.assertRaisesRegex(RELEASE.ReleaseError, "injected final"):
            release.promote(D1, D0)
        self.assertEqual(registry.tags["deploy-rollback"], D0)
        self.assertEqual(registry.tags["deploy-current"], D1)

        retry = release.resolve(SHA)
        if retry.mode == "build":
            build_count += 1
            registry.tags[SHA] = D2
        self.assertEqual(retry, RELEASE.Resolution(mode="reuse", digest=D1))
        self.assertEqual(build_count, 1)

        converged = release.promote(retry.digest, D0)
        self.assertEqual(converged.mode, "already-promoted")
        self.assertEqual(converged.current, D1)
        self.assertEqual(converged.rollback, D0)
        self.assertEqual(
            registry.copies,
            [(D0, "deploy-rollback"), (D1, "deploy-current")],
        )

    def test_first_promotion_creates_current_only_and_is_idempotent(self) -> None:
        registry = FakeRegistry()
        release = RELEASE.HarborRelease(registry)

        first = release.promote(D1, RELEASE.SENTINEL_DIGEST)
        self.assertEqual(first, RELEASE.Promotion(D1, "none", "initial"))
        self.assertNotIn("deploy-rollback", registry.tags)

        retry = release.promote(D1, RELEASE.SENTINEL_DIGEST)
        self.assertEqual(retry, RELEASE.Promotion(D1, "none", "already-promoted"))
        self.assertEqual(registry.copies, [(D1, "deploy-current")])

    def test_existing_commit_tag_is_reused_and_never_copied(self) -> None:
        registry = FakeRegistry()
        registry.tags[SHA] = D1
        resolution = RELEASE.HarborRelease(registry).resolve(SHA)
        self.assertEqual(resolution, RELEASE.Resolution(mode="reuse", digest=D1))
        self.assertEqual(registry.copies, [])


class RemoteVerificationTests(unittest.TestCase):
    def registry_with_valid_image(self) -> FakeRegistry:
        registry = FakeRegistry()
        registry.tags[SHA] = D1
        registry.manifests[D1] = RELEASE.Manifest(
            digest=D1,
            media_type="application/vnd.oci.image.index.v1+json",
            body=encoded(
                {
                    "mediaType": "application/vnd.oci.image.index.v1+json",
                    "manifests": [
                        {
                            "digest": PLATFORM,
                            "platform": {"os": "linux", "architecture": "amd64"},
                        },
                        {
                            "digest": ATTESTATION,
                            "platform": {"os": "unknown", "architecture": "unknown"},
                            "annotations": {
                                "vnd.docker.reference.type": "attestation-manifest"
                            },
                        },
                    ],
                }
            ),
        )
        registry.manifests[ATTESTATION] = RELEASE.Manifest(
            digest=ATTESTATION,
            media_type="application/vnd.oci.image.manifest.v1+json",
            body=encoded(
                {
                    "layers": [
                        {
                            "mediaType": "application/vnd.in-toto+json",
                            "annotations": {
                                "in-toto.io/predicate-type": RELEASE.SPDX_PREDICATE
                            },
                        }
                    ]
                }
            ),
        )
        registry.manifests[PLATFORM] = RELEASE.Manifest(
            digest=PLATFORM,
            media_type="application/vnd.oci.image.manifest.v1+json",
            body=encoded({"config": {"digest": CONFIG}}),
        )
        registry.blobs[CONFIG] = encoded(
            {
                "config": {
                    "Labels": {
                        "org.opencontainers.image.revision": SHA,
                        "org.opencontainers.image.source": RELEASE.EXPECTED_SOURCE,
                    }
                }
            }
        )
        return registry

    def test_exact_remote_index_sbom_platform_and_labels_are_accepted(self) -> None:
        release = RELEASE.HarborRelease(self.registry_with_valid_image())
        self.assertEqual(release.verify(SHA, D1), D1)

    def test_wrong_source_label_is_rejected(self) -> None:
        registry = self.registry_with_valid_image()
        registry.blobs[CONFIG] = encoded(
            {
                "config": {
                    "Labels": {
                        "org.opencontainers.image.revision": SHA,
                        "org.opencontainers.image.source": "https://example.invalid/repo",
                    }
                }
            }
        )
        with self.assertRaisesRegex(RELEASE.ReleaseError, "source label"):
            RELEASE.HarborRelease(registry).verify(SHA, D1)

    def test_missing_spdx_attestation_is_rejected(self) -> None:
        registry = self.registry_with_valid_image()
        registry.manifests[ATTESTATION] = RELEASE.Manifest(
            digest=ATTESTATION,
            media_type="application/vnd.oci.image.manifest.v1+json",
            body=encoded({"layers": []}),
        )
        with self.assertRaisesRegex(RELEASE.ReleaseError, "SPDX SBOM"):
            RELEASE.HarborRelease(registry).verify(SHA, D1)


class CurlBoundaryTests(unittest.TestCase):
    def client_with_response(
        self, status: int, headers: list[tuple[str, str]]
    ) -> tuple[object, list[list[str]], tempfile.TemporaryDirectory[str]]:
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        auth = root / "netrc"
        auth.write_text("machine registry.invalid login robot password hidden\n")
        auth.chmod(0o600)
        calls: list[list[str]] = []

        def runner(
            command: list[str], *, capture_output: bool, text: bool
        ) -> subprocess.CompletedProcess[str]:
            self.assertTrue(capture_output)
            self.assertTrue(text)
            calls.append(command)
            self.assertEqual(command[1], "--disable")
            header_path = Path(command[command.index("--dump-header") + 1])
            body_path = Path(command[command.index("--output") + 1])
            lines = [f"HTTP/1.1 {status} Test", *(f"{k}: {v}" for k, v in headers)]
            header_path.write_bytes(("\r\n".join(lines) + "\r\n\r\n").encode())
            body_path.write_bytes(b"")
            return subprocess.CompletedProcess(
                command, 0, stdout=str(status), stderr=""
            )

        if os.name == "nt":
            # Windows chmod does not expose POSIX group/other mode bits. The
            # ARC release runner is Linux, where the production check remains
            # exercised; these local tests focus on the curl boundary.
            with mock.patch.object(RELEASE.CurlRegistry, "_validate_paths"):
                client = RELEASE.CurlRegistry(auth, temp_root=root, runner=runner)
        else:
            client = RELEASE.CurlRegistry(auth, temp_root=root, runner=runner)
        return client, calls, temporary

    def test_every_credentialed_curl_starts_with_disable(self) -> None:
        client, calls, temporary = self.client_with_response(404, [])
        self.addCleanup(temporary.cleanup)
        self.assertIsNone(client.head(SHA))
        self.assertEqual(len(calls), 1)
        self.assertIn("--netrc-file", calls[0])

    def test_non_200_or_404_head_fails_closed(self) -> None:
        client, _, temporary = self.client_with_response(500, [])
        self.addCleanup(temporary.cleanup)
        with self.assertRaisesRegex(RELEASE.ReleaseError, "unexpected Harbor status 500"):
            client.head(SHA)

    def test_duplicate_digest_headers_are_ambiguous(self) -> None:
        client, _, temporary = self.client_with_response(
            200,
            [("Docker-Content-Digest", D1), ("Docker-Content-Digest", D2)],
        )
        self.addCleanup(temporary.cleanup)
        with self.assertRaisesRegex(RELEASE.ReleaseError, "exactly one"):
            client.head(SHA)


class LocalContractTests(unittest.TestCase):
    def test_release_constants_are_fest_compass_scoped(self) -> None:
        self.assertEqual(RELEASE.REPOSITORY_PATH, "fest-compass/web")
        self.assertEqual(
            RELEASE.IMAGE_REPOSITORY,
            "registry.damecasol.com/fest-compass/web",
        )
        self.assertEqual(
            RELEASE.EXPECTED_SOURCE,
            "https://github.com/gitvssh/fest-compass",
        )

    def test_prod_overlay_pins_exactly_one_immutable_digest(self) -> None:
        # Before the first release this is the zero sentinel; afterwards it is
        # the deployed digest, which promotion reads as the rollback candidate.
        # Either way the overlay must carry exactly one immutable digest.
        self.assertRegex(
            RELEASE.overlay_digest(RELEASE.PROD_OVERLAY), r"^sha256:[0-9a-f]{64}$"
        )


if __name__ == "__main__":
    unittest.main()

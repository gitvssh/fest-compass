#!/usr/bin/env python3
"""Fail-closed Harbor publication and deploy-marker gate for FEST Compass.

The immutable commit tag is resolved before BuildKit runs. An existing tag is
never overwritten: it is reused only after the remote OCI index, SBOM
attestation, linux/amd64 manifest, and source labels all verify. Marker
promotion is bound to the digest currently checked into the prod overlay and
is retry-safe across a successful PUT followed by an inconclusive readback.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
from typing import Callable, Mapping, Protocol, Sequence
from urllib.parse import quote


REGISTRY = "https://registry.damecasol.com"
REPOSITORY_PATH = "fest-compass/web"
IMAGE_REPOSITORY = "registry.damecasol.com/fest-compass/web"
EXPECTED_SOURCE = "https://github.com/gitvssh/fest-compass"
PROD_OVERLAY = (
    Path(__file__).resolve().parents[1]
    / "k8s/fest-compass/overlays/prod/kustomization.yaml"
)
SENTINEL_DIGEST = "sha256:" + "0" * 64
DIGEST_RE = re.compile(r"sha256:[0-9a-f]{64}")
SHA_RE = re.compile(r"[0-9a-f]{40}")
OVERLAY_DIGEST_RE = re.compile(
    r"^[ \t]+digest:[ \t]+(sha256:[0-9a-f]{64})[ \t]*$", re.MULTILINE
)
REFERENCE_RE = re.compile(r"(?:[A-Za-z0-9_][A-Za-z0-9._-]{0,127}|sha256:[0-9a-f]{64})")
INDEX_MEDIA_TYPES = frozenset(
    {
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
    }
)
MANIFEST_MEDIA_TYPES = frozenset(
    {
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.v2+json",
    }
)
ALL_MANIFEST_MEDIA_TYPES = INDEX_MEDIA_TYPES | MANIFEST_MEDIA_TYPES
ACCEPT_ALL = ", ".join(
    (
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.v2+json",
    )
)
ACCEPT_MANIFEST = ", ".join(sorted(MANIFEST_MEDIA_TYPES))
SPDX_PREDICATE = "https://spdx.dev/Document"


class ReleaseError(RuntimeError):
    """A release precondition or remote postcondition did not hold."""


@dataclass(frozen=True)
class HeaderBlock:
    status: int
    values: Mapping[str, tuple[str, ...]]

    def exactly_one(self, name: str) -> str:
        found = self.values.get(name.lower(), ())
        if len(found) != 1:
            raise ReleaseError(
                f"remote response must contain exactly one {name} header"
            )
        return found[0]


@dataclass(frozen=True)
class Response:
    status: int
    headers: HeaderBlock
    body: bytes


@dataclass(frozen=True)
class Manifest:
    digest: str
    media_type: str
    body: bytes


@dataclass(frozen=True)
class Resolution:
    mode: str
    digest: str


@dataclass(frozen=True)
class Promotion:
    current: str
    rollback: str
    mode: str


class Registry(Protocol):
    def head(self, reference: str) -> str | None: ...

    def get_manifest(
        self,
        reference: str,
        *,
        expected_digest: str | None = None,
        accept: str = ACCEPT_ALL,
    ) -> Manifest: ...

    def get_blob(self, digest: str) -> bytes: ...

    def copy_digest_to_marker(self, digest: str, marker: str) -> None: ...


Runner = Callable[..., subprocess.CompletedProcess[str]]


def _run_process(
    command: Sequence[str], *, capture_output: bool, text: bool
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=capture_output, text=text, check=False)


class CurlRegistry:
    """Fixed-repository Distribution API client using only a protected netrc."""

    def __init__(
        self,
        auth_file: Path,
        *,
        temp_root: Path,
        curl: str = "curl",
        runner: Runner = _run_process,
    ) -> None:
        self.auth_file = auth_file.resolve()
        self.temp_root = temp_root.resolve()
        self.curl = curl
        self.runner = runner
        self._validate_paths()

    def _validate_paths(self) -> None:
        try:
            auth_stat = self.auth_file.stat()
            temp_stat = self.temp_root.stat()
        except OSError as exc:
            raise ReleaseError(f"release custody path is unavailable: {exc}") from exc
        if not stat.S_ISREG(auth_stat.st_mode):
            raise ReleaseError("Harbor netrc must be a regular file")
        if stat.S_IMODE(auth_stat.st_mode) & 0o077:
            raise ReleaseError("Harbor netrc must not be accessible by group or others")
        if not stat.S_ISDIR(temp_stat.st_mode):
            raise ReleaseError("RUNNER_TEMP must be a directory")

    @staticmethod
    def _reference(reference: str) -> str:
        if REFERENCE_RE.fullmatch(reference) is None:
            raise ReleaseError("refusing malformed Harbor manifest reference")
        return quote(reference, safe=":")

    @staticmethod
    def _parse_headers(raw: bytes) -> HeaderBlock:
        normalized = raw.decode("iso-8859-1").replace("\r\n", "\n")
        blocks = [part for part in re.split(r"\n\n+", normalized) if part.strip()]
        parsed: list[HeaderBlock] = []
        for block in blocks:
            lines = block.splitlines()
            if not lines or re.fullmatch(r"HTTP/\S+ [0-9]{3}.*", lines[0]) is None:
                continue
            status = int(lines[0].split()[1])
            values: dict[str, list[str]] = {}
            for line in lines[1:]:
                name, separator, value = line.partition(":")
                if not separator:
                    raise ReleaseError("Harbor returned a malformed HTTP header")
                values.setdefault(name.lower(), []).append(value.strip())
            parsed.append(
                HeaderBlock(
                    status=status,
                    values={key: tuple(items) for key, items in values.items()},
                )
            )
        if not parsed:
            raise ReleaseError("Harbor returned no parseable HTTP response headers")
        return parsed[-1]

    def _request(
        self,
        method: str,
        path: str,
        *,
        accept: str | None = None,
        content_type: str | None = None,
        data: bytes | None = None,
    ) -> Response:
        with tempfile.TemporaryDirectory(
            prefix="fest-compass-harbor-release-", dir=self.temp_root
        ) as directory:
            request_dir = Path(directory)
            headers_path = request_dir / "headers"
            body_path = request_dir / "body"
            command = [
                self.curl,
                "--disable",
                "--silent",
                "--show-error",
                "--netrc-file",
                str(self.auth_file),
            ]
            if method == "HEAD":
                command.append("--head")
            elif method != "GET":
                command.extend(("--request", method))
            if accept is not None:
                command.extend(("--header", f"Accept: {accept}"))
            if content_type is not None:
                command.extend(("--header", f"Content-Type: {content_type}"))
            if data is not None:
                request_path = request_dir / "request-body"
                request_path.write_bytes(data)
                request_path.chmod(0o600)
                command.extend(("--data-binary", f"@{request_path}"))
            command.extend(
                (
                    "--dump-header",
                    str(headers_path),
                    "--output",
                    str(body_path),
                    "--write-out",
                    "%{http_code}",
                    f"{REGISTRY}{path}",
                )
            )
            result = self.runner(command, capture_output=True, text=True)
            if result.returncode != 0:
                raise ReleaseError(
                    f"credentialed Harbor request failed before HTTP status ({method})"
                )
            status_text = result.stdout.strip()
            if re.fullmatch(r"[0-9]{3}", status_text) is None:
                raise ReleaseError("curl returned an ambiguous Harbor HTTP status")
            status = int(status_text)
            try:
                header_block = self._parse_headers(headers_path.read_bytes())
                body = body_path.read_bytes()
            except OSError as exc:
                raise ReleaseError("curl did not produce complete response files") from exc
            if header_block.status != status:
                raise ReleaseError("Harbor status and final response headers disagree")
            return Response(status=status, headers=header_block, body=body)

    def head(self, reference: str) -> str | None:
        encoded = self._reference(reference)
        response = self._request(
            "HEAD",
            f"/v2/{REPOSITORY_PATH}/manifests/{encoded}",
            accept=ACCEPT_ALL,
        )
        digest_headers = response.headers.values.get("docker-content-digest", ())
        if response.status == 404:
            if digest_headers:
                raise ReleaseError("missing Harbor reference returned a digest header")
            return None
        if response.status != 200:
            raise ReleaseError(
                f"unexpected Harbor status {response.status} while resolving reference"
            )
        digest = response.headers.exactly_one("Docker-Content-Digest")
        require_digest(digest)
        return digest

    def get_manifest(
        self,
        reference: str,
        *,
        expected_digest: str | None = None,
        accept: str = ACCEPT_ALL,
    ) -> Manifest:
        encoded = self._reference(reference)
        response = self._request(
            "GET",
            f"/v2/{REPOSITORY_PATH}/manifests/{encoded}",
            accept=accept,
        )
        if response.status != 200:
            raise ReleaseError(
                f"unexpected Harbor status {response.status} while reading manifest"
            )
        digest = response.headers.exactly_one("Docker-Content-Digest")
        require_digest(digest)
        if expected_digest is not None and digest != expected_digest:
            raise ReleaseError("remote manifest digest does not match the expected digest")
        media_type = response.headers.exactly_one("Content-Type").split(";", 1)[0]
        if media_type not in ALL_MANIFEST_MEDIA_TYPES:
            raise ReleaseError("remote manifest has an unsupported media type")
        if not response.body:
            raise ReleaseError("remote manifest body is empty")
        actual_digest = "sha256:" + hashlib.sha256(response.body).hexdigest()
        if actual_digest != digest:
            raise ReleaseError("remote manifest body does not match its digest header")
        return Manifest(digest=digest, media_type=media_type, body=response.body)

    def get_blob(self, digest: str) -> bytes:
        require_digest(digest)
        response = self._request(
            "GET", f"/v2/{REPOSITORY_PATH}/blobs/{quote(digest, safe=':')}"
        )
        if response.status != 200:
            raise ReleaseError(
                f"unexpected Harbor status {response.status} while reading config blob"
            )
        actual = "sha256:" + hashlib.sha256(response.body).hexdigest()
        if actual != digest:
            raise ReleaseError("remote config blob does not match its descriptor digest")
        return response.body

    def copy_digest_to_marker(self, digest: str, marker: str) -> None:
        require_digest(digest)
        if marker not in {"deploy-current", "deploy-rollback"}:
            raise ReleaseError("refusing an unapproved Harbor marker")
        source = self.get_manifest(digest, expected_digest=digest)
        response = self._request(
            "PUT",
            f"/v2/{REPOSITORY_PATH}/manifests/{marker}",
            content_type=source.media_type,
            data=source.body,
        )
        if response.status != 201:
            raise ReleaseError(
                f"unexpected Harbor status {response.status} while moving marker"
            )
        promoted = response.headers.exactly_one("Docker-Content-Digest")
        if promoted != digest:
            raise ReleaseError("Harbor PUT returned a different manifest digest")
        if self.head(marker) != digest:
            raise ReleaseError("Harbor marker readback did not match its requested digest")


class HarborRelease:
    def __init__(self, registry: Registry) -> None:
        self.registry = registry

    def resolve(self, sha: str) -> Resolution:
        require_sha(sha)
        digest = self.registry.head(sha)
        if digest is None:
            return Resolution(mode="build", digest="")
        return Resolution(mode="reuse", digest=digest)

    def verify(self, sha: str, expected_digest: str) -> str:
        require_sha(sha)
        require_digest(expected_digest)
        if self.registry.head(sha) != expected_digest:
            raise ReleaseError("immutable commit tag does not match the selected digest")

        index = self.registry.get_manifest(
            sha, expected_digest=expected_digest, accept=ACCEPT_ALL
        )
        if index.media_type not in INDEX_MEDIA_TYPES:
            raise ReleaseError("immutable commit tag must identify an OCI image index")
        index_document = json_object(index.body, "OCI image index")
        if index_document.get("mediaType") != index.media_type:
            raise ReleaseError("OCI index body and Content-Type disagree")
        descriptors = index_document.get("manifests")
        if not isinstance(descriptors, list):
            raise ReleaseError("OCI image index has no manifest descriptor list")

        attestations: list[dict[str, object]] = []
        images: list[dict[str, object]] = []
        for item in descriptors:
            if not isinstance(item, dict):
                raise ReleaseError("OCI image index contains a malformed descriptor")
            descriptor_digest = item.get("digest")
            if not isinstance(descriptor_digest, str):
                raise ReleaseError("OCI descriptor has no digest")
            require_digest(descriptor_digest)
            annotations = item.get("annotations")
            if isinstance(annotations, dict) and annotations.get(
                "vnd.docker.reference.type"
            ) == "attestation-manifest":
                attestations.append(item)
                continue
            platform = item.get("platform")
            if (
                isinstance(platform, dict)
                and platform.get("os") == "linux"
                and platform.get("architecture") == "amd64"
            ):
                images.append(item)

        if len(images) != 1:
            raise ReleaseError(
                "OCI image index must contain exactly one linux/amd64 image"
            )
        if not attestations:
            raise ReleaseError("OCI image index has no attestation manifest")
        if not any(self._is_spdx_attestation(item) for item in attestations):
            raise ReleaseError("OCI image index has no remotely verified SPDX SBOM")

        platform_digest = str(images[0]["digest"])
        platform_manifest = self.registry.get_manifest(
            platform_digest,
            expected_digest=platform_digest,
            accept=ACCEPT_MANIFEST,
        )
        if platform_manifest.media_type not in MANIFEST_MEDIA_TYPES:
            raise ReleaseError("linux/amd64 descriptor is not an image manifest")
        platform_document = json_object(platform_manifest.body, "platform manifest")
        config = platform_document.get("config")
        if not isinstance(config, dict) or not isinstance(config.get("digest"), str):
            raise ReleaseError("linux/amd64 manifest has no config descriptor")
        config_digest = str(config["digest"])
        require_digest(config_digest)
        config_document = json_object(
            self.registry.get_blob(config_digest), "image config"
        )
        config_section = config_document.get("config")
        labels = config_section.get("Labels") if isinstance(config_section, dict) else None
        if not isinstance(labels, dict):
            raise ReleaseError("linux/amd64 image config has no labels")
        if labels.get("org.opencontainers.image.revision") != sha:
            raise ReleaseError("image revision label does not match the trusted commit")
        if labels.get("org.opencontainers.image.source") != EXPECTED_SOURCE:
            raise ReleaseError("image source label does not match the trusted repository")
        return expected_digest

    def _is_spdx_attestation(self, descriptor: Mapping[str, object]) -> bool:
        digest = str(descriptor["digest"])
        manifest = self.registry.get_manifest(
            digest, expected_digest=digest, accept=ACCEPT_MANIFEST
        )
        if manifest.media_type not in MANIFEST_MEDIA_TYPES:
            return False
        document = json_object(manifest.body, "attestation manifest")
        layers = document.get("layers")
        if not isinstance(layers, list):
            return False
        for layer in layers:
            if not isinstance(layer, dict):
                continue
            annotations = layer.get("annotations")
            if (
                layer.get("mediaType") == "application/vnd.in-toto+json"
                and isinstance(annotations, dict)
                and annotations.get("in-toto.io/predicate-type") == SPDX_PREDICATE
            ):
                return True
        return False

    def promote(self, new_digest: str, previous_digest: str) -> Promotion:
        require_digest(new_digest)
        require_digest(previous_digest)
        current_before = self.registry.head("deploy-current")
        rollback_before = self.registry.head("deploy-rollback")

        if previous_digest == SENTINEL_DIGEST:
            if rollback_before is not None:
                raise ReleaseError("first promotion cannot adopt a rollback marker")
            if current_before is None:
                self.registry.copy_digest_to_marker(new_digest, "deploy-current")
                mode = "initial"
            elif current_before == new_digest:
                mode = "already-promoted"
            else:
                raise ReleaseError("first promotion found an ambiguous current marker")
            current_after = self.registry.head("deploy-current")
            rollback_after = self.registry.head("deploy-rollback")
            if current_after != new_digest or rollback_after is not None:
                raise ReleaseError("first promotion postimage is incomplete")
            return Promotion(current=new_digest, rollback="none", mode=mode)

        if previous_digest == new_digest:
            if current_before != new_digest or rollback_before == new_digest:
                raise ReleaseError("already-current marker state is inconsistent")
            return Promotion(
                current=new_digest,
                rollback=rollback_before or "none",
                mode="already-current",
            )

        if current_before == new_digest:
            if rollback_before != previous_digest:
                raise ReleaseError("partial promotion does not match the exact postimage")
            return Promotion(
                current=new_digest,
                rollback=previous_digest,
                mode="already-promoted",
            )

        if current_before != previous_digest:
            raise ReleaseError("Harbor current does not match the checked-in desired digest")
        self.registry.copy_digest_to_marker(previous_digest, "deploy-rollback")
        self.registry.copy_digest_to_marker(new_digest, "deploy-current")
        current_after = self.registry.head("deploy-current")
        rollback_after = self.registry.head("deploy-rollback")
        if current_after != new_digest or rollback_after != previous_digest:
            raise ReleaseError("rotated marker postimage is incomplete")
        if current_after == rollback_after:
            raise ReleaseError("current and rollback must identify distinct artifacts")
        return Promotion(
            current=current_after,
            rollback=rollback_after,
            mode="rotated",
        )


def require_digest(value: str) -> None:
    if DIGEST_RE.fullmatch(value) is None:
        raise ReleaseError("expected a lowercase sha256 digest")


def require_sha(value: str) -> None:
    if SHA_RE.fullmatch(value) is None:
        raise ReleaseError("expected a full lowercase Git commit SHA")


def json_object(raw: bytes, description: str) -> dict[str, object]:
    try:
        document = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ReleaseError(f"remote {description} is not valid JSON") from exc
    if not isinstance(document, dict):
        raise ReleaseError(f"remote {description} must be a JSON object")
    return document


def overlay_digest(path: Path) -> str:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ReleaseError(f"prod overlay is unavailable: {exc}") from exc
    found = OVERLAY_DIGEST_RE.findall(text)
    if len(found) != 1:
        raise ReleaseError("prod overlay must contain exactly one immutable image digest")
    require_digest(found[0])
    return found[0]


def append_outputs(path: Path, values: Mapping[str, str]) -> None:
    for key, value in values.items():
        if re.fullmatch(r"[a-z][a-z0-9_]*", key) is None or "\n" in value:
            raise ReleaseError("refusing malformed GitHub output")
    try:
        with path.open("a", encoding="utf-8") as handle:
            for key, value in values.items():
                handle.write(f"{key}={value}\n")
    except OSError as exc:
        raise ReleaseError(f"GitHub output file is unavailable: {exc}") from exc


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    root.add_argument("--auth-file", type=Path, required=True)
    root.add_argument("--temp-root", type=Path, required=True)
    root.add_argument("--github-output", type=Path, required=True)
    commands = root.add_subparsers(dest="command", required=True)

    resolve = commands.add_parser("resolve")
    resolve.add_argument("--sha", required=True)

    verify = commands.add_parser("verify")
    verify.add_argument("--sha", required=True)
    verify.add_argument("--expected-digest", required=True)

    promote = commands.add_parser("promote")
    promote.add_argument("--new-digest", required=True)
    promote.add_argument("--overlay", type=Path, default=PROD_OVERLAY)
    return root


def run(argv: Sequence[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    registry = CurlRegistry(arguments.auth_file, temp_root=arguments.temp_root)
    release = HarborRelease(registry)
    if arguments.command == "resolve":
        result = release.resolve(arguments.sha)
        append_outputs(
            arguments.github_output,
            {"mode": result.mode, "digest": result.digest},
        )
    elif arguments.command == "verify":
        digest = release.verify(arguments.sha, arguments.expected_digest)
        append_outputs(
            arguments.github_output,
            {"digest": digest, "image": f"{IMAGE_REPOSITORY}@{digest}"},
        )
    else:
        previous = overlay_digest(arguments.overlay)
        result = release.promote(arguments.new_digest, previous)
        append_outputs(
            arguments.github_output,
            {
                "current": result.current,
                "rollback": result.rollback,
                "mode": result.mode,
            },
        )
    return 0


def main() -> int:
    try:
        return run()
    except ReleaseError as exc:
        print(f"Harbor release gate failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

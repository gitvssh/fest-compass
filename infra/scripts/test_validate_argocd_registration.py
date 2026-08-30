from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import sys
import unittest


sys.path.insert(0, str(Path(__file__).resolve().parent))

import validate_argocd_registration as validator


class DescriptorContractTests(unittest.TestCase):
    def test_exact_descriptor_is_accepted(self) -> None:
        validator.validate_descriptor(deepcopy(validator.EXPECTED_DESCRIPTOR))

    def test_cluster_owned_fields_are_rejected_even_when_nested(self) -> None:
        descriptor = deepcopy(validator.EXPECTED_DESCRIPTOR)
        descriptor["extension"] = {"destination": {"server": "https://cluster.invalid"}}
        with self.assertRaisesRegex(validator.ContractError, "cluster-owned descriptor field"):
            validator.validate_descriptor(descriptor)

    def test_unknown_app_owned_field_is_rejected(self) -> None:
        descriptor = deepcopy(validator.EXPECTED_DESCRIPTOR)
        descriptor["owner"] = "application-team"
        with self.assertRaisesRegex(validator.ContractError, "descriptor fields differ"):
            validator.validate_descriptor(descriptor)

    def test_fixed_repository_contract_cannot_drift(self) -> None:
        descriptor = deepcopy(validator.EXPECTED_DESCRIPTOR)
        descriptor["targetRevision"] = "release"
        with self.assertRaisesRegex(validator.ContractError, "targetRevision"):
            validator.validate_descriptor(descriptor)


class RenderedManifestContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.rendered = validator.render_prod_overlay()

    def assert_contract_rejects(self, rendered: str, message: str, *, release: bool = False) -> None:
        with self.assertRaisesRegex(validator.ContractError, message):
            validator.validate_rendered(rendered, release=release)

    def test_prepare_manifest_passes_with_zero_sentinel(self) -> None:
        digest = validator.validate_rendered(self.rendered)
        self.assertEqual(digest, validator.ZERO_DIGEST)

    def test_release_rejects_zero_sentinel(self) -> None:
        self.assert_contract_rejects(self.rendered, "zero image digest sentinel", release=True)

    def test_release_accepts_matching_nonzero_digest(self) -> None:
        digest = "sha256:" + ("a" * 64)
        released = self.rendered.replace(validator.ZERO_DIGEST, digest)
        self.assertEqual(validator.validate_rendered(released, release=True), digest)

    def test_service_version_must_match_image(self) -> None:
        annotation = (
            "observability.damecasol.com/service-version: " + validator.ZERO_DIGEST
        )
        mutated = self.rendered.replace(annotation, annotation.split(": sha256:")[0] + ": sha256:" + ("b" * 64))
        self.assert_contract_rejects(mutated, "does not match image digest")

    def test_exact_inventory_rejects_an_extra_secret(self) -> None:
        extra = """
---
apiVersion: v1
kind: Secret
metadata:
  name: unsafe-inline-secret
  namespace: fest-compass
"""
        self.assert_contract_rejects(self.rendered + extra, "resource inventory differs")

    def test_resource_api_versions_are_fixed(self) -> None:
        mutated = self.rendered.replace(
            "apiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute",
            "apiVersion: gateway.networking.k8s.io/v1beta1\nkind: HTTPRoute",
        )
        self.assert_contract_rejects(mutated, "apiVersion must be")

    def test_public_hostname_and_listener_are_exact(self) -> None:
        mutations = (
            ("kto.damecasol.com", "other.damecasol.com", "HTTPRoute hostname"),
            ("websecure-fest-compass-public", "websecure", "HTTPRoute listener section"),
        )
        for old, new, message in mutations:
            with self.subTest(old=old):
                self.assert_contract_rejects(self.rendered.replace(old, new), message)

        extra_hostname = self.rendered.replace(
            "  - kto.damecasol.com\n  parentRefs:",
            "  - kto.damecasol.com\n  - shadow.damecasol.com\n  parentRefs:",
        )
        self.assert_contract_rejects(extra_hostname, "exact public route contract")

    def test_read_only_app_configuration_is_exact(self) -> None:
        mutations = (
            ("APP_MODE: public-readonly", "APP_MODE: admin", "public read-only app mode"),
            (
                "DATABASE_URL: file:/data/fest-compass.db",
                "DATABASE_URL: file:/tmp/fest-compass.db",
                "SQLite database URL",
            ),
        )
        for old, new, message in mutations:
            with self.subTest(old=old):
                self.assert_contract_rejects(self.rendered.replace(old, new), message)

    def test_sqlite_single_writer_guards_are_exact(self) -> None:
        mutations = (
            ("replicas: 1", "replicas: 2", "single-replica SQLite"),
            ("type: Recreate", "type: RollingUpdate", "Recreate SQLite"),
            ("- ReadWriteOnce", "- ReadWriteMany", "RWO SQLite"),
            ("claimName: fest-compass-data", "claimName: other-data", "SQLite PVC mount"),
        )
        for old, new, message in mutations:
            with self.subTest(old=old):
                self.assert_contract_rejects(self.rendered.replace(old, new), message)

    def test_container_hardening_and_probe_contracts_are_required(self) -> None:
        mutations = (
            ("readOnlyRootFilesystem: true", "readOnlyRootFilesystem: false", "read-only root filesystems"),
            ("path: /health/readyz", "path: /health/livez", "live/startup probes"),
            ("mountPath: /tmp", "mountPath: /var/tmp", "/tmp mounts"),
            (
                "mountPath: /app/.next/cache",
                "mountPath: /app/.next/other",
                "writable Next.js cache mount",
            ),
            (
                "name: SEED_DEMO_DATA",
                "name: SEED_UNBOUNDED_DATA",
                "fresh database demo seed opt-in",
            ),
        )
        for old, new, message in mutations:
            with self.subTest(old=old):
                self.assert_contract_rejects(self.rendered.replace(old, new, 1), message)

    def test_vault_paths_and_explicit_runtime_projection_are_required(self) -> None:
        mutations = (
            (
                "path: projects/fest-compass/runtime",
                "path: projects/other/runtime",
                "runtime VSS path",
            ),
            (
                'get .Secrets "TOUR_API_KEY"',
                'get .Secrets "OTHER_KEY"',
                "TOUR_API_KEY explicit template",
            ),
            (
                "path: projects/fest-compass/harbor-pull",
                "path: projects/shared/harbor-pull",
                "Harbor VSS path",
            ),
        )
        for old, new, message in mutations:
            with self.subTest(old=old):
                mutated = self.rendered.replace(old, new)
                self.assertNotEqual(mutated, self.rendered, f"test fixture did not contain {old!r}")
                self.assert_contract_rejects(mutated, message)

    def test_network_egress_contract_is_required(self) -> None:
        mutations = (
            ("port: 443", "port: 80", "HTTPS port"),
            ("k8s-app: kube-dns", "k8s-app: other-dns", "DNS pod selector"),
            ("app.kubernetes.io/name: traefik", "app.kubernetes.io/name: proxy", "Traefik pod selector"),
        )
        for old, new, message in mutations:
            with self.subTest(old=old):
                self.assert_contract_rejects(self.rendered.replace(old, new), message)

    def test_namespace_repo_runner_and_gateway_contract_is_required(self) -> None:
        mutations = (
            ("gitvssh/fest-compass", "gitvssh/other", "source repository annotation"),
            ("homelab-fest-compass", "homelab-other", "ARC runner annotation"),
            (
                'gateway.homelab.damecasol.com/allowed: "true"',
                'gateway.homelab.damecasol.com/allowed: "false"',
                "gateway namespace allow label",
            ),
        )
        for old, new, message in mutations:
            with self.subTest(old=old):
                self.assert_contract_rejects(self.rendered.replace(old, new), message)


class ReleaseWorkflowContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = validator.WORKFLOW_PATH.read_text(encoding="utf-8")
        cls.helper = validator.HARBOR_HELPER_PATH.read_text(encoding="utf-8")

    def assert_workflow_rejects(self, workflow: str, message: str) -> None:
        with self.assertRaisesRegex(validator.ContractError, message):
            validator.validate_release_workflow(workflow, self.helper)

    def test_exact_release_workflow_is_accepted(self) -> None:
        validator.validate_release_workflow(self.workflow, self.helper)

    def test_workflow_dispatch_is_the_only_trigger(self) -> None:
        mutated = self.workflow.replace(
            "  workflow_dispatch:\n",
            "  workflow_dispatch:\n  push:\n",
        )
        self.assert_workflow_rejects(mutated, "workflow_dispatch only")

    def test_repository_main_actor_and_triggering_actor_guards_are_fixed(self) -> None:
        mutations = (
            ("gitvssh/fest-compass", "gitvssh/other", "trusted repository guard"),
            ("refs/heads/main", "refs/heads/release", "trusted main guard"),
            ("github.actor == 'gitvssh'", "github.actor == 'other'", "trusted actor guard"),
            (
                "github.triggering_actor == 'gitvssh'",
                "github.triggering_actor == 'other'",
                "trusted triggering actor guard",
            ),
        )
        for old, new, message in mutations:
            with self.subTest(old=old):
                self.assert_workflow_rejects(self.workflow.replace(old, new, 1), message)

    def test_arc_runner_and_contents_read_permission_are_fixed(self) -> None:
        self.assert_workflow_rejects(
            self.workflow.replace("runs-on: homelab-fest-compass", "runs-on: ubuntu-latest"),
            "ARC runner label",
        )
        self.assert_workflow_rejects(
            self.workflow.replace("contents: read", "contents: write"),
            "permissions must be exactly",
        )

    def test_only_full_sha_pinned_actions_are_allowed(self) -> None:
        mutated = self.workflow.replace(
            "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
            "actions/checkout@v6",
        )
        self.assert_workflow_rejects(mutated, "pinned allowlist")

    def test_secret_references_are_exact(self) -> None:
        mutated = self.workflow.replace(
            "HARBOR_TOKEN: ${{ secrets.HARBOR_TOKEN }}",
            "HARBOR_TOKEN: ${{ secrets.HARBOR_TOKEN }}\n          EXTRA: ${{ secrets.EXTRA }}",
        )
        self.assert_workflow_rejects(mutated, "secret references must be exact")

    def test_cache_artifact_latest_and_deploy_mutations_are_forbidden(self) -> None:
        mutations = (
            (
                "uses: actions/setup-node@",
                "uses: actions/cache@0123456789012345678901234567890123456789\n      - uses: actions/setup-node@",
                "pinned allowlist",
            ),
            (
                "--metadata-file \"${metadata}\"",
                "--metadata-file \"${metadata}\"\n          echo registry.damecasol.com/fest-compass/web:latest",
                "movable latest",
            ),
            (
                "python3 infra/scripts/validate_argocd_registration.py",
                "python3 infra/scripts/validate_argocd_registration.py\n          kubectl apply -f infra/k8s",
                "Kubernetes mutation",
            ),
        )
        for old, new, message in mutations:
            with self.subTest(message=message):
                self.assert_workflow_rejects(self.workflow.replace(old, new, 1), message)

    def test_validation_and_publication_stage_order_is_fixed(self) -> None:
        original = """          npm --prefix apps/web test
          npm --prefix apps/web run typecheck"""
        reversed_order = """          npm --prefix apps/web run typecheck
          npm --prefix apps/web test"""
        self.assert_workflow_rejects(
            self.workflow.replace(original, reversed_order),
            "stage is out of order",
        )

    def test_build_context_sha_tag_and_prepare_validation_are_fixed(self) -> None:
        mutations = (
            ("--local context=apps/web", "--local context=.", "BuildKit context"),
            (
                'name=${IMAGE_REPOSITORY}:${GITHUB_SHA}',
                'name=${IMAGE_REPOSITORY}:candidate',
                "immutable SHA tag",
            ),
            (
                "validate_argocd_registration.py\n",
                "validate_argocd_registration.py --release\n",
                "prepare mode",
            ),
        )
        for old, new, message in mutations:
            with self.subTest(old=old):
                self.assert_workflow_rejects(self.workflow.replace(old, new, 1), message)

    def test_cleanup_is_always_the_final_step(self) -> None:
        mutated = self.workflow + "\n      - name: Unsafe later step\n        run: echo nope\n"
        self.assert_workflow_rejects(mutated, "cleanup must be the final")

    def test_harbor_helper_coordinates_are_bound_to_this_repository(self) -> None:
        mutated_helper = self.helper.replace(
            'REPOSITORY_PATH = "fest-compass/web"',
            'REPOSITORY_PATH = "other/web"',
        )
        with self.assertRaisesRegex(validator.ContractError, "repository path"):
            validator.validate_release_workflow(self.workflow, mutated_helper)


if __name__ == "__main__":
    unittest.main()

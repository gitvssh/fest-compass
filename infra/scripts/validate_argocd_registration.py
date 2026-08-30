#!/usr/bin/env python3
"""Fail-closed validation for the app-owned fest-compass Argo/Kubernetes contract."""

from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any, Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
DESCRIPTOR_PATH = REPO_ROOT / "infra" / "argocd" / "applications" / "prod.json"
OVERLAY_PATH = REPO_ROOT / "infra" / "k8s" / "fest-compass" / "overlays" / "prod"
WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "release.yml"
HARBOR_HELPER_PATH = REPO_ROOT / "infra" / "scripts" / "harbor_release.py"

NAMESPACE = "fest-compass"
IMAGE_REPOSITORY = "registry.damecasol.com/fest-compass/web"
HOSTNAME = "kto.damecasol.com"
LISTENER_SECTION = "websecure-fest-compass-public"
SOURCE_REPOSITORY = "gitvssh/fest-compass"
ARC_RUNNER_LABEL = "homelab-fest-compass"
ZERO_DIGEST = "sha256:" + ("0" * 64)
IMMUTABLE_DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")

EXPECTED_ACTIONS = {
    "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
    "actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444",
    "azure/setup-kubectl@829323503d1be3d00ca8346e5391ca0b07a9ab0d",
}
EXPECTED_WORKFLOW_SECRETS = {"HARBOR_USERNAME", "HARBOR_TOKEN"}

EXPECTED_DESCRIPTOR = {
    "schemaVersion": 1,
    "name": "fest-compass-prod",
    "environment": "prod",
    "targetRevision": "main",
    "sourcePath": "infra/k8s/fest-compass/overlays/prod",
    "namespace": NAMESPACE,
    "syncClass": "manual",
}

# These fields are controlled by the canonical GitOps repository, never by an
# app registration descriptor. Checking recursively prevents a nested bypass.
CLUSTER_OWNED_FIELDS = {
    "project",
    "repoURL",
    "repoUrl",
    "destination",
    "server",
    "cluster",
    "syncPolicy",
    "prune",
    "selfHeal",
    "finalizers",
}

EXPECTED_RESOURCES = {
    ("Namespace", "fest-compass"),
    ("ResourceQuota", "fest-compass"),
    ("ServiceAccount", "fest-compass"),
    ("ConfigMap", "fest-compass-config"),
    ("Service", "fest-compass"),
    ("LimitRange", "fest-compass-defaults"),
    ("PersistentVolumeClaim", "fest-compass-data"),
    ("Deployment", "fest-compass"),
    ("HTTPRoute", "fest-compass"),
    ("NetworkPolicy", "default-deny"),
    ("NetworkPolicy", "allow-traefik-ingress"),
    ("NetworkPolicy", "allow-dns-egress"),
    ("NetworkPolicy", "allow-https-egress"),
    ("VaultConnection", "vault-homelab"),
    ("VaultAuth", "fest-compass"),
    ("VaultStaticSecret", "harbor-pull"),
    ("VaultStaticSecret", "fest-compass-runtime"),
}

EXPECTED_API_VERSIONS = {
    **{identity: "v1" for identity in EXPECTED_RESOURCES if identity[0] in {
        "Namespace",
        "ResourceQuota",
        "ServiceAccount",
        "ConfigMap",
        "Service",
        "LimitRange",
        "PersistentVolumeClaim",
    }},
    ("Deployment", "fest-compass"): "apps/v1",
    ("HTTPRoute", "fest-compass"): "gateway.networking.k8s.io/v1",
    ("NetworkPolicy", "default-deny"): "networking.k8s.io/v1",
    ("NetworkPolicy", "allow-traefik-ingress"): "networking.k8s.io/v1",
    ("NetworkPolicy", "allow-dns-egress"): "networking.k8s.io/v1",
    ("NetworkPolicy", "allow-https-egress"): "networking.k8s.io/v1",
    ("VaultConnection", "vault-homelab"): "secrets.hashicorp.com/v1beta1",
    ("VaultAuth", "fest-compass"): "secrets.hashicorp.com/v1beta1",
    ("VaultStaticSecret", "harbor-pull"): "secrets.hashicorp.com/v1beta1",
    ("VaultStaticSecret", "fest-compass-runtime"): "secrets.hashicorp.com/v1beta1",
}


class ContractError(AssertionError):
    """Raised when an app-owned delivery contract is unsafe or incomplete."""


def fail(message: str) -> None:
    raise ContractError(message)


def _walk_keys(value: Any, path: str = "$") -> Iterable[tuple[str, str]]:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            yield str(key), child_path
            yield from _walk_keys(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _walk_keys(child, f"{path}[{index}]")


def validate_descriptor(descriptor: Any) -> None:
    if not isinstance(descriptor, dict):
        fail("Argo registration descriptor must be a JSON object")

    forbidden = [(key, path) for key, path in _walk_keys(descriptor) if key in CLUSTER_OWNED_FIELDS]
    if forbidden:
        key, path = forbidden[0]
        fail(f"cluster-owned descriptor field is forbidden: {key} at {path}")

    actual_keys = set(descriptor)
    expected_keys = set(EXPECTED_DESCRIPTOR)
    missing = sorted(expected_keys - actual_keys)
    unexpected = sorted(actual_keys - expected_keys)
    if missing or unexpected:
        fail(f"descriptor fields differ from contract; missing={missing}, unexpected={unexpected}")

    for key, expected in EXPECTED_DESCRIPTOR.items():
        actual = descriptor[key]
        if actual != expected:
            fail(f"descriptor {key!r} must be {expected!r}, got {actual!r}")

    source = REPO_ROOT / descriptor["sourcePath"]
    if source.resolve() != OVERLAY_PATH.resolve():
        fail("descriptor sourcePath resolves outside the fixed prod overlay")
    if not (source / "kustomization.yaml").is_file():
        fail(f"descriptor sourcePath has no kustomization.yaml: {source}")


def load_descriptor(path: Path = DESCRIPTOR_PATH) -> dict[str, Any]:
    try:
        descriptor = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"missing Argo registration descriptor: {path}")
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON descriptor {path}: {exc}")
    validate_descriptor(descriptor)
    return descriptor


def render_prod_overlay() -> str:
    kubectl = shutil.which("kubectl")
    if not kubectl:
        fail("kubectl is required to render the prod Kustomize overlay")
    completed = subprocess.run(
        [kubectl, "kustomize", str(OVERLAY_PATH)],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip()
        fail(f"kubectl kustomize failed: {detail}")
    if not completed.stdout.strip():
        fail("kubectl kustomize returned an empty manifest")
    return completed.stdout


def split_documents(rendered: str) -> list[str]:
    return [part.strip() + "\n" for part in re.split(r"(?m)^---\s*$", rendered) if part.strip()]


def _top_level_block(document: str, key: str) -> str:
    match = re.search(rf"(?m)^{re.escape(key)}:\s*$", document)
    if not match:
        fail(f"resource is missing top-level {key!r}")
    remainder = document[match.end() :]
    lines: list[str] = []
    for line in remainder.splitlines():
        if line and not line[0].isspace():
            break
        lines.append(line)
    return "\n".join(lines)


def resource_identity(document: str) -> tuple[str, str]:
    kind_match = re.search(r"(?m)^kind:\s*([^\s#]+)\s*$", document)
    if not kind_match:
        fail("rendered YAML document has no top-level kind")
    metadata = _top_level_block(document, "metadata")
    name_match = re.search(r"(?m)^  name:\s*([^\s#]+)\s*$", metadata)
    if not name_match:
        fail(f"rendered {kind_match.group(1)} has no metadata.name")
    return kind_match.group(1), name_match.group(1).strip('"\'')


def index_resources(rendered: str) -> dict[tuple[str, str], str]:
    documents = split_documents(rendered)
    identities = [resource_identity(document) for document in documents]
    counts = Counter(identities)
    duplicates = sorted(identity for identity, count in counts.items() if count != 1)
    if duplicates:
        fail(f"rendered resources contain duplicate identities: {duplicates}")
    actual = set(identities)
    missing = sorted(EXPECTED_RESOURCES - actual)
    unexpected = sorted(actual - EXPECTED_RESOURCES)
    if missing or unexpected:
        fail(f"rendered resource inventory differs; missing={missing}, unexpected={unexpected}")
    resources = dict(zip(identities, documents))
    for identity, document in resources.items():
        version = require(document, r"^apiVersion:\s*([^\s#]+)\s*$", f"{identity} apiVersion").group(1)
        if version != EXPECTED_API_VERSIONS[identity]:
            fail(f"{identity} apiVersion must be {EXPECTED_API_VERSIONS[identity]!r}, got {version!r}")
    return resources


def require(document: str, pattern: str, context: str, *, flags: int = re.MULTILINE) -> re.Match[str]:
    match = re.search(pattern, document, flags)
    if not match:
        fail(f"{context}: required manifest contract is missing")
    return match


def require_count(document: str, pattern: str, expected: int, context: str) -> None:
    actual = len(re.findall(pattern, document, re.MULTILINE))
    if actual != expected:
        fail(f"{context}: expected {expected} occurrence(s), got {actual}")


def validate_namespaces(resources: dict[tuple[str, str], str]) -> None:
    for identity, document in resources.items():
        if identity[0] == "Namespace":
            continue
        metadata = _top_level_block(document, "metadata")
        namespace = require(metadata, r"^  namespace:\s*([^\s#]+)\s*$", f"{identity} namespace").group(1)
        if namespace.strip('"\'') != NAMESPACE:
            fail(f"{identity} must render in namespace {NAMESPACE!r}")


def validate_namespace_contract(document: str) -> None:
    require(document, r'^    gateway\.homelab\.damecasol\.com/allowed:\s*["\']?true["\']?$', "gateway namespace allow label")
    require(document, rf"^    gitops\.damecasol\.com/source-repository:\s*{re.escape(SOURCE_REPOSITORY)}$", "source repository annotation")
    require(document, rf"^    delivery\.damecasol\.com/arc-runner:\s*{re.escape(ARC_RUNNER_LABEL)}$", "ARC runner annotation")


def validate_config_and_limits(resources: dict[tuple[str, str], str]) -> None:
    config = resources[("ConfigMap", "fest-compass-config")]
    data = _top_level_block(config, "data")
    require(data, r"^  APP_MODE:\s*public-readonly$", "public read-only app mode")
    require(data, r"^  DATABASE_URL:\s*file:/data/fest-compass\.db$", "SQLite database URL")
    keys = set(re.findall(r"(?m)^  ([A-Za-z_][A-Za-z0-9_]*):", data))
    if keys != {"APP_MODE", "DATABASE_URL"}:
        fail(f"ConfigMap data keys must be exact; got {sorted(keys)}")

    service_account = resources[("ServiceAccount", "fest-compass")]
    require(service_account, r"^automountServiceAccountToken:\s*false$", "service account token hardening")

    quota = resources[("ResourceQuota", "fest-compass")]
    for pattern, context in (
        (r'^    persistentvolumeclaims:\s*["\']?1["\']?$', "PVC quota"),
        (r"^    requests\.storage:\s*2Gi$", "storage request quota"),
        (r'^    pods:\s*["\']?3["\']?$', "pod quota"),
        (r'^    secrets:\s*["\']?4["\']?$', "secret quota"),
    ):
        require(quota, pattern, context)

    limit_range = resources[("LimitRange", "fest-compass-defaults")]
    require(limit_range, r"^    defaultRequest:$", "LimitRange default requests")
    require(limit_range, r"^  - default:$", "LimitRange default limits")
    require(limit_range, r"^    type:\s*Container$", "LimitRange container scope")


def validate_route_and_service(resources: dict[tuple[str, str], str]) -> None:
    route = resources[("HTTPRoute", "fest-compass")]
    require_count(route, rf"^  - {re.escape(HOSTNAME)}$", 1, "HTTPRoute hostname")
    require(route, r"^  - name:\s*homelab-gateway$", "HTTPRoute gateway parent")
    require(route, r"^    namespace:\s*kube-system$", "HTTPRoute gateway namespace")
    require_count(route, rf"^    sectionName:\s*{re.escape(LISTENER_SECTION)}$", 1, "HTTPRoute listener section")
    require(route, r"^        type:\s*PathPrefix$", "HTTPRoute path type")
    require(route, r"^        value:\s*/$", "HTTPRoute path")
    require(route, r"^    - name:\s*fest-compass$", "HTTPRoute backend")
    require(route, r"^      port:\s*80$", "HTTPRoute backend port")

    expected_route_spec = f"""spec:
  hostnames:
  - {HOSTNAME}
  parentRefs:
  - name: homelab-gateway
    namespace: kube-system
    sectionName: {LISTENER_SECTION}
  rules:
  - backendRefs:
    - name: fest-compass
      port: 80
    matches:
    - path:
        type: PathPrefix
        value: /"""
    actual_route_spec = route[route.index("spec:\n") :].strip()
    if actual_route_spec != expected_route_spec:
        fail("HTTPRoute spec must match the exact public route contract")

    service = resources[("Service", "fest-compass")]
    require(service, r"^    port:\s*80$", "Service port")
    require(service, r"^    targetPort:\s*http$", "Service target port")
    require(
        service,
        r"^  selector:\s*\n    app\.kubernetes\.io/component:\s*web\n    app\.kubernetes\.io/name:\s*fest-compass$",
        "Service selector",
    )


def validate_sqlite_and_deployment(resources: dict[tuple[str, str], str], *, release: bool) -> str:
    deployment = resources[("Deployment", "fest-compass")]
    pvc = resources[("PersistentVolumeClaim", "fest-compass-data")]

    require(deployment, r"^  replicas:\s*1$", "single-replica SQLite deployment")
    require(deployment, r"^  strategy:\s*\n    type:\s*Recreate$", "Recreate SQLite deployment")
    require(pvc, r"^  accessModes:\s*\n  - ReadWriteOnce$", "RWO SQLite volume")
    require(pvc, r"^      storage:\s*1Gi$", "SQLite PVC size")
    require(deployment, r"^          claimName:\s*fest-compass-data$", "SQLite PVC mount")

    images = re.findall(r"(?m)^        image:\s*([^\s#]+)\s*$", deployment)
    if len(images) != 2 or len(set(images)) != 1:
        fail(f"init and web containers must use one identical immutable image; got {images}")
    image = images[0]
    repository, separator, digest = image.partition("@")
    if separator != "@" or repository != IMAGE_REPOSITORY or not IMMUTABLE_DIGEST.fullmatch(digest):
        fail(f"deployment image must be {IMAGE_REPOSITORY}@sha256:<64 lowercase hex>")

    annotation = require(
        deployment,
        r"^        observability\.damecasol\.com/service-version:\s*(sha256:[0-9a-f]{64})$",
        "service-version annotation",
    ).group(1)
    if annotation != digest:
        fail(f"service-version annotation {annotation} does not match image digest {digest}")
    if release and digest == ZERO_DIGEST:
        fail("release validation rejects the zero image digest sentinel; inject the built image digest")

    require(deployment, r"^      serviceAccountName:\s*fest-compass$", "deployment service account")
    require(deployment, r"^      automountServiceAccountToken:\s*false$", "pod token hardening")
    require(deployment, r"^      - name:\s*harbor-pull$", "Harbor image pull secret")
    require(deployment, r"^        runAsNonRoot:\s*true$", "non-root pod security")
    require(deployment, r"^          type:\s*RuntimeDefault$", "seccomp profile")
    require_count(deployment, r"^          readOnlyRootFilesystem:\s*true$", 2, "read-only root filesystems")
    require_count(deployment, r"^          allowPrivilegeEscalation:\s*false$", 2, "privilege escalation hardening")
    require_count(deployment, r"^            - ALL$", 2, "Linux capability drops")
    require_count(deployment, r"^        - mountPath:\s*/data$", 2, "/data mounts")
    require_count(deployment, r"^        - mountPath:\s*/tmp$", 2, "/tmp mounts")
    require(deployment, r"^        - mountPath:\s*/app/\.next/cache$", "writable Next.js cache mount")
    require_count(deployment, r"^      - emptyDir:$", 2, "writable runtime emptyDirs")
    require(deployment, r"^        name:\s*next-cache$", "Next.js cache emptyDir")

    require(deployment, r"^      initContainers:$", "database migration initContainer")
    require(deployment, r"^        name:\s*migrate$", "database migration initContainer name")
    require(deployment, r"^        - name:\s*RUN_DB_MIGRATIONS$", "migration opt-in")
    require(deployment, r"^        - name:\s*SEED_DEMO_DATA$", "fresh database demo seed opt-in")
    require(deployment, r"^        - name:\s*MIGRATE_ONLY$", "init-only process opt-in")
    require_count(deployment, r'^          value:\s*"1"$', 3, "init migration flags")
    require_count(deployment, r"^            name:\s*fest-compass-config$", 2, "configuration injection")
    require(deployment, r"^            name:\s*fest-compass-runtime$", "runtime secret injection")

    require_count(deployment, r"^            path:\s*/health/livez$", 2, "live/startup probes")
    require_count(deployment, r"^            path:\s*/health/readyz$", 1, "readiness probe")
    require_count(deployment, r"^            port:\s*http$", 3, "HTTP probe port")
    return digest


def validate_vault(resources: dict[tuple[str, str], str]) -> None:
    connection = resources[("VaultConnection", "vault-homelab")]
    require(connection, r"^  address:\s*https://vault\.homelab\.damecasol\.com$", "Vault connection")

    auth = resources[("VaultAuth", "fest-compass")]
    for pattern, context in (
        (r"^  vaultConnectionRef:\s*vault-homelab$", "VaultAuth connection"),
        (r"^  method:\s*kubernetes$", "VaultAuth method"),
        (r"^  mount:\s*kubernetes$", "VaultAuth mount"),
        (r"^    role:\s*fest-compass$", "Vault role"),
        (r"^    serviceAccount:\s*fest-compass$", "Vault service account"),
        (r"^    tokenExpirationSeconds:\s*600$", "Vault token lifetime"),
        (r"^    - vault$", "Vault token audience"),
    ):
        require(auth, pattern, context)

    harbor = resources[("VaultStaticSecret", "harbor-pull")]
    for pattern, context in (
        (r"^  vaultAuthRef:\s*fest-compass$", "Harbor VSS auth"),
        (r"^  mount:\s*kv$", "Harbor VSS mount"),
        (r"^  type:\s*kv-v2$", "Harbor VSS type"),
        (r"^  path:\s*projects/fest-compass/harbor-pull$", "Harbor VSS path"),
        (r"^    name:\s*harbor-pull$", "Harbor destination"),
        (r"^    type:\s*kubernetes\.io/dockerconfigjson$", "Harbor Secret type"),
        (r"^      excludeRaw:\s*true$", "Harbor raw-field exclusion"),
    ):
        require(harbor, pattern, context)

    runtime = resources[("VaultStaticSecret", "fest-compass-runtime")]
    for pattern, context in (
        (r"^  vaultAuthRef:\s*fest-compass$", "runtime VSS auth"),
        (r"^  mount:\s*kv$", "runtime VSS mount"),
        (r"^  type:\s*kv-v2$", "runtime VSS type"),
        (r"^  path:\s*projects/fest-compass/runtime$", "runtime VSS path"),
        (r"^    name:\s*fest-compass-runtime$", "runtime Secret destination"),
        (r"^      excludeRaw:\s*true$", "runtime raw-field exclusion"),
        (r"^        TOUR_API_KEY:$", "TOUR_API_KEY projection"),
        (r"^          text:\s*['\"]?\{\{- get \.Secrets \\?\"TOUR_API_KEY\\?\" -\}\}['\"]?$", "TOUR_API_KEY explicit template"),
        (r"^  - kind:\s*Deployment$", "runtime rollout target kind"),
        (r"^    name:\s*fest-compass$", "runtime rollout target name"),
    ):
        require(runtime, pattern, context)
    projected_keys = set(re.findall(r"(?m)^        ([A-Z][A-Z0-9_]*):\s*$", runtime))
    if projected_keys != {"TOUR_API_KEY"}:
        fail(f"runtime VSS must project only TOUR_API_KEY; got {sorted(projected_keys)}")


def validate_network_policies(resources: dict[tuple[str, str], str]) -> None:
    default_deny = resources[("NetworkPolicy", "default-deny")]
    require(default_deny, r"^  podSelector:\s*\{\}$", "default-deny selector")
    require(default_deny, r"^  - Ingress$", "default-deny ingress")
    require(default_deny, r"^  - Egress$", "default-deny egress")

    traefik = resources[("NetworkPolicy", "allow-traefik-ingress")]
    require(traefik, r"^          kubernetes\.io/metadata\.name:\s*kube-system$", "Traefik namespace selector")
    require(traefik, r"^          app\.kubernetes\.io/name:\s*traefik$", "Traefik pod selector")
    require(traefik, r"^    - port:\s*3000$", "Traefik target port")
    require(traefik, r"^      protocol:\s*TCP$", "Traefik protocol")

    dns = resources[("NetworkPolicy", "allow-dns-egress")]
    require(dns, r"^          kubernetes\.io/metadata\.name:\s*kube-system$", "DNS namespace selector")
    require(dns, r"^          k8s-app:\s*kube-dns$", "DNS pod selector")
    require_count(dns, r"^    - port:\s*53$", 2, "DNS ports")
    require(dns, r"^      protocol:\s*UDP$", "DNS UDP")
    require(dns, r"^      protocol:\s*TCP$", "DNS TCP")

    https = resources[("NetworkPolicy", "allow-https-egress")]
    require(https, r"^        cidr:\s*0\.0\.0\.0/0$", "HTTPS external CIDR")
    require(https, r"^    - port:\s*443$", "HTTPS port")
    require(https, r"^      protocol:\s*TCP$", "HTTPS protocol")


def _read_contract_file(path: Path, description: str) -> str:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        fail(f"{description} is unavailable: {exc}")
    if not text.strip():
        fail(f"{description} is empty")
    return text


def _require_ordered(text: str, fragments: list[str], context: str) -> None:
    cursor = -1
    for fragment in fragments:
        index = text.find(fragment)
        if index < 0:
            fail(f"{context}: missing required stage {fragment!r}")
        if index <= cursor:
            fail(f"{context}: stage is out of order: {fragment!r}")
        cursor = index


def validate_harbor_helper_contract(text: str) -> None:
    constants = (
        ('REGISTRY = "https://registry.damecasol.com"', "Harbor registry"),
        ('REPOSITORY_PATH = "fest-compass/web"', "Harbor repository path"),
        (
            'IMAGE_REPOSITORY = "registry.damecasol.com/fest-compass/web"',
            "image repository",
        ),
        (
            'EXPECTED_SOURCE = "https://github.com/gitvssh/fest-compass"',
            "OCI source label",
        ),
        ('/ "k8s/fest-compass/overlays/prod/kustomization.yaml"', "prod overlay binding"),
    )
    for literal, context in constants:
        if text.count(literal) != 1:
            fail(f"Harbor helper {context} must occur exactly once")
    for literal, context in (
        ('"--disable"', "curl config disable"),
        ('"--netrc-file"', "scoped netrc authentication"),
        ('marker not in {"deploy-current", "deploy-rollback"}', "marker allowlist"),
        ('SPDX_PREDICATE = "https://spdx.dev/Document"', "SPDX predicate"),
    ):
        if literal not in text:
            fail(f"Harbor helper is missing {context}")
    if re.search(r"(?i)(?::|/|\b)latest\b", text):
        fail("Harbor helper must not contain a movable latest reference")


def validate_release_workflow(text: str, helper_text: str | None = None) -> None:
    trigger = require(
        text,
        r"^on:\s*\n(?P<body>(?:^[ \t].*(?:\n|$))*)",
        "release workflow trigger",
    ).group("body").strip()
    if trigger != "workflow_dispatch:":
        fail(f"release workflow trigger must be workflow_dispatch only, got {trigger!r}")

    permissions = require(
        text,
        r"^permissions:\s*\n(?P<body>(?:^[ \t].*(?:\n|$))*)",
        "release workflow permissions",
    ).group("body").strip()
    if permissions != "contents: read":
        fail(f"release workflow permissions must be exactly contents: read, got {permissions!r}")
    require_count(text, r"^permissions:\s*$", 1, "single workflow permission block")

    for literal, context in (
        ("github.repository == 'gitvssh/fest-compass'", "trusted repository guard"),
        ("github.ref == 'refs/heads/main'", "trusted main guard"),
        ("github.actor == 'gitvssh'", "trusted actor guard"),
        ("github.triggering_actor == 'gitvssh'", "trusted triggering actor guard"),
        ("runs-on: homelab-fest-compass", "ARC runner label"),
        ("persist-credentials: false", "checkout credential isolation"),
        ("if: steps.resolve.outputs.mode == 'build'", "build-once conditional"),
        ("IMAGE_REPOSITORY: registry.damecasol.com/fest-compass/web", "image repository"),
        ("--local context=apps/web", "BuildKit context"),
        ("--local dockerfile=apps/web", "BuildKit Dockerfile root"),
        ("--opt filename=Dockerfile", "BuildKit Dockerfile name"),
        ('--output "type=image,name=${IMAGE_REPOSITORY}:${GITHUB_SHA},push=true"', "immutable SHA tag"),
        ('--opt "attest:sbom="', "BuildKit SBOM attestation"),
        ("if: always()", "always-run credential cleanup"),
    ):
        if text.count(literal) != 1:
            fail(f"release workflow {context} must occur exactly once")

    runs_on = re.findall(r"(?m)^\s+runs-on:\s*([^\s#]+)", text)
    if runs_on != [ARC_RUNNER_LABEL]:
        fail(f"release workflow must use only ARC runner {ARC_RUNNER_LABEL!r}, got {runs_on}")

    action_refs = set(re.findall(r"(?m)^\s+uses:\s*([^\s#]+)", text))
    if action_refs != EXPECTED_ACTIONS:
        fail(f"release workflow actions differ from pinned allowlist: {sorted(action_refs)}")
    for action in action_refs:
        _, separator, revision = action.rpartition("@")
        if separator != "@" or re.fullmatch(r"[0-9a-f]{40}", revision) is None:
            fail(f"release workflow action is not pinned by full commit SHA: {action}")

    secrets = set(re.findall(r"\$\{\{\s*secrets\.([A-Z][A-Z0-9_]*)\s*\}\}", text))
    if secrets != EXPECTED_WORKFLOW_SECRETS:
        fail(f"release workflow secret references must be exact, got {sorted(secrets)}")
    for secret in EXPECTED_WORKFLOW_SECRETS:
        require_count(text, rf"\$\{{\{{\s*secrets\.{secret}\s*\}}\}}", 1, f"{secret} reference")

    banned_patterns = (
        (r"(?im)^\s*runs-on:\s*(?:ubuntu|windows|macos)-", "GitHub-hosted runner"),
        (r"(?i)actions/(?:cache|upload-artifact|download-artifact)@", "Actions cache/artifact"),
        (r"(?im)^\s+cache:\s*", "Actions dependency cache"),
        (r"(?i)(?::|/|\b)latest\b", "movable latest reference"),
        (r"(?im)\bkubectl\s+(?:apply|create|delete|patch|replace|set|rollout|scale)\b", "Kubernetes mutation"),
        (r"(?im)\b(?:argocd|flux)\b.*\b(?:sync|reconcile|app)\b", "GitOps mutation"),
        (r"(?im)\bhelm\s+(?:install|upgrade|uninstall|rollback)\b", "Helm mutation"),
        (r"(?im)\bkustomize\s+edit\b", "Kustomize mutation"),
        (r"(?im)\b(?:sed|yq)\s+-i\b", "in-place manifest edit"),
        (r"(?im)\bgit\s+(?:commit|push|tag)\b", "repository mutation"),
    )
    for pattern, context in banned_patterns:
        if re.search(pattern, text):
            fail(f"release workflow contains forbidden {context}")

    _require_ordered(
        text,
        [
            "npm --prefix apps/web ci",
            "npm --prefix apps/web audit --omit=dev --omit=optional --audit-level=high",
            "npm --prefix apps/web test",
            "npm --prefix apps/web run typecheck",
            "npm --prefix apps/web run build",
            "python3 infra/scripts/validate_argocd_registration.py",
            "Resolve existing immutable commit tag",
            "buildctl build",
            "Remotely verify selected immutable image",
            "Promote and verify Harbor retention markers",
            "Report verified immutable digest",
            "Remove credential files",
        ],
        "release workflow",
    )
    if "validate_argocd_registration.py --release" in text:
        fail("publication workflow must run descriptor validation in prepare mode")

    step_names = re.findall(r"(?m)^\s{6}- name:\s*(.+?)\s*$", text)
    if not step_names or step_names[-1] != "Remove credential files":
        fail("credential cleanup must be the final release workflow step")

    if helper_text is None:
        helper_text = _read_contract_file(HARBOR_HELPER_PATH, "Harbor release helper")
    validate_harbor_helper_contract(helper_text)


def validate_rendered(rendered: str, *, release: bool = False) -> str:
    resources = index_resources(rendered)
    validate_namespaces(resources)
    validate_namespace_contract(resources[("Namespace", "fest-compass")])
    validate_config_and_limits(resources)
    validate_route_and_service(resources)
    digest = validate_sqlite_and_deployment(resources, release=release)
    validate_vault(resources)
    validate_network_policies(resources)
    return digest


def validate_repository(*, release: bool = False) -> tuple[int, str]:
    load_descriptor()
    workflow = _read_contract_file(WORKFLOW_PATH, "release workflow")
    helper = _read_contract_file(HARBOR_HELPER_PATH, "Harbor release helper")
    validate_release_workflow(workflow, helper)
    rendered = render_prod_overlay()
    digest = validate_rendered(rendered, release=release)
    return len(split_documents(rendered)), digest


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--release",
        action="store_true",
        help="require a non-zero immutable image digest; prepare mode permits the zero sentinel",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        count, digest = validate_repository(release=args.release)
    except (ContractError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    mode = "release" if args.release else "prepare"
    sentinel = " (zero sentinel)" if digest == ZERO_DIGEST else ""
    print(f"OK: {count} prod resources validated in {mode} mode; digest={digest}{sentinel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

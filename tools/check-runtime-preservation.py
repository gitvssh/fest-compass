#!/usr/bin/env python3
"""Read-only deployment identity and business-record hashes. Never prints record values or secrets."""
import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def run(args, data=None):
    result = subprocess.run(args, input=data, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Read-only runtime check failed; raw provider output withheld')
    return json.loads(result.stdout)


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--compare', type=Path)
parser.add_argument('--digest')
parser.add_argument('--revision')
args = parser.parse_args()
kubectl = ['kubectl', '--context', 'homelab-k8s']


def obj(namespace, kind, name):
    return run(kubectl + ['-n', namespace, 'get', kind, name, '-o', 'json'])


deployment = obj('fest-compass', 'deployment', 'fest-compass')
app = obj('argocd', 'application', 'fest-compass-prod')
spec = deployment['spec']['template']['spec']
claim = next(v['persistentVolumeClaim']['claimName'] for v in spec['volumes'] if 'persistentVolumeClaim' in v)
pvc = obj('fest-compass', 'pvc', claim)
business = run(kubectl + ['-n', 'fest-compass', 'exec', '-i', 'deployment/fest-compass', '-c', 'web', '--', 'node'], '''
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  const result = {};
  for (const name of ['festival', 'evidenceSnapshot', 'assumption', 'capacityRule', 'scenario', 'decision', 'operationTrigger', 'fieldAction', 'outcome']) {
    const rows = await prisma[name].findMany({ orderBy: { id: 'asc' } });
    result[name] = { count: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
  }
  console.log(JSON.stringify(result));
})().catch(() => { process.exitCode = 1; }).finally(() => prisma.$disconnect());
''')
result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'deploymentUid': deployment['metadata']['uid'],
          'pvcUid': pvc['metadata']['uid'], 'generation': deployment['metadata']['generation'],
          'observedGeneration': deployment['status'].get('observedGeneration'),
          'ready': deployment['status'].get('readyReplicas', 0),
          'images': {c['name']: c['image'] for c in spec.get('initContainers', []) + spec['containers']},
          'revision': app['status']['sync'].get('revision'), 'sync': app['status']['sync']['status'],
          'health': app['status']['health']['status'], 'operation': app['status'].get('operationState', {}).get('phase'),
          'business': business}
if args.compare:
    before = json.loads(args.compare.read_text())
    for field in ['deploymentUid', 'pvcUid', 'business']:
        if before[field] != result[field]:
            raise RuntimeError(f'Preservation mismatch: {field}')
if args.digest:
    assert all(image.endswith('@' + args.digest) for image in result['images'].values()), 'Image mismatch'
if args.revision:
    assert result['revision'] == args.revision, 'Revision mismatch'
assert result['ready'] == 1 and result['generation'] == result['observedGeneration'], 'Workload not ready'
assert (result['sync'], result['health'], result['operation']) == ('Synced', 'Healthy', 'Succeeded'), 'App not healthy'
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))

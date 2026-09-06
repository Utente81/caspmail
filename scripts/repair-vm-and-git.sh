#!/usr/bin/env bash
# CaspMail: safe VM remediation, Git validation and optional commit/push.
#
# The default mode is read-only. Nothing is deleted, restarted or pushed unless
# the corresponding explicit flag is supplied.
#
# Examples:
#   ./scripts/repair-vm-and-git.sh --plan
#   ./scripts/repair-vm-and-git.sh --apply --npm-fix
#   SMTP_PASSWORD='...' ./scripts/repair-vm-and-git.sh --apply --cluster-secrets
#   ./scripts/repair-vm-and-git.sh --apply --commit --push
#   ./scripts/repair-vm-and-git.sh --apply --prune-docker
#
# Deliberately NOT automated: kubectl delete, workload restarts, Longhorn/CNPG
# repair, database migrations against production, secret rotation, or firewall
# rule changes. Those require an operator to review the collected evidence.

set -Eeuo pipefail
IFS=$'\n\t'

BRANCH="arena/01a07584-caspmail"
REPO_DIR="${REPO_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
REPORT_DIR="${REPORT_DIR:-/var/tmp/caspmail-remediation-$(date -u +%Y%m%dT%H%M%SZ)}"
APPLY=0
COMMIT=0
PUSH=0
NPM_FIX=0
RESOLVE_LOCK=0
PRUNE_DOCKER=0
CLUSTER_SECRETS=0
ALLOW_DIRTY=0
SKIP_VM=0
SKIP_GIT=0

usage() {
  cat <<'EOF'
Usage: repair-vm-and-git.sh [options]

Mode:
  --plan                 Read-only checks (default)
  --apply                Enable non-destructive local/config changes

Git:
  --npm-fix              Run npm audit fix in backend and frontend
  --resolve-lock         Regenerate frontend/package-lock.json if it contains
                         Git conflict markers; package.json is the source of truth
  --commit               Commit changes after all local checks pass
  --push                 Push only arena/01a07584-caspmail to origin
  --allow-dirty          Allow an already dirty working tree (not recommended)

VM/Kubernetes:
  --prune-docker         After confirmation, prune unused Docker data only when
                         Docker has no containers. This does not touch containerd.
  --cluster-secrets      Create/update runtime-only SMTP/Stalwart secrets from
                         SMTP_PASSWORD. The value is never written to Git.
  --skip-vm              Do not run sudo, Docker or kubectl checks
  --skip-git             Do not run Git/npm checks

Examples:
  ./scripts/repair-vm-and-git.sh --plan
  ./scripts/repair-vm-and-git.sh --apply --npm-fix --commit
  SMTP_PASSWORD='read-from-a-secret-manager' ./scripts/repair-vm-and-git.sh \
    --apply --cluster-secrets
EOF
}

log()  { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
warn() { printf '[%s] WARNING: %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die()  { printf '[%s] ERROR: %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }

while (($#)); do
  case "$1" in
    --plan) APPLY=0 ;;
    --apply) APPLY=1 ;;
    --npm-fix) NPM_FIX=1 ;;
    --resolve-lock) RESOLVE_LOCK=1 ;;
    --commit) COMMIT=1 ;;
    --push) PUSH=1 ;;
    --prune-docker) PRUNE_DOCKER=1 ;;
    --cluster-secrets) CLUSTER_SECRETS=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --skip-vm) SKIP_VM=1 ;;
    --skip-git) SKIP_GIT=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
  shift
done

((PUSH && !COMMIT)) && die '--push requires --commit'
((COMMIT && !APPLY)) && die '--commit requires --apply'
((NPM_FIX && !APPLY)) && die '--npm-fix requires --apply'
((PRUNE_DOCKER && !APPLY)) && die '--prune-docker requires --apply'
((CLUSTER_SECRETS && !APPLY)) && die '--cluster-secrets requires --apply'

mkdir -p "$REPORT_DIR"

if ((SKIP_GIT == 0)); then
  need git
  need node
  need npm
  [[ -d "$REPO_DIR/.git" ]] || die "Not a Git checkout: $REPO_DIR"
  cd "$REPO_DIR"

  current_branch="$(git branch --show-current)"
  [[ "$current_branch" == "$BRANCH" ]] || die "Wrong branch: $current_branch (expected $BRANCH)"

  if [[ -n "$(git status --porcelain)" && "$ALLOW_DIRTY" != 1 ]]; then
    lock_only=1
    while IFS= read -r path; do
      [[ -z "$path" ]] && continue
      [[ "$path" == 'frontend/package-lock.json' ]] || lock_only=0
    done < <(git status --porcelain | sed -E 's/^.. //')
    if ! ((APPLY && RESOLVE_LOCK && lock_only)) || [[ ! -f frontend/package-lock.json ]]; then
      git status --short >&2
      die 'Working tree is already dirty; commit/stash it or use --allow-dirty'
    fi
    warn 'Only frontend/package-lock.json is conflicted; --resolve-lock will regenerate it from package.json'
  fi

  git status --short --branch | tee "$REPORT_DIR/git-status.txt"
  git log -1 --format='commit=%H%nauthor=%an%ndate=%aI%nsubject=%s' | tee "$REPORT_DIR/git-head.txt"
  git remote -v | tee "$REPORT_DIR/git-remotes.txt"
fi

run_yaml_check() {
  [[ -d "$REPO_DIR/backend/node_modules/yaml" ]] || {
    warn 'backend/node_modules/yaml is missing; skipping YAML parser check'
    return 0
  }
  node <<'NODE'
const fs = require('fs');
const YAML = require('./backend/node_modules/yaml');
const roots = ['k8s', 'observability'];
const files = [];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const name of fs.readdirSync(root)) {
    if (/\.ya?ml$/.test(name)) files.push(`${root}/${name}`);
  }
}
for (const name of ['argocd-app-caspermail.yaml', 'argocd-app-enterprise.yaml']) {
  if (fs.existsSync(name)) files.push(name);
}
let errors = 0;
for (const file of files) {
  try {
    for (const doc of YAML.parseAllDocuments(fs.readFileSync(file, 'utf8'))) {
      for (const error of doc.errors) {
        errors++;
        console.error(`${file}: ${error.message}`);
      }
    }
  } catch (error) {
    errors++;
    console.error(`${file}: ${error.message}`);
  }
}
console.log(`yaml_files=${files.length} yaml_errors=${errors}`);
if (errors) process.exit(1);
NODE
}

run_js_check() {
  local errors=0 file
  while IFS= read -r -d '' file; do
    if ! node --check "$file" >"$REPORT_DIR/node-check.err" 2>&1; then
      cat "$REPORT_DIR/node-check.err" >&2
      errors=$((errors + 1))
    fi
  done < <(find "$REPO_DIR/backend/src" "$REPO_DIR/backend/scripts" -type f -name '*.mjs' -print0)
  [[ "$errors" == 0 ]] || die "JavaScript syntax errors: $errors"
}

resolve_frontend_lockfile() {
  cd "$REPO_DIR"
  local lock='frontend/package-lock.json'
  [[ -f "$lock" ]] || return 0
  if ! grep -qE '^(<<<<<<<|=======|>>>>>>>)' "$lock"; then
    return 0
  fi
  ((APPLY && RESOLVE_LOCK)) || die "$lock contains Git conflict markers; rerun with --apply --resolve-lock"
  if grep -qE '^(<<<<<<<|=======|>>>>>>>)' frontend/package.json 2>/dev/null; then
    die 'frontend/package.json also contains Git conflict markers; resolve it before regenerating the lockfile'
  fi
  cp -p "$lock" "$REPORT_DIR/package-lock.conflicted.json"
  rm -f "$lock"
  log 'Regenerating frontend/package-lock.json from frontend/package.json'
  (cd frontend && npm install --package-lock-only --ignore-scripts)
  if grep -qE '^(<<<<<<<|=======|>>>>>>>)' "$lock"; then
    die "$lock still contains conflict markers after regeneration"
  fi
  git add "$lock"
}

apply_deterministic_git_fixes() {
  cd "$REPO_DIR"
  log 'Applying only deterministic, reviewable Git fixes'

  python3 - <<'PY'
from pathlib import Path

seed = Path('backend/scripts/seed_soc_enterprise.mjs')
s = seed.read_text()
s = s.replace(
    "SELECT id FROM tenants WHERE domain = $1",
    "SELECT id FROM tenants WHERE id = $1",
)
s = s.replace(
    "INSERT INTO tenants (name, domain) VALUES ($1, $2)",
    "INSERT INTO tenants (id, name) VALUES ($1, $2)",
)
s = s.replace(
    "['Acme Corp', TENANT_DOMAIN]",
    "[TENANT_DOMAIN, 'Acme Corp']",
)
old = "await client.query('DELETE FROM audit_log WHERE tenant_id = $1 AND action IN (''update_policy'', ''disable_user'', ''export_data'', ''login'', ''delete_user'')', [tenantId]);"
new = "await client.query(\"DELETE FROM audit_log WHERE tenant_id = $1 AND action IN ('update_policy', 'disable_user', 'export_data', 'login', 'delete_user')\", [tenantId]);"
if old in s:
    s = s.replace(old, new)
seed.write_text(s)

pool = Path('backend/src/db/pool.mjs')
s = pool.read_text()
if "import fs from 'node:fs';" not in s:
    s = "import fs from 'node:fs';\n" + s
s = s.replace("passwordExpiresAt = Date.now() + (1 * 1000);", "passwordExpiresAt = Date.now() + (5 * 60 * 1000);")
old = "ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false /* nosemgrep: problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification */ } : false,"
new = "ssl: process.env.DATABASE_SSL === 'true' ? {\n    rejectUnauthorized: true,\n    ...(process.env.DATABASE_CA_FILE ? { ca: fs.readFileSync(process.env.DATABASE_CA_FILE, 'utf8') } : {}),\n  } : false,"
if old in s:
    s = s.replace(old, new)
pool.write_text(s)

msg = Path('frontend/src/mail/workspaces/MessageDetail.jsx')
s = msg.read_text()
if "import DOMPurify from 'dompurify'" not in s:
    s = s.replace("import React, { useState, useEffect } from 'react'", "import React, { useState, useEffect } from 'react'\nimport DOMPurify from 'dompurify'")
s = s.replace(
    "dangerouslySetInnerHTML={{ __html: bodyText }}",
    "dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyText, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'svg', 'math'], FORBID_ATTR: ['style'] }) }}",
)
msg.write_text(s)

soc = Path('frontend/src/soc/SOCDashboard.jsx')
s = soc.read_text()
old = """          const toast = document.createElement('div');
          toast.className = 'soc-toast-success';
          toast.innerHTML = `<strong>SOAR Action:</strong> ${data.action} (${data.ip || ''}) <br>Triggered by: ${data.playbook}`;
          document.body.appendChild(toast);"""
new = """          const toast = document.createElement('div');
          toast.className = 'soc-toast-success';
          const title = document.createElement('strong');
          title.textContent = 'SOAR Action:';
          toast.append(title, document.createTextNode(` ${String(data.action || '')} (${String(data.ip || '')}) `));
          toast.append(document.createElement('br'), document.createTextNode(`Triggered by: ${String(data.playbook || '')}`));
          document.body.appendChild(toast);"""
if old in s:
    s = s.replace(old, new)
soc.write_text(s)

# Token query parameters are never accepted by the backend after this fix.
stream = Path('backend/src/routes/soc.mjs')
s = stream.read_text()
old = """  const socStreamGuard = {
    preHandler: async (req, reply) => {
      if (!req.headers.authorization && req.query?.token) {
        req.headers.authorization = `Bearer ${req.query.token}`;
      }
      return requireRole(SOC_ROLES)(req, reply);
    },
  };"""
new = """  const socStreamGuard = { preHandler: requireRole(SOC_ROLES) };"""
if old in s:
    s = s.replace(old, new)
stream.write_text(s)
PY

  # The generated embedded backend code is not a supported deployment source.
  # The image already contains backend/src and must use that single source of truth.
  if [[ -f k8s/backend-configs.yaml ]]; then
    git rm k8s/backend-configs.yaml
  fi

  python3 - <<'PY'
from pathlib import Path
import re

p = Path('k8s/backend.yaml')
s = p.read_text()
  s = s.replace("        - name: DATABASE_SSL\n          value: 'false'", "        - name: DATABASE_SSL\n          value: 'true'\n        - name: DATABASE_CA_FILE\n          value: /etc/caspermail/db-ca/ca.crt")
  s = s.replace("        - name: SMTP_PASS\n          value: admin_secure_password_123", "        - name: SMTP_PASS\n          valueFrom:\n            secretKeyRef:\n              name: casper-smtp\n              key: password")
# Remove all mounts and volumes which referenced the deleted generated ConfigMaps.
s = re.sub(r"\n        - mountPath: /app/src/(?:routes|services|db)/[^\n]+\n          name: patch-[^\n]+\n          subPath: [^\n]+", "", s)
s = re.sub(r"\n      - configMap:\n          name: backend-[^\n]+\n        name: patch-[^\n]+", "", s)
# CNPG creates this CA secret for the cluster. TLS is fail-closed if it is absent.
needle = "        - mountPath: /tmp\n          name: tmp\n"
if needle in s and "name: db-ca" not in s:
    s = s.replace(needle, needle + "        - mountPath: /etc/caspermail/db-ca\n          name: db-ca\n          readOnly: true\n")
needle = "      - name: secrets\n        secret:\n          secretName: casper-secrets\n"
if needle in s and "secretName: casper-cnpg-ca" not in s:
    s = s.replace(needle, needle + "      - name: db-ca\n        secret:\n          secretName: casper-cnpg-ca\n          items:\n          - key: ca.crt\n            path: ca.crt\n")
p.write_text(s)

p = Path('k8s/stalwart.yaml')
s = p.read_text()
s = s.replace('auth-require = false', 'auth-require = true')
s = s.replace("        - name: STALWART_ADMIN_PASSWORD\n          value: admin_secure_password_123", "        - name: STALWART_ADMIN_PASSWORD\n          valueFrom:\n            secretKeyRef:\n              name: casper-stalwart-admin\n              key: password")
# Do not use an ephemeral memory filesystem for mail data.
s = s.replace("      - name: stalwart-data-ram\n        emptyDir:\n          medium: Memory\n          sizeLimit: 1Gi", "      - name: stalwart-data\n        persistentVolumeClaim:\n          claimName: stalwart-data")
s = s.replace('name: stalwart-data-ram', 'name: stalwart-data')
if 'kind: PersistentVolumeClaim' not in s:
    s += """\n---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: stalwart-data
  namespace: caspmail-enterprise
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 20Gi
"""
p.write_text(s)

p = Path('k8s/frontend.yaml')
s = p.read_text()
if 'kind: Service' not in s:
    s += """\n---
apiVersion: v1
kind: Service
metadata:
  name: casper-frontend
  namespace: caspmail-enterprise
spec:
  selector:
    app: frontend
  ports:
  - name: http
    port: 80
    targetPort: 8080
"""
p.write_text(s)

p = Path('k8s/namespace.yaml')
s = p.read_text()
if 'name: caspmail-enterprise' not in s:
    s += """\n---
apiVersion: v1
kind: Namespace
metadata:
  name: caspmail-enterprise
"""
p.write_text(s)

# Make security CI blocking instead of reporting success on failure.
for name in ['.github/workflows/security.yml', '.github/workflows/docker.yml', '.github/workflows/trivy.yaml']:
    p = Path(name)
    s = p.read_text()
    s = s.replace('        continue-on-error: true\n', '')
    s = s.replace('        continue-on-error: true # Usually we want to block, but for a legacy repo it might need baselining\n', '')
    s = s.replace('run: npm audit --audit-level=high || true', 'run: npm audit --audit-level=high')
    s = s.replace("          exit-code: '0'", "          exit-code: '1'")
    s = s.replace('aquasecurity/trivy-action@master', 'aquasecurity/trivy-action@c07df6fec6fa692e6fd1200d50aaa1fdd66f03c8')
    p.write_text(s)
PY

  git diff --check
}

run_git_checks() {
  cd "$REPO_DIR"
  run_js_check
  run_yaml_check
  git diff --check

  if ((NPM_FIX)); then
    log 'Applying npm audit fixes (package manifests and lockfiles may change)'
    (cd backend && npm audit fix)
    (cd frontend && npm audit fix)
  fi

  log 'Running backend npm audit'
  set +e
  (cd backend && npm audit --audit-level=high) | tee "$REPORT_DIR/npm-audit-backend.txt"
  backend_audit_rc=${PIPESTATUS[0]}
  log 'Running frontend npm audit'
  (cd frontend && npm audit --audit-level=high) | tee "$REPORT_DIR/npm-audit-frontend.txt"
  frontend_audit_rc=${PIPESTATUS[0]}
  set -e
  if ((backend_audit_rc != 0 || frontend_audit_rc != 0)); then
    warn "npm audit still reports high/critical vulnerabilities (backend=$backend_audit_rc frontend=$frontend_audit_rc)"
    ((COMMIT)) && die 'Refusing to commit while high/critical npm vulnerabilities remain'
  fi

  log 'Building frontend'
  (cd frontend && npm run build) | tee "$REPORT_DIR/frontend-build.txt"

  # These are fail-closed checks for the two most dangerous regressions.
  if grep -R -n --exclude-dir=node_modules --exclude-dir=dist \
      "dangerouslySetInnerHTML\|toast\.innerHTML\|/stream?token=" \
      frontend/src; then
    die 'Unsafe rendered HTML or token query-string pattern remains in frontend/src'
  fi
  if grep -R -n --exclude='backend-configs.yaml' \
      "rejectUnauthorized: false\|DATABASE_SSL.*false\|auth-require = false" \
      backend/src k8s 2>/dev/null; then
    die 'TLS/auth bypass pattern remains'
  fi
}

run_vm_report() {
  need sudo
  need df
  need awk
  sudo -v
  log 'Collecting host disk/resource report'
  {
    date -u
    hostnamectl 2>/dev/null || hostname
    df -hP
    printf '\nJournal usage:\n'
    sudo journalctl --disk-usage || true
    printf '\nFailed units:\n'
    sudo systemctl --failed --no-legend || true
    printf '\nListening sockets:\n'
    sudo ss -lntup || true
    printf '\nUFW:\n'
    sudo ufw status verbose || true
    printf '\nDocker disk usage:\n'
    docker system df 2>/dev/null || true
    printf '\nKubernetes nodes:\n'
    kubectl get nodes -o wide 2>/dev/null || true
    printf '\nKubernetes PVCs:\n'
    kubectl get pvc -A 2>/dev/null || true
    printf '\nCNPG/Longhorn pods:\n'
    kubectl get pods -A -o wide 2>/dev/null | grep -Ei 'cnpg|longhorn' || true
  } | tee "$REPORT_DIR/vm-report.txt"

  log 'Collecting size breakdowns (read-only)'
  sudo du -xhd1 /var /var/lib /var/log /var/cache 2>/dev/null | sort -h \
    | tee "$REPORT_DIR/var-size.txt" || true
  sudo du -xhd1 /var/lib/containerd /var/lib/rancher /var/lib/longhorn 2>/dev/null \
    | sort -h | tee "$REPORT_DIR/k3s-storage-size.txt" || true

  if command -v auditctl >/dev/null 2>&1; then
    sudo auditctl -s | tee "$REPORT_DIR/auditd-status.txt" || true
  fi
}

prune_docker() {
  ((PRUNE_DOCKER)) || return 0
  need docker
  [[ -z "$(docker ps -aq)" ]] || die 'Docker has containers; refusing automatic prune'
  docker system df | tee "$REPORT_DIR/docker-before-prune.txt"
  read -r -p 'Delete unused Docker images/build cache? Type PRUNE-DOCKER: ' answer
  [[ "$answer" == 'PRUNE-DOCKER' ]] || die 'Docker prune cancelled'
  docker image prune -af
  docker builder prune -af
  docker system df | tee "$REPORT_DIR/docker-after-prune.txt"
}

create_cluster_secrets() {
  ((CLUSTER_SECRETS)) || return 0
  need kubectl
  [[ -n "${SMTP_PASSWORD:-}" ]] || die '--cluster-secrets requires SMTP_PASSWORD in the environment'
  [[ "${#SMTP_PASSWORD}" -ge 20 ]] || die 'SMTP_PASSWORD must contain at least 20 characters'
  read -r -p 'Create/update runtime-only SMTP and Stalwart secrets in caspmail-enterprise? Type CREATE-RUNTIME-SECRETS: ' answer
  [[ "$answer" == 'CREATE-RUNTIME-SECRETS' ]] || die 'Secret creation cancelled'
  kubectl -n caspmail-enterprise create secret generic casper-smtp \
    --from-literal=password="$SMTP_PASSWORD" --dry-run=client -o yaml | kubectl apply -f -
  kubectl -n caspmail-enterprise create secret generic casper-stalwart-admin \
    --from-literal=password="$SMTP_PASSWORD" --dry-run=client -o yaml | kubectl apply -f -
  log 'Runtime secrets created; plaintext was not written to Git or the report'
}

commit_and_push() {
  ((COMMIT)) || return 0
  cd "$REPO_DIR"
  git diff --check
  [[ -n "$(git status --porcelain)" ]] || die 'No Git changes to commit'
  git add scripts/repair-vm-and-git.sh \
    backend/scripts/seed_soc_enterprise.mjs \
    backend/src/db/pool.mjs backend/src/routes/soc.mjs \
    frontend/src/mail/workspaces/MessageDetail.jsx \
    frontend/src/soc/SOCDashboard.jsx \
    k8s .github/workflows
  git status --short
  git diff --cached --check
  git commit -m 'security: remove deploy drift and harden runtime defaults'
  if ((PUSH)); then
    git push origin "$BRANCH"
  fi
}

log "Report directory: $REPORT_DIR"
if ((SKIP_GIT == 0)); then
  if ((APPLY)); then
    resolve_frontend_lockfile
    apply_deterministic_git_fixes
  else
    if [[ -f frontend/package-lock.json ]] && grep -qE '^(<<<<<<<|=======|>>>>>>>)' frontend/package-lock.json; then
      warn 'frontend/package-lock.json contains Git conflict markers; use --apply --resolve-lock'
    fi
    log 'Plan mode: Git files will not be modified'
  fi
  run_git_checks
fi

if ((SKIP_VM == 0)); then
  run_vm_report
  if ((APPLY)); then
    prune_docker
    create_cluster_secrets
  else
    log 'Plan mode: no Docker cleanup, secret creation or service changes'
  fi
fi

if ((APPLY)); then
  commit_and_push
fi

log 'Completed. Review reports under: '"$REPORT_DIR"
cat <<EOF

Important manual actions still required:
  - review tenant authorization and database migration coverage;
  - rotate credentials already exposed in Git and re-encrypt SealedSecrets;
  - validate the CNPG CA secret name before applying backend.yaml;
  - review CNPG/Longhorn failures and backups before any restart/delete;
  - configure an authenticated, memory-safe browser token flow before production.
EOF

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CaspMail — Deploy su Ubuntu
#
# Installa Docker, configura secrets, genera TLS self-signed,
# fa il build del frontend, avvia Docker Compose e configura Keycloak.
#
# Uso:
#   sudo bash deploy.sh
#
# Variabili opzionali (export prima di eseguire):
#   CASPERMAIL_DIR    — path dove sta il progetto (default: ~/caspmail/new)
#   FIRST_ADMIN_EMAIL — email primo utente admin da creare in Keycloak
#   FIRST_ADMIN_PASS  — password primo utente admin
#   DOMAIN            — dominio principale (default: secure.internal)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_DIR="${CASPERMAIL_DIR:-$HOME/caspmail/new}"
SECRETS_DIR="/opt/caspermail/runtime-secrets"
DOMAIN="${DOMAIN:-secure.internal}"
FIRST_ADMIN_EMAIL="${FIRST_ADMIN_EMAIL:-}"
FIRST_ADMIN_PASS="${FIRST_ADMIN_PASS:-}"

log()  { echo -e "\e[36m[deploy]\e[0m $*"; }
ok()   { echo -e "\e[32m[deploy]\e[0m ✓ $*"; }
warn() { echo -e "\e[33m[deploy]\e[0m ⚠ $*"; }
err()  { echo -e "\e[31m[deploy]\e[0m ✗ $*" >&2; exit 1; }

# ── Verifica root ─────────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || err "Esegui con sudo: sudo bash deploy.sh"

# ── Verifica directory progetto ───────────────────────────────────────────────
[ -d "$PROJECT_DIR" ] || err "Directory progetto non trovata: $PROJECT_DIR"
cd "$PROJECT_DIR"
log "Project dir: $PROJECT_DIR"

# ── Installa dipendenze di sistema ────────────────────────────────────────────
log "Checking system dependencies..."

if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  ok "Docker installed."
else
  ok "Docker already installed: $(docker --version)"
fi

if ! docker compose version &>/dev/null 2>&1; then
  log "Installing Docker Compose plugin..."
  apt-get install -y docker-compose-plugin
  ok "Docker Compose installed."
else
  ok "Docker Compose already installed."
fi

if ! command -v node &>/dev/null; then
  log "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  ok "Node.js installed: $(node --version)"
else
  ok "Node.js already installed: $(node --version)"
fi

# ── Crea secrets ──────────────────────────────────────────────────────────────
log "Setting up secrets in ${SECRETS_DIR}..."
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

gen_password() {
  openssl rand -base64 32 | tr -d '/+=' | head -c 40
}

create_secret() {
  local name="$1"
  local path="${SECRETS_DIR}/${name}"
  if [ -f "$path" ]; then
    warn "Secret ${name} already exists — skipping (delete to regenerate)."
  else
    gen_password > "$path"
    chmod 600 "$path"
    ok "Secret generated: ${name}"
  fi
}

create_secret "postgres_password"
create_secret "redis_password"
create_secret "keycloak_admin_password"

# ── TLS certificate (self-signed per ambiente locale) ─────────────────────────
SSL_DIR="${PROJECT_DIR}/nginx/ssl"
mkdir -p "$SSL_DIR"

if [ -f "${SSL_DIR}/fullchain.pem" ] && [ -f "${SSL_DIR}/privkey.pem" ]; then
  warn "SSL certificates already exist — skipping."
else
  log "Generating self-signed TLS certificate for *.${DOMAIN}..."
  openssl req -x509 -nodes -days 3650 \
    -newkey rsa:4096 \
    -keyout "${SSL_DIR}/privkey.pem" \
    -out    "${SSL_DIR}/fullchain.pem" \
    -subj   "/CN=${DOMAIN}/O=CaspMail/C=IT" \
    -addext "subjectAltName=DNS:${DOMAIN},DNS:auth.${DOMAIN},DNS:mail.${DOMAIN},DNS:soc.${DOMAIN}"
  chmod 600 "${SSL_DIR}/privkey.pem"
  chmod 644 "${SSL_DIR}/fullchain.pem"
  ok "TLS certificate generated (self-signed, 10 years)."
  warn "For production, replace with a real certificate in ${SSL_DIR}/"
fi

# ── Build frontend ────────────────────────────────────────────────────────────
FRONTEND_DIR="${PROJECT_DIR}/frontend"
log "Building frontend..."

cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  log "Installing frontend dependencies..."
  npm install
fi
npm run build
ok "Frontend built → ${FRONTEND_DIR}/dist"
cd "$PROJECT_DIR"

# ── Avvia Docker Compose ──────────────────────────────────────────────────────
log "Starting Docker Compose stack..."
docker compose pull --quiet 2>/dev/null || true
docker compose build --quiet
docker compose up -d

ok "Stack avviato. Waiting for services to be healthy..."

# ── Attesa healthcheck ────────────────────────────────────────────────────────
wait_healthy() {
  local container="$1"
  local max_wait="${2:-120}"
  local interval=5
  local elapsed=0
  log "Waiting for ${container} to be healthy (max ${max_wait}s)..."
  while [ $elapsed -lt $max_wait ]; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ]; then
      ok "${container} is healthy."
      return 0
    fi
    sleep $interval
    elapsed=$((elapsed + interval))
  done
  warn "${container} did not become healthy in ${max_wait}s. Check: docker logs ${container}"
  return 1
}

wait_healthy casper-postgres 60
wait_healthy casper-keycloak 180
wait_healthy casper-backend  90

# ── Setup Keycloak realm ──────────────────────────────────────────────────────
log "Running Keycloak realm setup..."
export KC_HOST="http://localhost:8080"
export KC_ADMIN_PASS
KC_ADMIN_PASS=$(cat "${SECRETS_DIR}/keycloak_admin_password")
export FRONTEND_URL="https://${DOMAIN}"
export FIRST_ADMIN_EMAIL
export FIRST_ADMIN_PASS

bash "${PROJECT_DIR}/scripts/setup-keycloak.sh"

# ── /etc/hosts per ambiente locale ───────────────────────────────────────────
log "Configuring /etc/hosts for local domain resolution..."
HOSTS_ENTRY="127.0.0.1  ${DOMAIN} auth.${DOMAIN} mail.${DOMAIN} soc.${DOMAIN}"
if grep -qF "$DOMAIN" /etc/hosts; then
  warn "/etc/hosts already has entries for ${DOMAIN} — skipping."
else
  echo "$HOSTS_ENTRY" >> /etc/hosts
  ok "Added to /etc/hosts: ${HOSTS_ENTRY}"
fi

# ── Riepilogo ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  CaspMail deployed successfully!"
echo ""
echo "  URLs:"
echo "    Mail Console  → https://${DOMAIN}/console/"
echo "    SOC Dashboard → https://${DOMAIN}/console/soc"
echo "    Admin Panel   → https://${DOMAIN}/console/admin"
echo "    Login Page    → https://${DOMAIN}/console/login"
echo "    Keycloak      → https://auth.${DOMAIN}"
echo ""
echo "  Keycloak admin (master realm):"
echo "    URL:      http://localhost:8080/admin"
echo "    User:     admin"
echo "    Password: $(cat ${SECRETS_DIR}/keycloak_admin_password)"
echo ""
echo "  Secrets dir: ${SECRETS_DIR}"
echo "  TLS cert:    ${SSL_DIR}/fullchain.pem (self-signed)"
echo ""
if [ -n "$FIRST_ADMIN_EMAIL" ]; then
echo "  First admin user:"
echo "    Email:    ${FIRST_ADMIN_EMAIL}"
echo "    Password: ${FIRST_ADMIN_PASS}"
echo ""
fi
echo "  NOTE: Browser may warn about self-signed cert. Add"
echo "  ${SSL_DIR}/fullchain.pem to trusted CAs to suppress."
echo "════════════════════════════════════════════════════════════"

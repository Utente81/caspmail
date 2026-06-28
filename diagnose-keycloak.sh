#!/usr/bin/env bash
# CaspMail — diagnosi e fix Keycloak unhealthy
set -euo pipefail

echo "=== DIAGNOSI ==="
echo "PWD: $(pwd)"
echo ""

# 1. Verifica realm file
echo "[1] Realm JSON:"
if [ -f "keycloak/caspermail-realm.json" ]; then
  echo "    OK — $(wc -c < keycloak/caspermail-realm.json) bytes"
else
  echo "    MANCANTE — keycloak/caspermail-realm.json non trovato"
  echo ""
  echo "    Cerca realm in altri path..."
  find / -name "caspermail-realm.json" 2>/dev/null | grep -v proc | head -5
fi

echo ""

# 2. Verifica secrets
echo "[2] Docker secrets:"
docker secret ls 2>/dev/null | grep -E "keycloak|postgres" || echo "    (docker swarm secrets non in uso — ok per compose)"
echo "    /run/secrets nel container:"
docker compose exec keycloak ls /run/secrets/ 2>/dev/null || echo "    (container non raggiungibile)"

echo ""

# 3. Log Keycloak
echo "[3] Ultimi errori Keycloak:"
docker logs casper-keycloak 2>&1 | grep -iE "error|fatal|exception|realm|import" | tail -20

echo ""

# 4. Healthcheck manuale
echo "[4] Healthcheck manuale Keycloak:"
docker inspect casper-keycloak --format='Status: {{.State.Status}} | Health: {{.State.Health.Status}}' 2>/dev/null
echo "    Test HTTP:"
docker exec casper-keycloak curl -sf http://localhost:9000/health/ready 2>/dev/null && echo "    READY" || echo "    NOT READY"

echo ""

# 5. Tabelle DB mancanti
echo "[5] Tabella soc_actions nel DB:"
docker exec casper-postgres psql -U caspermail -d caspermail \
  -c "SELECT to_regclass('public.soc_actions');" 2>/dev/null || echo "    (postgres non raggiungibile)"

echo ""
echo "=== VERIFICA DIRECTORY ==="
echo "Realm nel repo corrente:"
ls -la keycloak/ 2>/dev/null || echo "  directory keycloak/ non trovata in $(pwd)"

echo ""
echo "=== SUGGERIMENTO ==="
echo "Se sei in ~/caspmail/new ma il realm è in ~/caspmail-main, esegui:"
echo "  cp ~/caspmail-main/keycloak/caspermail-realm.json ./keycloak/"
echo "  docker compose restart keycloak"

#!/usr/bin/env bash
set -euo pipefail

REALM="caspermail"
FRONTEND_URL="${FRONTEND_URL:-https://secure.internal}"
FIRST_ADMIN_EMAIL="${FIRST_ADMIN_EMAIL:-}"
FIRST_ADMIN_PASS="${FIRST_ADMIN_PASS:-}"
FIRST_ADMIN_NAME="${FIRST_ADMIN_NAME:-Platform Admin}"
KC_ADMIN_PASS="$(cat /opt/caspermail/runtime-secrets/keycloak_admin_password)"
KCADM="docker exec casper-keycloak /opt/keycloak/bin/kcadm.sh"

echo "[kc-setup] Authenticating..."
$KCADM config credentials --server http://localhost:8080 --realm master --user admin --password "$KC_ADMIN_PASS"
echo "[kc-setup] OK."

$KCADM create realms -s realm="$REALM" -s displayName="CaspMail" -s enabled=true -s sslRequired=external -s bruteForceProtected=true -s accessTokenLifespan=300 -s ssoSessionIdleTimeout=1800 2>&1 | grep -v "already exists" || true
echo "[kc-setup] Realm ready."

for role in admin casper_admin soc_analyst soc_manager user; do
  $KCADM create roles -r "$REALM" -s name="$role" 2>&1 | grep -v "already exists" || true
done
echo "[kc-setup] Roles ready."

mk_client() {
  local cid="$1" ruri="$2" ori="$3"
  $KCADM create clients -r "$REALM" \
    -s clientId="$cid" -s enabled=true -s publicClient=true -s standardFlowEnabled=true \
    -s 'redirectUris=["'"$ruri"'"]' -s 'webOrigins=["'"$ori"'"]' \
    -s 'attributes={"pkce.code.challenge.method":"S256","access.token.lifespan":"300"}' \
    -s protocol=openid-connect 2>&1 | grep -v "already exists" || true

  local uuid
  uuid=$($KCADM get clients -r "$REALM" --fields id,clientId 2>/dev/null \
    | python3 -c "import sys,json; cls=json.load(sys.stdin); print(next(c['id'] for c in cls if c.get('clientId')=='$cid'))" 2>/dev/null || true)
  [ -z "$uuid" ] && { echo "[kc-setup] Warning: could not get UUID for $cid"; return; }

  $KCADM create clients/"$uuid"/protocol-mappers/models -r "$REALM" \
    -s name=email -s protocol=openid-connect -s protocolMapper=oidc-usermodel-attribute-mapper \
    -s 'config={"user.attribute":"email","claim.name":"email","jsonType.label":"String","id.token.claim":"true","access.token.claim":"true","userinfo.token.claim":"true"}' \
    2>&1 | grep -v "already exists" || true

  $KCADM create clients/"$uuid"/protocol-mappers/models -r "$REALM" \
    -s name=realm-roles -s protocol=openid-connect -s protocolMapper=oidc-usermodel-realm-role-mapper \
    -s 'config={"claim.name":"roles","jsonType.label":"String","multivalued":"true","id.token.claim":"true","access.token.claim":"true","userinfo.token.claim":"true"}' \
    2>&1 | grep -v "already exists" || true

  echo "[kc-setup] + client: $cid ($uuid)"
}

mk_client "caspermail-web"   "${FRONTEND_URL}/console/*"       "${FRONTEND_URL}"
mk_client "caspermail-soc"   "${FRONTEND_URL}/console/soc*"    "${FRONTEND_URL}"
mk_client "caspermail-admin" "${FRONTEND_URL}/console/admin*"  "${FRONTEND_URL}"

if [ -n "$FIRST_ADMIN_EMAIL" ] && [ -n "$FIRST_ADMIN_PASS" ]; then
  $KCADM create users -r "$REALM" -s username="$FIRST_ADMIN_EMAIL" -s email="$FIRST_ADMIN_EMAIL" -s "firstName=$FIRST_ADMIN_NAME" -s enabled=true -s emailVerified=true 2>&1 | grep -v "already exists" || true
  $KCADM set-password -r "$REALM" --username "$FIRST_ADMIN_EMAIL" --new-password "$FIRST_ADMIN_PASS" --temporary false || true
  for role in admin casper_admin user; do
    $KCADM add-roles -r "$REALM" --uusername "$FIRST_ADMIN_EMAIL" --rolename "$role" || true
  done
  echo "[kc-setup] Admin user: $FIRST_ADMIN_EMAIL"
fi

echo "[kc-setup] Setup complete! Realm: $REALM | Clients: caspermail-web/soc/admin"

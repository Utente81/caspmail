const ISSUER = 'https://auth.secure.internal/realms/caspermail';

export function logout(clientId) {
  const idToken = sessionStorage.getItem('caspmail_id_token');
  const resolvedClientId = clientId || sessionStorage.getItem('caspmail_client_id') || 'caspermail-web';
  sessionStorage.clear();

  const params = new URLSearchParams({
    client_id: resolvedClientId,
    post_logout_redirect_uri: window.location.origin + '/console/login',
  });

  if (idToken) params.set('id_token_hint', idToken);

  window.location.href = ISSUER + '/protocol/openid-connect/logout?' + params;
}

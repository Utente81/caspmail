const ISSUER = 'https://auth.caspmail.com/realms/caspermail';

export function logout(clientId) {
  const idToken = window.memoryStorage.getItem('caspmail_id_token');
  const resolvedClientId = clientId || window.memoryStorage.getItem('caspmail_client_id') || 'caspermail-web';
  window.memoryStorage.clear();

  const params = new URLSearchParams({
    client_id: resolvedClientId,
    post_logout_redirect_uri: window.location.origin + '/console/login',
  });

  if (idToken) params.set('id_token_hint', idToken);

  window.location.href = ISSUER + '/protocol/openid-connect/logout?' + params;
}

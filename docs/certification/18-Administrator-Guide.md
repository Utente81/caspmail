# Documento 18 – Administrator Guide

Questa guida è pensata per i Tenant Administrators (Amministratori di Dominio) delegati alla gestione della piattaforma CasperMail per la propria organizzazione (es. l'azienda cliente).

## 1. Accesso alla Console di Amministrazione
L'accesso alla console di amministrazione è subordinato a stringenti controlli di sicurezza:
1. Navigare su `https://mail.secure.internal/admin`.
2. Verrà richiesto il login tramite l'Identity Provider (Keycloak).
3. **MFA Obbligatoria:** Inserire le credenziali base e autenticarsi successivamente tramite un token FIDO2/WebAuthn (es. YubiKey) o tramite app Authenticator (TOTP), a seconda della policy del tenant.

## 2. Gestione degli Utenti (User Lifecycle)
### Creazione Utente
- Accedere alla sezione "Users" nella console Admin.
- Cliccare "Add User", inserendo email e dettagli base.
- Per motivi di sicurezza, CasperMail **non supporta** l'invio della password temporanea in chiaro via email. Verrà generato un link di *First-Time Setup* che scade dopo 24 ore. L'utente dovrà usarlo per impostare la propria password in autonomia.

### Disabilitazione Utente (Offboarding)
Quando un dipendente lascia l'azienda, è imperativo disabilitare l'account istantaneamente per bloccare l'accesso ai dati aziendali.
- Trovare l'utente nella lista e marcare lo status come **Disabled**. Questo causerà l'immediata revoca dei token di sessione attivi in backend, disconnettendo l'utente da tutti i dispositivi (Web, Mobile, Desktop).

## 3. Gestione degli Alias
Gli Alias (es. `info@azienda.com` verso `mario.rossi@azienda.com`) possono essere configurati nella sezione "Aliases".
- **Limitazione:** Un amministratore di tenant può creare alias *esclusivamente* per i domini di cui è proprietario.

## 4. Audit Log View
Gli amministratori hanno accesso in sola lettura agli audit log del proprio tenant per investigare attività sospette:
- La vista Audit espone eventi come: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `PASSWORD_RESET`, `MAIL_EXPORTED`.
- In caso di violazioni sistematiche (es. ripetuti `LOGIN_FAILED` da geolocalizzazioni anomale), l'amministratore deve inoltrare la segnalazione al SOC o bloccare l'IP/Utente.

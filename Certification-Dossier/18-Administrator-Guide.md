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

## 5. Mobile Device Management (MDM) e App Mobile
CasperMail supporta nativamente flotte di dispositivi aziendali (BYOD o Company-Owned).

### Endpoint MDM e Policy
L'accesso alla dashboard MDM permette di:
- Definire policy di sicurezza sui dispositivi registrati (es. blocco screenshot, forzatura dell'autenticazione biometrica prima dell'apertura dell'app).
- Inviare comandi remoti come il "Remote Wipe" dei dati della cache in caso di smarrimento del dispositivo aziendale.

### Build dell'App Mobile (Enterprise Distribution)
L'applicazione non è pubblicata sugli store pubblici (App Store / Google Play) per impostazione predefinita. L'organizzazione deve compilarla e distribuirla internamente:
1. Clonare il repository `caspmail-mobile`.
2. Eseguire il login al servizio di compilazione cloud (es. `eas login`).
3. Generare la build: `eas build --profile production --platform all`.
4. Una volta generati i file `.aab` (Android) e `.ipa` (iOS), è possibile farne il deployment attraverso l'infrastruttura MDM (es. Microsoft Intune, VMware Workspace ONE) sui dispositivi dei dipendenti.

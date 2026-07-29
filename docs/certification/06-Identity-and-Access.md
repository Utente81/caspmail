# Documento 6 – Identity & Access Management (IAM)

La gestione dell'identità in CasperMail centralizza l'autenticazione e l'autorizzazione garantendo sicurezza, scalabilità e auditabilità per ogni entità che interagisce con il sistema (utenti umani, servizi o amministratori).

## 1. Architettura IAM Centralizzata
Il cuore del sistema IAM è **Keycloak**, un prodotto open-source enterprise-grade. Questo disaccoppia la gestione degli utenti dalla logica di business dell'applicazione (Backend).
- **Single Sign-On (SSO):** L'utente si autentica una sola volta per accedere a WebMail, Console SOC, e Pannello Amministrativo.
- **Protocolli Supportati:** Le applicazioni comunicano con Keycloak tramite **OpenID Connect (OIDC)** e **OAuth 2.0**.

## 2. Autenticazione (Authentication)

### 2.1 Multi-Factor Authentication (MFA)
Per rispondere ai requisiti stringenti di conformità, CasperMail supporta nativamente l'MFA.
- **FIDO2 / WebAuthn:** L'autenticazione primaria o secondaria può essere delegata a chiavette hardware (YubiKey) o sensori biometrici del dispositivo (Windows Hello, TouchID, FaceID). Questo annulla il rischio di Phishing (Phishing-resistant MFA).
- **Adaptive Access:** Keycloak monitora l'indirizzo IP, il fingerprint del browser e la geolocalizzazione per attivare sfide aggiuntive se rileva contesti di accesso anomali o "Impossible Travel".

### 2.2 Password Policy
Le policy per le credenziali tradizionali sono configurate secondo lo standard NIST:
- Lunghezza minima: 12 caratteri.
- Complessità: Alfanumerica con simboli obbligatori.
- Divieto di riutilizzo delle ultime 5 password.
- Controllo automatico contro dizionari di password compromesse (Pwned Passwords).

## 3. Autorizzazione (Authorization)

### 3.1 Role-Based Access Control (RBAC)
Le autorizzazioni sono gestite tramite il controllo degli accessi basato sui ruoli.
I ruoli base (Realm Roles) sono:
- `user`: Utente standard, può leggere e inviare le proprie email.
- `admin`: Amministratore di sistema, può gestire alias, configurazioni e utenti.
- `auditor` / `soc_analyst`: Profilo in sola lettura con accesso limitato alle dashboard di sicurezza in Grafana e ai log in Loki.

### 3.2 Groups & Tenant Isolation
Gli utenti sono strutturati in **Groups**. 
Ogni utente appartiene al gruppo del proprio dominio (Tenant), es. `Group: secure.internal`. Questo garantisce isolamento multi-tenant:
- Le API del backend estraggono l'appartenenza al gruppo dal Token JWT.
- Tutte le query SQL sul database sono filtrate applicando un predicato legato al tenant dell'utente che invoca l'operazione, prevenendo *Insecure Direct Object Reference (IDOR)*.

## 4. Gestione dei Token (OAuth2 / OIDC)
La fiducia tra Backend e Keycloak è stabilita crittograficamente tramite JWT.

### 4.1 Access Token (Short-lived)
- Durata massima: **5 minuti**.
- Contiene i *Claims* essenziali (ruoli, email, dominio).
- Il backend lo valida offline verificando la firma RS256 usando le chiavi pubbliche (JWKS) fornite da Keycloak.

### 4.2 Refresh Token
- Durata massima: **30 minuti** (idle) / **8 ore** (absolute timeout).
- Viene utilizzato per negoziare un nuovo Access Token senza richiedere nuovamente le credenziali.
- Può essere revocato immediatamente dal pannello Keycloak in caso di furto o compromissione del dispositivo.

## 5. Audit & Compliance IAM
Ogni evento di Identity and Access è rigorosamente tracciato.
- **Login success/failure**, aggiornamenti profilo, reset password e modifiche RBAC vengono registrati e inviati (tramite Promtail) al SIEM (Loki/Grafana).
- Questo fornisce l'evidenza richiesta per gli audit ISO27001 (Control A.9 - Access Control).

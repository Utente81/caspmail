# Documento 3 – Security Architecture

La Security Architecture di CasperMail è progettata seguendo i più rigorosi standard del settore Enterprise, garantendo la massima protezione per le informazioni trattate. Questo documento dettaglia i principi fondamentali, i meccanismi crittografici, e i pattern architetturali implementati.

## 1. Principi Fondamentali

### 1.1 Zero Trust Architecture
CasperMail adotta un paradigma **Zero Trust (Never Trust, Always Verify)**. 
- **Nessun perimetro fidato:** Ogni comunicazione, interna o esterna, deve essere autenticata e criptata.
- **Micro-segmentazione:** I container comunicano tramite *Kubernetes Network Policies* restrittive (Default Deny).
- **Mutua Autenticazione:** Traefik, Keycloak, e Vault utilizzano pattern TLS rigidi.

### 1.2 Defense in Depth
La difesa in profondità è applicata su multipli layer:
- **Layer 7 (Application):** WAF su Traefik, validazione degli input rigorosa in Node.js, e scansione degli allegati con ClamAV.
- **Layer 4 (Transport):** TLS 1.2/1.3 obbligatorio ovunque.
- **Layer 3 (Network):** Firewall a livello di nodo (iptables/Cilium), isolamento del namespace Kubernetes.
- **Layer Dati (Storage):** Crittografia at-rest tramite HashiCorp Vault.

### 1.3 Principio del Privilegio Minimo (Least Privilege)
- Ogni pod Kubernetes esegue i processi come utente *non-root*.
- Vault gestisce i token con scope limitati: il backend Node.js possiede un token capace solo di invocare l'endpoint `encrypt/decrypt` (Transit Engine) specifico per l'applicazione, e non può esportare la chiave master.
- I permessi sul database PostgreSQL (CloudNativePG) sono partizionati per tenant/servizio.

## 2. Gestione dell'Identità e degli Accessi

### 2.1 Role-Based Access Control (RBAC)
Keycloak agisce come sistema centralizzato per l'Identity and Access Management (IAM). 
- I ruoli sono definiti rigidamente (es. `Admin`, `User`, `Auditor`).
- Il Backend estrae le *Roles Claims* dal token JWT verificandone la validità a ogni singola transazione API.

### 2.2 Autenticazione a più fattori (MFA) e WebAuthn
La piattaforma forza l'utilizzo di MFA per gli accessi sensibili (es. pannello amministratore o SOC). 
- Implementazione del protocollo **FIDO2/WebAuthn** che garantisce immunità al Phishing tramite Security Keys hardware o biometria (Windows Hello, TouchID).

### 2.3 JWT, OIDC, e Session Management
L'integrazione tra Frontend, Backend e Keycloak si basa su **OpenID Connect (OIDC)**:
- Il Backend non gestisce password in chiaro. Tutte le credenziali sono elaborate e hashate (PBKDF2/Argon2) da Keycloak.
- La gestione delle sessioni utilizza **JWT (JSON Web Token)** con una vita utile molto breve (short-lived access tokens).
- Per estendere la sessione si impiegano *Refresh Tokens* revocabili, persistiti criptati in Redis e associati a IP/Device fingerprinting.
- In caso di anomalia o compromissione, l'amministratore può revocare istantaneamente le sessioni da Keycloak.

## 3. Gestione dei Dati Sensibili

### 3.1 HashiCorp Vault e Secrets Management
Tutte le configurazioni sensibili (password dei DB, certificati TLS interni, chiavi API) sono archiviate e gestite dinamicamente tramite HashiCorp Vault (Secrets Management).
- Nessun segreto hardcoded (es. in file `.env` o configurazioni git).
- Utilizzo dell'architettura in *High Availability (HA)* supportata da backend storage Raft crittografato.

### 3.2 Crittografia End-to-End (E2EE)
CasperMail implementa una crittografia applicativa avanzata:
- I corpi delle email, gli alias, e gli allegati vengono crittografati dal Backend prima di essere salvati sul database PostgreSQL.
- Utilizzo dell'**HashiCorp Vault Transit Engine** (Crittografia as a Service). Il database funge da mero storage cieco ("Blind Storage"). Un attaccante con accesso al DB otterrebbe solo *ciphertext*.
- Le chiavi crittografiche non lasciano mai l'enclave sicura di Vault.

## 4. Comunicazioni Sicure (TLS)
Il protocollo TLS è l'unico standard di trasporto approvato:
- **Esterno:** Traefik gestisce dinamicamente i certificati validi e riconosciuti tramite integrazione Let's Encrypt (ACME challenge). Strict-Transport-Security (HSTS) è abilitato.
- **Interno:** Le comunicazioni interne tra i microservizi (es. Backend verso Keycloak o Vault) utilizzano TLS tramite una Certificate Authority (CA) interna al cluster.

## 5. Audit Logging e SIEM
La responsabilità e il tracciamento sono centrali nella Security Architecture:
- Tutti i log applicativi, i login di Keycloak, le operazioni crittografiche di Vault e i drop di pacchetti di rete sono raccolti.
- Il traffico di log fluisce via **Promtail** verso **Loki**, dove viene memorizzato a scopo di forensics.
- Gli alert di sicurezza vengono aggregati in **Grafana** per il Security Operations Center (SOC) o l'Auditor (ISO27001).

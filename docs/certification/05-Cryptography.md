# Documento 5 – Crittografia

Questo documento descrive i meccanismi e gli algoritmi crittografici utilizzati all'interno della piattaforma CasperMail per garantire la confidenzialità, l'integrità, l'autenticità e il non ripudio dei dati, in ottemperanza ai framework normativi moderni.

## 1. Sicurezza del Trasporto (In-Transit)

### 1.1 Transport Layer Security (TLS)
Il protocollo **TLS** viene utilizzato esclusivamente per ogni transazione, rifiutando esplicitamente connessioni in chiaro o con protocolli legacy (SSLv3, TLS 1.0, TLS 1.1).
- **TLS 1.2 / TLS 1.3** sono gli unici protocolli consentiti sul Reverse Proxy (Traefik).
- **Cipher Suites:** Vengono accettate solo suite crittografiche con *Forward Secrecy* (es. `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` o i default di TLS 1.3 `TLS_AES_256_GCM_SHA384`).
- **HSTS (HTTP Strict Transport Security):** Abilitato su tutti i domini (Header: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).

### 1.2 Public Key Infrastructure (PKI)
- I certificati pubblici per gli end-user (es. `mail.secure.internal`) sono firmati da una CA pubblica riconosciuta o da una Root CA aziendale tramite il protocollo **ACME** (gestito da Traefik).
- Il traffico intra-cluster (es. da Backend a Vault) è messo in sicurezza tramite una PKI locale (Kubernetes Secrets / cert-manager).

### 1.3 Certificate Rotation
- La rotazione dei certificati esterni è **completamente automatizzata**. Let's Encrypt / ACME provider emettono certificati a breve scadenza (90 giorni), e Traefik si occupa del rinnovo automatico 30 giorni prima della scadenza.

## 2. Sicurezza dei Dati (At-Rest)

### 2.1 Algoritmi e Standard
I dati archiviati beneficiano di cifratura avanzata implementata dal backend in interazione con HashiCorp Vault.
- **AES-256-GCM:** Utilizzato come standard globale per la cifratura simmetrica del contenuto delle email e dei metadati sensibili. GCM fornisce inoltre autenticazione integrata (AEAD), scongiurando attacchi di manipolazione (Tampering).
- **RSA (2048/4096-bit) / ECC (Curve P-256/P-384):** Utilizzati per le operazioni di key-exchange, la firma dei token e i certificati TLS.

### 2.2 HashiCorp Vault (Transit Engine)
Vault opera come un vero e proprio Hardware Security Module (HSM) logico.
- **Encryption as a Service:** L'API Backend non genera chiavi per cifrare le mail. Invia il testo in chiaro all'endpoint `/v1/transit/encrypt/mail-data` di Vault, ricevendo in risposta il *Ciphertext* (formato `vault:v1:base64...`).
- Il database (CloudNativePG) memorizza esclusivamente questi ciphertext opachi.

### 2.3 Key Rotation (Rotazione delle Chiavi)
Vault garantisce il lifecycle management delle chiavi crittografiche:
- **Rotazione Dinamica:** È configurata la rotazione periodica della chiave di root del Transit Engine (es. ogni 30 giorni).
- **Versioning:** Quando Vault ruota una chiave, i nuovi dati vengono cifrati con la *nuova versione* (`vault:v2:...`). I vecchi ciphertext possono ancora essere decriptati in modo trasparente usando le vecchie chiavi salvate in memoria sicura, finché non viene invocato il comando di re-wrap (Rekeying).

### 2.4 Storage Sicuro (Secret Storage)
Tutti i segreti statici (come le credenziali del DB `DB_PASSWORD` o API Keys di terze parti) sono archiviati in Vault KV Store (Key-Value) o generati on-the-fly (Dynamic Secrets). Il Backend recupera questi segreti al boot senza che siano esposti su file o variabili d'ambiente di Kubernetes visibili nell'interfaccia.

## 3. Gestione Password e Autenticazione (IAM)

### 3.1 Password Storage (Hashing)
Le password degli utenti (gestite in Keycloak) non vengono mai salvate in chiaro né cifrate con algoritmi reversibili.
- **Argon2 / PBKDF2:** Vengono utilizzati algoritmi Key Derivation Function (KDF) ad alto costo computazionale (Memory-hard per Argon2, CPU-hard per PBKDF2) abbinati a *Salt* crittografici unici generati casualmente per ogni utente.

### 3.2 Token Signing (JWT)
Il rilascio di token di sessione e autorizzazione (JWT via OIDC):
- Viene firmato asimmetricamente utilizzando l'algoritmo **RS256** (RSA Signature with SHA-256).
- La chiave privata risiede in Keycloak. Il Backend e il Frontend possiedono solo la chiave pubblica, scaricata dall'endpoint JWKS (`/certs`), per validare l'integrità e la provenienza del token.

## Conclusioni
L'implementazione crittografica di CasperMail evita ogni forma di "homebrew crypto". Si basa unicamente su algoritmi consolidati e raccomandati da NIST e ENISA, affidando le operazioni critiche a componenti di livello Enterprise (Vault e Keycloak) testati formalmente contro attacchi crittografici noti.

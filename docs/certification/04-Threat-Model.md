# Documento 4 – Threat Model (STRIDE)

L'analisi dei rischi per l'infrastruttura di CasperMail è stata condotta adottando la metodologia **STRIDE** (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) di Microsoft.

Questo documento mappa le minacce sui componenti principali: Ingress Proxy (Traefik), API Backend (Node.js), Database (CloudNativePG) e Key Management Service (Vault).

## Tabella di Valutazione del Rischio (Matrice)
* **Risk (R):** Calcolato come **Likelihood (L)** x **Impact (I)**.
* **Scala Likelihood (L):** 1 (Low) - 3 (High).
* **Scala Impact (I):** 1 (Low) - 3 (High).
* **Risk Severity:** Basso (1-3), Medio (4-6), Alto (7-9).

---

## 1. Componente: Traefik (Reverse Proxy / Ingress)

| Categoria STRIDE | Minaccia (Threat) | Asset Coinvolto | Attack Vector | Impatto | Likelihood | Rischio | Mitigazione | Rischio Residuo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Attacco Man-in-the-Middle (MitM) per catturare credenziali rubando l'identità del server | Credenziali utente, Session Token | Intercettazione del traffico di rete senza TLS | Alto (3) | Basso (1) | Medio (3) | Forzatura rigorosa di TLS 1.3 con Let's Encrypt (ACME). Configurazione di HSTS. | Basso (1) |
| **Denial of Service** | Volumetric DDoS verso gli endpoint API o Auth per esaurire le risorse del cluster | Disponibilità di sistema, CPU/RAM | Flooding di pacchetti HTTP/HTTPS | Medio (2) | Alto (3) | Medio (6) | Implementazione di Rate Limiting severo a livello di Ingress e su backend (Redis cache). | Basso (2) |

---

## 2. Componente: Keycloak (Identity and Access Management)

| Categoria STRIDE | Minaccia (Threat) | Asset Coinvolto | Attack Vector | Impatto | Likelihood | Rischio | Mitigazione | Rischio Residuo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Furto di credenziali tramite attacchi Phishing o Credential Stuffing | Account utente (Dati personali) | L'attaccante inganna l'utente o usa dizionari di password | Alto (3) | Alto (3) | Alto (9) | Obbligo di **WebAuthn/FIDO2** e MFA per tutti gli accessi amministrativi e tenant isolati. | Basso (2) |
| **Repudiation** | Un amministratore altera le policy RBAC e nega di averlo fatto | Integrità del sistema, Governance | Accesso console admin non tracciato | Medio (2) | Basso (1) | Basso (2) | Audit Logging perentorio. I log vengono esportati su Loki/SIEM esterno in tempo reale. | Basso (1) |
| **Elevation of Privilege** | Un utente normale ottiene un Access Token con claims di amministratore | Autorizzazioni | Sfruttamento di una falla zero-day in Keycloak | Alto (3) | Basso (1) | Medio (3) | Aggiornamenti automatici (Trivy scans in CI/CD) e configurazioni hardening di Keycloak. | Basso (1) |

---

## 3. Componente: API Backend (Node.js / Fastify)

| Categoria STRIDE | Minaccia (Threat) | Asset Coinvolto | Attack Vector | Impatto | Likelihood | Rischio | Mitigazione | Rischio Residuo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tampering** | Modifica del payload (ad es. corpo dell'email o ID del destinatario) in transito | Integrità del messaggio | Iniezione di dati dannosi (XSS / SQLi) sull'API REST | Alto (3) | Basso (1) | Medio (3) | Validazione forte degli input (AJV su Fastify) e prepared statements/ORM. | Basso (1) |
| **Information Disclosure** | Esposizione dei contenuti delle e-mail e degli allegati salvati sul disco | Riservatezza dei dati utente | Accesso non autorizzato ai volumi del nodo | Alto (3) | Basso (1) | Medio (3) | Tutte le e-mail vengono passate a Vault per essere criptate via **Transit Engine** prima del DB. | Basso (1) |

---

## 4. Componente: CloudNativePG (PostgreSQL)

| Categoria STRIDE | Minaccia (Threat) | Asset Coinvolto | Attack Vector | Impatto | Likelihood | Rischio | Mitigazione | Rischio Residuo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Information Disclosure** | Dump del database esportato da un attaccante o da un insider malintenzionato | Snapshot del DB | Accesso SQL o backup exfiltration | Alto (3) | Basso (1) | Medio (3) | Tutti i dati sensibili sono archiviati come *Ciphertext* non reversibile senza chiavi di Vault. | Basso (1) |
| **Tampering** | Modifica diretta dei dati (es. alterazione password o email) | Integrità dati | Exploit sulle Network Policies interne | Medio (2) | Basso (1) | Basso (2) | Connessioni ammesse esclusivamente dal Pod del Backend. Network policies default-deny. | Basso (1) |

---

## 5. Componente: HashiCorp Vault

| Categoria STRIDE | Minaccia (Threat) | Asset Coinvolto | Attack Vector | Impatto | Likelihood | Rischio | Mitigazione | Rischio Residuo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Elevation of Privilege** | Estrazione della *Master Key* o dei *Root Token* di Vault | Radice di fiducia crittografica (Root of Trust) | Accesso in memoria al processo Vault o furto degli Unseal Keys | Alto (3) | Basso (1) | Medio (3) | Utilizzo del pattern Auto-Unseal (tramite Transit KMS separato) e rotazione dinamica dei token (TTL molto bassi). | Basso (1) |
| **Denial of Service** | Saturazione del backend crittografico, rendendo impossibile l'invio/lettura delle mail | Operatività dell'infrastruttura E2EE | Chiamate massive all'endpoint `/encrypt` o `/decrypt` | Medio (2) | Basso (1) | Basso (2) | Deployment di Vault in modalità High Availability (Raft Cluster) con scaling orizzontale automatico. | Basso (1) |

---

## Conclusioni
L'architettura **Security-by-Design** implementata tramite *Vault* e *Keycloak* riduce il rischio residuo per la stragrande maggioranza dei vettori d'attacco (Information Disclosure e Tampering) a un valore di **Basso (1)**. I dati rimangono opachi (Zero-Knowledge) a qualsiasi livello dello stack, limitando l'impatto potenziale di qualsiasi intrusione.

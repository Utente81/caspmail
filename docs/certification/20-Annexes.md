# Documento 20 – Annexes e Riferimenti

Questo documento raccoglie gli allegati, i riferimenti normativi e i link agli output generati dai processi automatizzati (Evidenze) che costituiscono il dossier di certificazione di CasperMail.

## 1. Riferimenti Normativi e Standard
L'architettura di sicurezza di CasperMail è stata progettata tenendo conto dei seguenti standard:
- **GDPR (Regolamento UE 2016/679):** Privacy by Design, Protezione Dati (Art. 32).
- **NIS2 (Direttiva UE 2022/2555):** Sicurezza delle reti e dell'informazione, Gestione del Rischio e degli Incidenti (Art. 21).
- **ISO/IEC 27001:2022:** Sistema di Gestione per la Sicurezza delle Informazioni (ISMS/SGSI).
- **Cyber Resilience Act (Draft UE):** Sicurezza by-default e supply-chain security per prodotti digitali.
- **OWASP Top 10 API Security (2023):** Protezione delle interfacce RESTful (es. BOLA, Authentication, Rate Limiting).
- **NIST SP 800-63B:** Digital Identity Guidelines (Authentication and Lifecycle Management).

## 2. Elenco Evidenze Automate (Artifacts)
I seguenti file sono stati generati automaticamente durante i processi di Continuous Integration (CI) e Security Scanning. Costituiscono la prova tangibile delle asserzioni presenti nei documenti precedenti e sono archiviati nella directory `evidence/`.

### 2.1 Software Bill of Materials (SBOM)
Le distinte base del software documentano tutte le librerie Open Source importate:
- **Backend SBOM:** `evidence/sbom/backend-sbom.json` (Formato CycloneDX)
- **Frontend SBOM:** `evidence/sbom/frontend-sbom.json` (Formato CycloneDX)

*(Questi file permettono di dimostrare la conformità ai requisiti di supply chain security del Cyber Resilience Act e della Direttiva NIS2).*

### 2.2 Report di Scansione Vulnerabilità
- **Security Scan Report:** `security_scan_report.md` (presente nel root repo, generato durante il filesystem scanning del progetto tramite Trivy, dimostra la tracciabilità e gestione dei CVE correnti).

### 2.3 Policy di Rete (Network Policies)
- I file manifesti Kubernetes per il default-deny e l'isolamento (micro-segmentazione) si trovano nel repository principale alla voce `network-policies.yaml`. Questo dimostra tecnicamente l'adozione del modello **Zero Trust**.

## 3. Glossario
- **E2EE:** End-to-End Encryption.
- **KMS:** Key Management System (HashiCorp Vault).
- **SIEM:** Security Information and Event Management (Loki).
- **SOC:** Security Operations Center.
- **JWT:** JSON Web Token.
- **OIDC:** OpenID Connect.
- **CaaS:** Cryptography as a Service.
- **HA:** High Availability.
- **DR:** Disaster Recovery.
- **SPOF:** Single Point of Failure.
- **MFA:** Multi-Factor Authentication (FIDO2/WebAuthn).

# Documento 9 – ISO/IEC 27001:2022 Mapping

La ISO/IEC 27001 è lo standard internazionale principale per i Sistemi di Gestione della Sicurezza delle Informazioni (SGSI/ISMS). Questo documento fornisce una mappatura tecnica tra l'architettura di CasperMail e i controlli primari dell'Annex A dello standard ISO 27001:2022.

## Mappatura dei Controlli (Annex A)

### A.5 Controlli Organizzativi (Organizational Controls)
- **A.5.15 Access control:** Implementato tecnicamente tramite l'Identity Provider (Keycloak) che impone RBAC severo e Single Sign-On (SSO).
- **A.5.16 Identity management:** Il ciclo di vita dell'identità è interamente gestito in Keycloak. Gli account dismessi vengono revocati istantaneamente via API.
- **A.5.24 Information security incident management planning and preparation:** Supportato dalla visibilità real-time garantita dalla stack di Observability (Prometheus, Loki, Grafana) per individuare minacce tempestivamente.

### A.6 Controlli sulle Persone (People Controls)
- Non trattati direttamente dalla piattaforma, ma la piattaforma facilita il controllo A.6 fornendo strumenti di Audit (ad esempio, per tracciare comportamenti anomali di insider threat).

### A.7 Controlli Fisici (Physical Controls)
- **A.7.1 Physical security perimeters:** Demandato al provider di infrastruttura (es. AWS, Aruba, o Datacenter On-Premise). CasperMail assicura tuttavia che, anche in caso di furto fisico di un server, i dati siano protetti dal Transit Engine di HashiCorp Vault. Senza la chiave di Unseal (che non è memorizzata sui dischi del nodo), i dati estratti dal DB sono inservibili.

### A.8 Controlli Tecnologici (Technological Controls)
- **A.8.2 Privileged access rights:** L'accesso alle console amministrative (es. Grafana SOC o Keycloak Admin) è ristretto a specifici Role Claims ed esige la Multi-Factor Authentication.
- **A.8.4 Access to source code:** Il codice risiede in un repository protetto. I build environment (CI/CD) non hanno le chiavi di produzione.
- **A.8.5 Secure authentication information:** Le password non vengono mai archiviate né inviate in chiaro (Argon2 Hashing).
- **A.8.8 Management of technical vulnerabilities:** Vulnerability Management è garantito dall'integrazione di Trivy (Container/Filesystem/SBOM scanner) nella pipeline SDLC.
- **A.8.11 Data masking:** CasperMail implementa "Encryption as a Service". Il database PostgreSQL opera senza mai visualizzare le mail in chiaro.
- **A.8.12 Data leakage prevention (DLP):** Le email cifrate non possono essere lette o esportate in blocco tramite dump del database, fungendo da misura nativa di DLP.
- **A.8.16 Monitoring activities:** Piena conformità tramite l'aggregazione di log applicativi, di rete (Traefik access logs) e di sistema (Node) in Loki.
- **A.8.24 Use of cryptography:** Conformità assoluta mediante l'uso di standard forti (AES-256-GCM, TLS 1.3) orchestrati da HashiCorp Vault. L'infrastruttura impedisce l'uso di crittografia debole (es. DES, MD5, TLS 1.0).

## Dichiarazione di Applicabilità (SoA)
Questa mappatura supporta direttamente il CISO e gli Auditor durante la redazione dello *Statement of Applicability* (SoA), fornendo evidenze tecniche (log, pipeline, configurazioni) per dimostrare che i controlli richiesti dallo standard ISO 27001 sono in essere ed efficaci.

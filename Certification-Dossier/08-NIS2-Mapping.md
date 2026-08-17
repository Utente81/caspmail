# Documento 8 – NIS2 Mapping (Network and Information Security Directive 2)

La Direttiva Europea NIS2 mira a garantire un elevato livello comune di cybersicurezza in tutta l'Unione Europea per i soggetti essenziali (OES) e importanti.
In quanto piattaforma di comunicazione aziendale e fornitore di servizi digitali, CasperMail fornisce gli strumenti e l'architettura necessari affinché le organizzazioni possano conformarsi ai requisiti previsti dall'Articolo 21.

## 1. Analisi dei Rischi e Politiche di Sicurezza Informale
**Requisito NIS2:** Le organizzazioni devono adottare policy di analisi dei rischi e sicurezza dei sistemi.
**Mappatura CasperMail:**
- Fornisce un *Threat Model* (STRIDE) pronto all'uso e documentazione esaustiva sull'architettura.
- Offre policy di controllo degli accessi granulari tramite Keycloak (RBAC).

## 2. Gestione degli Incidenti (Incident Handling)
**Requisito NIS2:** Prevenzione, rilevamento e risposta agli incidenti, inclusa la notifica entro 24 ore.
**Mappatura CasperMail:**
- **Rilevamento:** Integrazione nativa del SOC tramite **Loki e Grafana**. Tutti gli eventi di login (Keycloak) e di rete (Traefik) generano telemetria esportabile.
- **Risposta:** Capacità di disabilitare tenant o revocare immediatamente i Token JWT tramite l'API di Identity Management.

## 3. Continuità Operativa e Gestione delle Crisi
**Requisito NIS2:** Backup management, disaster recovery e crisis management.
**Mappatura CasperMail:**
- **High Availability (HA):** Deployata in cluster Kubernetes (K3s). L'architettura non prevede Single Point of Failure (SPOF) a livello applicativo.
- **Storage Resiliente:** CloudNativePG supporta repliche distribuite sincrone, e HashiCorp Vault utilizza l'algoritmo Raft per il consenso distribuito. I backup continui (WAL archiving) verso bucket S3 permettono Point-in-Time-Recovery (PITR).

## 4. Sicurezza della Supply Chain
**Requisito NIS2:** Gestione della sicurezza nella catena di approvvigionamento (fornitori di terze parti).
**Mappatura CasperMail:**
- Adozione del concetto di **SBOM (Software Bill of Materials)** generata in modo automatizzato da Trivy, assicurando completa trasparenza su tutte le librerie open source impiegate (es. Node.js, Fastify).
- Revisione del codice automatizzata tramite Semgrep (SAST).

## 5. Pratiche di Igiene Informatica (Cyber Hygiene)
**Requisito NIS2:** Policy di cyber igiene di base e formazione del personale.
**Mappatura CasperMail:**
- Configurazione by-default di autenticazione forte (MFA tramite WebAuthn/FIDO2).
- Zero Trust Networking: tutte le connessioni anche interne sono protette da Network Policies.
- Crittografia end-to-end implementata come standard per tutti i tenant (senza costi aggiuntivi o configurazioni complesse) per ridurre l'impatto degli errori umani.

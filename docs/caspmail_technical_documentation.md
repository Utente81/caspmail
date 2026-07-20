# 📚 Documentazione Tecnica di Sistema: CaspMail Enterprise

Questa documentazione delinea l'architettura tecnica, il modello di sicurezza, la topologia dell'infrastruttura e le strategie di deployment della piattaforma **CaspMail**. È concepita per DevOps Engineer, Architetti della Sicurezza e amministratori di sistema.

> [!NOTE]
> CaspMail è un sistema *Cloud-Native*, progettato fin dal primo giorno per l'esecuzione in cluster Kubernetes, garantendo alta affidabilità, resilienza e sicurezza *Zero-Trust*.

---

## 1. Topologia e Architettura Kubernetes

Tutta l'infrastruttura è orchestrata tramite **K3s / Kubernetes** e le applicazioni vengono dispiegate in modo dichiarativo tramite **ArgoCD** (paradigma GitOps).

### Livello di Rete (Ingress e Traefik)
- **Traefik Ingress Controller**: Gestisce tutto il traffico in ingresso (Edge Router).
- **Terminazione TLS**: Le connessioni sicure (HTTPS) vengono terminate a livello di Ingress.
- **Routing Intelligente**: 
  - Il traffico generico viene instradato verso i pod del Frontend.
  - Le rotte `/api/*` sono dirottate verso il Backend.
  - Le rotte `/admin` e `/realms` sono riservate a Keycloak per l'Identity Management.
- **Security Headers**: Traefik inietta automaticamente intestazioni di sicurezza rigide come `Content-Security-Policy` (CSP) e HSTS per mitigare attacchi XSS e man-in-the-middle.

### Livello Applicativo (Compute Layer)
- **Frontend (React)**: Una Single Page Application (SPA) ottimizzata. Costruita a componenti stagni per separare logicamente i portali di Login, Mail, SOC e Amministrazione. Il design UI utilizza tecniche avanzate come il **Glassmorphism** e background sfocati (blur effects) per un impatto estetico premium.
- **Backend (Node.js/Fastify)**: API *stateless* ad alte prestazioni. Il backend scala orizzontalmente tramite **HPA** (Horizontal Pod Autoscaler) di Kubernetes in base al carico di CPU e Memoria. Include la gestione in *connection pooling* verso il database.
- **Gestione Quote di Storage (Policy)**: Di default, ogni nuovo utente creato nel sistema (sia esso istanziato da Admin Panel o auto-registrato via Keycloak al primo accesso) è vincolato a una **quota di storage predefinita di 500 MB**. Questa policy è enforces a livello di Schema Database (PostgreSQL DEFAULT constraint) e a livello logico nel Backend API.

---

## 2. Identità e Sicurezza Zero-Trust

La sicurezza di CaspMail è il pilastro fondante dell'architettura e si avvale di tecnologie *best-in-class*.

### Identity Provider: Keycloak
- **Autenticazione**: Keycloak gestisce i flussi di login (OpenID Connect / OAuth2). Abbiamo personalizzato il tema per includere logiche di Glassmorphism e animazioni dinamiche.
- **Passkeys (WebAuthn)**: Il sistema supporta l'autenticazione biometrica *passwordless* (FIDO2, Windows Hello, Face ID), eliminando le vulnerabilità legate al furto o *brute-force* delle password.
- **Token**: I token di accesso (JWT) hanno breve durata. Keycloak funge da barriera invalicabile per proteggere gli endpoint API.

### Gestione Segreti e Crittografia: HashiCorp Vault
- **Zero-Trust Secrets**: Il Backend non memorizza credenziali statiche per il database. Vault genera e fornisce **credenziali dinamiche** con scadenza. Se un pod viene compromesso, le credenziali associate muoiono.
- **Transit Engine (Encryption-as-a-Service)**: I dati sensibili scambiati dal sistema vengono crittografati "al volo" tramite il *Transit Engine* di Vault. Le chiavi crittografiche non escono mai dalla memoria protetta del KMS (Key Management System).
- **Raft Storage**: Vault gira in modalità ad alta affidabilità (HA) sfruttando uno storage backend distribuito integrato (Raft).

---

## 3. Data Persistence e Alta Affidabilità

### Database: CloudNativePG (PostgreSQL)
- **Operatore CNPG**: Il database PostgreSQL è gestito dall'operatore Kubernetes *CloudNativePG*, che si occupa autonomamente di failover, repliche e salute del cluster.
- **Disaster Recovery (PITR)**: Il sistema genera continuamente Write-Ahead Logs (WAL) che vengono archiviati asincronamente in un bucket Object Storage (S3-compatibile / MinIO). Questo consente un recupero dei dati *Point-In-Time* al secondo esatto in caso di corruzione.

---

## 4. Telemetria, Logging e SOC (Security Operations Center)

### Osservabilità (Stack PLG)
- **Promtail**: Raccoglie i log standard e di errore (`stdout`/`stderr`) da tutti i pod in esecuzione nel cluster.
- **Loki**: Aggrega i log e li indicizza ad altissima velocità.
- **Grafana**: Dispone di dashboard centralizzate per monitorare la latenza delle API, il tasso di fallimento dei login su Keycloak, lo stato di sigillo di Vault e la latenza di replica del database.

### Integrazione SIEM (Gestione Eventi di Sicurezza)
- I log di sicurezza generati dal Backend e gli allarmi del DLP (Data Loss Prevention) lato client vengono inoltrati alla dashboard del SOC in tempo reale tramite **Server-Sent Events (SSE)**.
- Il sistema include una coda asincrona dedicata all'esportazione di eventi ad alta priorità verso SIEM aziendali di terze parti (come Splunk o QRadar) usando formati nativi (JSON/CEF) configurabili dai tenant.

---

## 5. Deployment, GitOps e Infrastruttura

### Paradigma GitOps (ArgoCD)
Il sistema usa ArgoCD per garantire che lo stato del cluster Kubernetes corrisponda sempre al codice sorgente nel branch `main` del repository Git.
- **Self-Healing e Riconciliazione**: Qualsiasi patch applicata manualmente ai container sul cluster (es. tramite `kubectl edit` o push di immagini non committate nel manifest k8s) viene **annullata e sovrascritta** automaticamente da ArgoCD entro pochi secondi per prevenire la deriva della configurazione.
- **Continuous Deployment (CD)**: Le build del codice e la generazione dei container Docker (caricati su Github Container Registry) sono delegate a Github Actions. Una volta completata la pipeline CI, i manifest K8s si aggiornano, e ArgoCD propaga le nuove immagini nei Pod.

### Topologia Locale Attuale (Bare Metal / VM)
Nel setup attuale (on-premise), il server agisce da nodo K3s singolo:
- **IP Management**: Si consiglia fortemente l'uso di un **IP Statico** imposto lato sistema operativo (es. `Netplan` su Ubuntu) o una *DHCP Reservation* dal router. Un cambio di IP invalida i certificati TLS interni di Kubernetes e disconnette K3s, portando i servizi offline.

### Migrazione Cloud (Future-Proofing)
> [!IMPORTANT]
> Quando l'infrastruttura verrà migrata verso un Cloud Provider pubblico (AWS, GCP, DigitalOcean), l'architettura di rete verrà riprogettata per tollerare completamente il cambio IP dei nodi:

1. **Cloud Load Balancer**: Tutto il traffico esterno (DNS) punterà a un Load Balancer gestito e resiliente, non più direttamente all'IP del server K3s. Il Load Balancer saprà sempre ritrovare i server anche se cambiano IP.
2. **K3s TLS SAN**: Kubernetes verrà istanziato iniettando i nomi a dominio aziendali come Subject Alternative Names (`--tls-san`), rendendo i certificati indipendenti dall'IP fisico della macchina.
3. **ExternalDNS**: Un controller automatizzerà l'aggiornamento dei record DNS verso Cloudflare o Route53 in caso di riallocamento del cluster.

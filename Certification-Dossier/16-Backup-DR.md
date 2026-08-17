# Documento 16 – Backup & Disaster Recovery (DR)

La continuità operativa (Business Continuity) e il ripristino di emergenza (Disaster Recovery) sono progettati per garantire Recovery Time Objective (RTO) e Recovery Point Objective (RPO) sfidanti, aderendo ai requisiti della Direttiva NIS2 e dello standard ISO 27001.

## 1. Architettura di Storage e Database
CasperMail non si affida a database stand-alone.
- Il database relazionale è gestito tramite **CloudNativePG**, un operatore Kubernetes progettato per PostgreSQL.
- Il cluster DB è configurato in **High Availability (HA)** con almeno 3 istanze (1 Primary, 2 Replicas) distribuite, se l'infrastruttura sottostante lo permette, su Availability Zones (AZ) diverse.
- Il fallimento di un nodo primario innesca un *Automatic Failover* verso una replica sincronizzata entro pochi secondi (RTO < 30 secondi).

## 2. Strategia di Backup (RPO)

### 2.1 Backup Continuo (WAL Archiving)
I dati di PostgreSQL sono protetti dal **Continuous Archiving**:
- Oltre ai backup fisici (snapshot) giornalieri, ogni transazione sul database genera un log (Write-Ahead Log, WAL).
- Questi WAL vengono spediti in maniera asincrona ma continua verso un Object Storage compatibile con **S3** (es. MinIO, AWS S3) tramite l'utility `Barman` integrata in CloudNativePG.
- Questo consente la funzionalità di **Point-In-Time-Recovery (PITR)**: è possibile ripristinare il database allo stato esatto in cui si trovava in uno specifico secondo (es. 5 minuti prima di un incidente fatale), garantendo un RPO tendente a 0.

### 2.2 Backup dei Segreti (HashiCorp Vault)
Il cluster Vault utilizza lo storage di backend Raft (Integrated Storage). 
- Raft Snapshot vengono eseguiti ogni ora e caricati anch'essi su bucket S3 crittografati.
- In caso di perdita totale dell'infrastruttura, il ripristino del Vault cluster dallo Snapshot è il *Prerequisito Zero* per la decrittazione dei dati del database.

## 3. Disaster Recovery (DR)
La procedura di DR in caso di perdita catastrofica del datacenter primario segue il paradigma **GitOps**:
1. L'infrastruttura base (K3s) viene ri-provisionata (tramite Ansible/Terraform).
2. L'operatore **ArgoCD** viene installato e collegato al repository Git.
3. ArgoCD sincronizza e re-installa automaticamente tutti i microservizi (Traefik, Keycloak, Backend, DB Operator).
4. Viene iniettato lo snapshot di Vault e immesse manualmente le chiavi di *Unseal* (processo intenzionalmente manuale per la sicurezza).
5. CloudNativePG viene istruito, tramite manifesto dichiarativo, a ricreare il database (Bootstrap) scaricando il backup e i file WAL dal bucket S3 di emergenza.

Questa architettura *Stateless-first* permette il ripristino globale da zero in tempi stimati nell'ordine delle ore, minimizzando drasticamente l'RTO.

# Documento 17 – Operations Manual (Runbook)

Questo manuale è destinato agli Ingegneri DevOps e ai Site Reliability Engineers (SRE) che operano e mantengono la piattaforma CasperMail. Fornisce le procedure operative standard (SOP) per le attività di manutenzione ordinaria e straordinaria.

## 1. Gestione Infrastrutturale (Kubernetes & ArgoCD)
L'intera infrastruttura segue il paradigma **GitOps**. L'accesso manuale al cluster tramite `kubectl` è deprecato e limitato alle situazioni di Break-Glass (emergenze estreme).
- **Aggiornamento Applicativo:** Modificare la versione dell'immagine Docker all'interno dei manifesti Helm/Kustomize nel repository Git. ArgoCD rileverà la modifica e avvierà il processo di *Rolling Update*.
- **Rollback:** In caso di anomalia in produzione, il rollback deve essere effettuato ripristinando il commit precedente nel repository Git, permettendo ad ArgoCD di de-sincronizzare la versione problematica.

## 2. Gestione Crittografica (HashiCorp Vault)
L'operatività del Vault Engine è critica per la lettura/scrittura dei dati.
- **Unseal Process:** Al riavvio di un nodo Vault (es. dopo una manutenzione programmata OS), il Vault risulterà "Sealed" (sigillato). Questo richiede l'inserimento manuale o automatizzato (Auto-Unseal via KMS esterno) delle *Unseal Keys* generate durante l'inizializzazione, per sbloccare l'accesso al Transit Engine.
- **Key Rotation:** Per forzare una rotazione manuale della Transit Key (in risposta, ad esempio, alla potenziale esposizione di una chiave in RAM):
  `vault write -f transit/keys/mail-data/rotate`

## 3. Monitoraggio e Observability
La visibilità sullo stato del sistema è centralizzata:
- **Salute dei Container:** Monitorata tramite Prometheus (Kube-State-Metrics). Gli alert critici (es. Pod in `CrashLoopBackOff`) sono inviati al canale Slack dedicato agli SRE.
- **Logs:** Per investigare errori applicativi o di sistema, accedere a Grafana -> Explorer -> Loki. Utilizzare query LogQL standard, filtrando per namespace `caspermail`.

## 4. Gestione Database (CloudNativePG)
- Le attività di Manutenzione Ordinaria sul Database (VACUUM, Re-indexing) sono gestite autonomamente dall'operatore CloudNativePG.
- **Scale-Up:** Per aumentare le risorse del DB, modificare i limiti di CPU/RAM nei `requests`/`limits` del custom resource `Cluster` nel repository manifest.
- **Disaster Recovery Test:** Eseguito semestralmente ripristinando uno snapshot di CloudNativePG su un cluster di test isolato.

# Mappa Architetturale dei Servizi

Questa mappa mostra la distribuzione fisica dei servizi nei due nodi attualmente implementati.

Come verificato dall'ispezione di sistema, il **Server 2** non utilizza Docker tradizionale né agenti remoti (k3s-agent), ma esegue un cluster Kubernetes indipendente (`k3s.service`) blindato al solo scopo di isolare la cassaforte crittografica e difendere il Server 1 da spegnimenti improvvisi.

```mermaid
graph TD
    subgraph "SERVER 1 (192.168.189.200) - Main Kubernetes Cluster"
        Ingress[Traefik Ingress Edge]
        
        subgraph "Application Layer"
            FE[React Frontend SPA]
            BE[Fastify API Backend]
        end
        
        subgraph "Persistence Layer"
            PG[(CloudNativePG - PostgreSQL)]
            RD[(Redis HA Cluster)]
            S3[(MinIO Storage S3)]
        end
        
        subgraph "Identity & Secrets"
            KC{Keycloak IAM}
            V1{HashiCorp Vault - MAIN}
        end
        
        subgraph "Observability & CI/CD"
            PLG[Grafana + Loki + Prometheus + Promtail]
            Argo[ArgoCD GitOps Controller]
        end
        
        Ingress --> FE
        Ingress --> BE
        Ingress --> KC
        BE --> PG
        BE --> RD
        BE --> V1
        KC --> PG
        V1 --> PG
        Argo -. "Pulls from Git & deploys" .-> FE
        Argo -. "Pulls from Git & deploys" .-> BE
    end

    subgraph "SERVER 2 (192.168.189.203) - Zero-Trust Recovery Node"
        K3S_2(Standalone K3s Server)
        V2{HashiCorp Vault - TRANSIT ENGINE}
        
        K3S_2 --- V2
    end

    V1 -. "API Call :30000 (Auto-Unseal durante il boot di S1)" .-> V2

    %% Stili Architetturali
    style V1 fill:#4a148c,stroke:#fff,stroke-width:2px,color:#fff
    style V2 fill:#b71c1c,stroke:#fff,stroke-width:2px,color:#fff
    style KC fill:#0d47a1,stroke:#fff,stroke-width:2px,color:#fff
    style PG fill:#004d40,stroke:#fff,stroke-width:2px,color:#fff
```

### Dettaglio Topologico (Perché servono 2 server?)

Nel mondo Cloud-Native ad altissima sicurezza (Zero-Trust), le chiavi che cifrano il database non sono mai salvate su disco, ma tenute solo in memoria ("Sealed" mode). Quando un server si riavvia (per esempio se va via la corrente o fai un aggiornamento), perde la memoria e il Vault Principale si blocca (Sealing), bloccando di conseguenza anche il Database e i login degli utenti.

**Soluzione adottata:** Abbiamo installato un secondo mini-cluster sul **Server 2** che fa solo una cosa: custodire la chiave *Transit* di sblocco. Quando il Server 1 si riaccende, contatta in modo sicuro il Server 2 sulla porta `30000`, e quest'ultimo gli consegna automaticamente la chiave per "sbloccare" la memoria, facendolo ripartire senza intervento umano.

Per questo l'IP del Server 2 non può mai cambiare.

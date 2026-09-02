# Documento 2 – Product Architecture

Questo documento descrive l'architettura tecnica ad alto livello di CasperMail, illustrando i vari strati infrastrutturali, logici e applicativi mediante il modello C4 (Context, Container, Component) e diagrammi UML.

## 1. System Context Diagram (C4 - Livello 1)
Il diagramma di contesto illustra come gli utenti interagiscono con CasperMail e quali sistemi esterni sono coinvolti (sebbene l'obiettivo di CasperMail sia minimizzare le dipendenze esterne a favore dell'on-premise).

```mermaid
C4Context
    title CasperMail - System Context

    Person(user, "End User", "Impiegato o amministratore che utilizza la piattaforma per scambiare messaggi sicuri")
    Person(soc_admin, "SOC Analyst / SecOps", "Monitora la sicurezza del sistema e risponde agli alert")
    
    System(caspermail, "CasperMail Platform", "Piattaforma sicura E2EE di webmail e gestione dell'identità")
    
    System_Ext(mail_servers, "External Mail Servers", "Sistemi di posta SMTP esterni (Gmail, Exchange)")
    System_Ext(dns, "DNS / Let's Encrypt", "Provider per la risoluzione DNS e l'emissione dei certificati TLS")

    Rel(user, caspermail, "Invia/Riceve email, gestisce profilo", "HTTPS/WSS")
    Rel(soc_admin, caspermail, "Analizza log, verifica integrità", "HTTPS")
    Rel(caspermail, mail_servers, "Inoltra/Riceve posta (opzionale)", "SMTP/TLS")
    Rel(caspermail, dns, "Richiede certificati", "ACME/HTTPS")
```

## 2. Container Diagram (C4 - Livello 2)
Il diagramma dei container esplode la `CasperMail Platform` nei suoi container principali.

```mermaid
C4Container
    title CasperMail - Container Diagram

    Person(user, "End User")
    
    Container_Boundary(c1, "CasperMail Kubernetes Cluster") {
        Container(proxy, "Traefik Reverse Proxy", "Go", "Gestisce Ingress, TLS, Rate Limiting e WAF di base")
        
        Container(frontend, "Frontend SPA", "HTML/CSS/JS", "Interfaccia utente web (WebMail e Admin Console)")
        Container(backend, "Backend API", "Node.js (Fastify)", "Business logic, orchestrazione E2EE, Mail processing")
        
        ContainerDb(db, "PostgreSQL HA", "CloudNativePG", "Archiviazione relazionale criptata di mail, alias, configurazioni")
        ContainerDb(redis, "Redis Cache", "Redis", "Gestione sessioni temporanee, Rate Limiting in-memory")
        
        Container(keycloak, "Keycloak IAM", "Java", "Gestione Identità, OIDC, WebAuthn, RBAC")
        Container(vault, "HashiCorp Vault", "Go", "Transit Engine CaaS, KMS, Secrets Storage")
        
        Container(clamav, "ClamAV", "C", "Scansione Antivirus degli allegati e payload")
        
        Container_Boundary(soc, "SIEM / SOC / Observability") {
            Container(grafana, "Grafana", "Go", "Dashboard SOC & Monitoring")
            Container(loki, "Loki / Promtail", "Go", "Log Aggregation")
            Container(prometheus, "Prometheus", "Go", "Metriche e Alerting")
        }
    }

    Rel(user, proxy, "Traffico web", "HTTPS")
    Rel(proxy, frontend, "Serve assets statici", "HTTP")
    Rel(proxy, backend, "Chiamate API REST / WS", "HTTP")
    Rel(proxy, keycloak, "Auth flows OIDC", "HTTP")
    Rel(proxy, grafana, "Accesso SOC", "HTTPS")

    Rel(backend, db, "Legge/Scrive dati", "TCP/5432")
    Rel(backend, redis, "Verifica rate limits e cache", "TCP/6379")
    Rel(backend, keycloak, "Verifica Token JWT", "HTTP")
    Rel(backend, vault, "Cripta/Decripta payload (Transit)", "HTTPS")
    Rel(backend, clamav, "Scansiona allegati", "TCP")
    
    Rel(keycloak, db, "Legge/Scrive utenze", "TCP/5432")
```

## 3. Component Diagram: Backend (C4 - Livello 3)
Focalizziamo l'attenzione sull'architettura interna del `Backend API`, che è il nucleo della logica sicura.

```mermaid
C4Component
    title CasperMail - Backend Component Diagram

    Container_Ext(proxy, "Traefik", "Ingress Proxy")
    Container_Ext(vault, "Vault", "Transit Engine")
    Container_Ext(db, "PostgreSQL", "Database")

    Container_Boundary(api, "Backend API (Node.js)") {
        Component(router, "Router & Middleware", "Fastify", "Validazione JWT, Rate Limiting, Input Sanitization")
        Component(mail_ctrl, "Mail Controller", "JS", "Gestisce invio/ricezione e orchestrazione crittografia")
        Component(crypto_svc, "Crypto Service", "JS", "Integrazione con Vault Transit API per E2EE")
        Component(db_svc, "DB Access Layer", "PG", "Interrogazioni SQL parametriche")
        Component(auth_svc, "Auth Controller", "JS", "Validazione token e permessi RBAC")
    }

    Rel(proxy, router, "Inoltra traffico API", "HTTP")
    Rel(router, auth_svc, "Valida Autorizzazione", "Inter-process")
    Rel(router, mail_ctrl, "Inoltra richieste mail", "Inter-process")
    
    Rel(mail_ctrl, crypto_svc, "Richiede Encryption/Decryption", "Inter-process")
    Rel(mail_ctrl, db_svc, "Persiste dati (criptati)", "Inter-process")
    
    Rel(crypto_svc, vault, "Invia plaintext/ciphertext per trasformazione", "HTTPS (Vault Token)")
    Rel(db_svc, db, "Esegue query", "TCP")
```

## 4. Flusso di invio Mail Sicuro (UML Sequence Diagram)
Questo diagramma UML illustra come il backend garantisce l'assenza di dati in chiaro a riposo (Zero Knowledge).

```mermaid
sequenceDiagram
    autonumber
    actor Alice (Mittente)
    participant API as Backend (Mail Controller)
    participant Vault as Vault (Transit)
    participant DB as PostgreSQL

    Alice->>API: POST /mail/send {to: "Bob", body: "Segreto"}
    API->>API: Valida Token JWT e RBAC
    API->>Vault: POST /v1/transit/encrypt/mail-data (Payload: "Segreto")
    Vault-->>API: 200 OK (Ciphertext: "vault:v1:xxxx...")
    API->>DB: INSERT INTO emails (to, body_ciphertext) VALUES ("Bob", "vault:v1:xxxx...")
    DB-->>API: OK
    API-->>Alice: 200 OK (Mail Inviata)
```

## 5. Dettagli Architetturali

### 5.1 Zero Trust Networking
La comunicazione tra i container (es. tra Backend e Vault, o Backend e DB) avviene su una rete overlay (Flannel/Cilium) isolata tramite `NetworkPolicies` strette che permettono solo il traffico esplicitamente dichiarato.
Traefik funge da unico punto di ingresso e termina il traffico TLS proveniente dall'esterno.

### 5.2 Sicurezza Dati (E2EE)
CasperMail adotta un approccio **Encryption as a Service (EaaS)**. Il database PostgreSQL *non contiene mai* il contenuto delle email o i token sensibili in chiaro. Il backend demanda la crittografia a HashiCorp Vault tramite il Transit Engine, assicurando che una compromissione del DB non esponga alcun dato.

### 5.3 Mobile App & MDM Architecture (React Native)
CasperMail include un client enterprise mobile sviluppato in **React Native** (iOS/Android). 
- **Smart Discovery**: L'app implementa un motore di discovery dinamico che, a partire dall'indirizzo email dell'utente, risolve automaticamente l'endpoint del tenant isolato e i metadati OIDC di Keycloak.
- **Hardware Enclave**: Le chiavi private per la decodifica locale dei messaggi (E2EE Client-Side) vengono salvate strettamente all'interno del Secure Enclave / Keystore hardware del dispositivo.
- **Enterprise Distribution**: Le build vengono compilate tramite EAS (Expo Application Services) e distribuite privatamente tramite l'infrastruttura MDM (Mobile Device Management) dell'organizzazione.

### 5.4 Intelligenza (AI) & Security Operations Center (SOC)
I log strutturati generati dai container (Nginx, Node, Vault, Keycloak) vengono prelevati da Promtail e inviati a **Loki**, dove **Grafana** offre dashboard SOC real-time. In futuro, il SIEM potrà integrare un motore AI per l'analisi comportamentale e la rilevazione di anomalie (es. login simultanei da paesi diversi, picchi di richieste errate verso Vault).

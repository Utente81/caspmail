# Documento 1 – Executive Summary

## 1. Visione del prodotto
**CasperMail** è una piattaforma di posta elettronica sicura, scalabile e nativamente progettata per ambienti Zero Trust. La visione del prodotto è offrire un'esperienza di comunicazione fluida e moderna, garantendo al contempo standard di sicurezza di livello militare, senza i tipici colli di bottiglia e complessità dei sistemi legacy.

## 2. Problema risolto
Le soluzioni di posta elettronica tradizionali soffrono spesso di:
- Mancanza di crittografia end-to-end (E2EE) trasparente.
- Architetture monolitiche difficili da scalare e da rendere resilienti.
- Superfici di attacco ampie dovute a gestione errata dei segreti e privilegi eccessivi.
- Difficoltà nell'allinearsi rapidamente a normative stringenti (GDPR, NIS2).

CasperMail risolve questi problemi isolando ogni componente tramite microservizi, crittografando ogni dato at-rest e in-transit con chiavi gestite dinamicamente e applicando il principio del privilegio minimo (Least Privilege) a tutti i livelli dell'infrastruttura.

## 3. Architettura
CasperMail adotta un'architettura a **microservizi cloud-native** ospitata su Kubernetes (K3s). È composta da:
- Un **Frontend** reattivo web-based.
- Un'applicazione **Mobile Enterprise** (iOS/Android) basata su React Native con Smart Discovery.
- Un **Backend** API-first.
- Un database relazionale ad alta affidabilità (**PostgreSQL/CNPG**).
- Un motore crittografico e di gestione segreti centralizzato (**HashiCorp Vault**).
- Un sistema di Identity and Access Management (**Keycloak**).
- Un layer di ingresso sicuro e reverse proxy (**Traefik**).
- Un sistema SIEM/SOC integrato per monitoraggio e alerting in tempo reale.

## 4. Mercato
Il mercato di riferimento è quello della **cybersecurity enterprise e della comunicazione sicura**. Con l'aumento delle normative sulla protezione dei dati e delle minacce cybernetiche, enti governativi, istituzioni finanziarie e aziende operanti in settori critici richiedono soluzioni di messaggistica che non compromettano la sicurezza per l'usabilità.

## 5. Clienti target
- Enti Governativi e Pubblica Amministrazione.
- Settore Finanziario e Bancario (Finance & Banking).
- Healthcare e Sanità.
- Operatori di Servizi Essenziali (OES) soggetti alla direttiva NIS2.
- Aziende Enterprise con elevati requisiti di compliance e protezione della proprietà intellettuale.

## 6. Tecnologie
- **Infrastruttura:** Kubernetes (K3s), Helm.
- **Backend:** Node.js (Fastify).
- **Frontend Web:** HTML, JS, CSS Vanilla (Design Moderno).
- **Frontend Mobile:** React Native, Expo, React Native Paper (MDM Enterprise Client).
- **Security & IAM:** HashiCorp Vault (Transit Engine per E2EE), Keycloak (OIDC, WebAuthn).
- **Database:** PostgreSQL (CloudNativePG per HA).
- **Networking:** Traefik Proxy, Network Policies Kubernetes.
- **Observability:** Prometheus, Grafana, Loki (SIEM integrato).

## 7. Sicurezza
La sicurezza è il principio fondante (Security-by-Design):
- **Zero Trust:** Autenticazione rigorosa per ogni comunicazione tra i microservizi.
- **E2EE:** Crittografia as a Service (CaaS) tramite Vault per tutti i dati sensibili e le email.
- **MFA:** Autenticazione a più fattori forte e FIDO2/WebAuthn.
- **Automazione:** Rotazione automatica delle chiavi crittografiche e unsealing automatico di Vault.

## 8. Compliance
CasperMail è sviluppato per essere "Compliance-Ready" fin dal primo giorno:
- **GDPR:** Crittografia forte dei dati personali, pseudonimizzazione, diritto all'oblio.
- **NIS2:** Resilienza dell'infrastruttura, incident reporting integrato tramite SIEM, gestione dei rischi cyber.
- **ISO/IEC 27001:** Controlli di sicurezza implementati a livello di rete, sistema e applicazione.
- **Cyber Resilience Act (CRA):** Sicurezza by design e by default, gestione trasparente delle vulnerabilità (SDLC sicuro).

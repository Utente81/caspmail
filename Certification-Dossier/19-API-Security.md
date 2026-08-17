# Documento 19 – API Security

CasperMail è costruita seguendo il paradigma **API-First**. Il Frontend comunica con il Backend interamente tramite chiamate RESTful e WebSocket. Questo documento espone le contromisure attive per proteggere la superficie d'attacco API, coprendo le vulnerabilità più comuni (OWASP API Security Top 10).

## 1. Authentication & Authorization (API1 & API2)
- L'accesso a tutti gli endpoint (fatta eccezione per `/health`) è bloccato (Default Deny).
- Per invocare un'API, il client deve inserire un token JWT valido nell'header `Authorization: Bearer <token>`.
- **RBAC Enforcement:** Il controller API decodifica il JWT, ne valida la firma tramite la chiave pubblica (JWKS), estrae l'attributo `realm_access.roles` e l'ID del tenant (gruppo). Se l'utente non possiede il ruolo richiesto dall'endpoint, l'API risponde con HTTP 403 Forbidden.

## 2. Insecure Direct Object Reference (BOLA/IDOR - API1)
Per prevenire manipolazioni maligne in cui un utente cerca di leggere i messaggi di un altro utente alterando l'ID del messaggio (es. `GET /api/messages/1234`):
- Le query SQL (PostgreSQL) includono sempre, in modo vincolante e a livello di Data Access Layer (ORM), il controllo di appartenenza della risorsa: `WHERE tenant_id = $1 AND owner_id = $2`.
- Gli ID esposti non sono incrementali sequenziali (es. `1, 2, 3`), bensì **UUIDv4** generati casualmente (es. `f47ac10b-58cc-4372-a567-0e02b2c3d479`), rendendo impraticabile l'enumerazione.

## 3. Rate Limiting e Prevenzione DoS (API4)
- **Traefik Ingress:** Un middleware globale applica una restrizione (Rate Limit) basata sull'indirizzo IP, prevenendo DDoS volumetrici generici.
- **Backend (Redis):** Fastify applica un Rate Limiting granulare per utente e per route. Ad esempio, la route `/api/mail/send` potrebbe essere limitata a 50 chiamate al minuto per utente, mentre route sensibili possono essere limitate a numeri ancora più bassi per evitare abusi di spam o enumerazione.

## 4. Validazione degli Input (API8 - Injection)
- Ogni richiesta in ingresso (`body`, `querystring`, `params`) è validata rigidamente tramite uno schema JSON (Ajv per Fastify) prima che raggiunga il controller.
- Se il payload non rispetta il formato esatto previsto (tipo, lunghezza, regex approvata), la richiesta è rigettata con HTTP 400 Bad Request.
- Tutti i parametri SQL sono processati tramite bind variables (Prepared Statements) per annullare la possibilità di SQL Injection.

## 5. Security Headers (CORS & HSTS)
Le API restituiscono una suite completa di Security Headers per proteggere i client web:
- **CORS:** Le politiche Cross-Origin Resource Sharing sono strettamente restrittive; permettono le chiamate solo dal dominio esatto della WebMail (es. `mail.secure.internal`), bloccando siti malevoli che tentano richieste per conto dell'utente.
- **CSP & X-Frame-Options:** Prevenzione da Clickjacking e attacchi XSS limitando l'esecuzione di script esterni e l'inclusione in iFrame non autorizzati.

# Documento 13 – Penetration Test e Valutazione della Sicurezza

Per garantire l'efficacia dei controlli di sicurezza, CasperMail è sottoposta a rigorose sessioni di Penetration Testing (PT) condotte con regolarità. Questo documento descrive l'approccio metodologico adottato, in allineamento agli standard OWASP e PTES (Penetration Testing Execution Standard).

## 1. Frequenza e Tipologia di Assessment
L'infrastruttura è sottoposta a due tipologie di test:
- **Test Continui (Automated):** Fuzzing delle API ed esecuzione di DAST (Dynamic Application Security Testing) tramite OWASP ZAP durante le fasi finali della CI/CD (Nightly Builds).
- **Test Periodici (Manual):** Sessioni annuali (o a valle di Major Releases) condotte da team Red Team interni o da auditor di terze parti per soddisfare i requisiti della ISO 27001 e NIS2.

## 2. Metodologia di Testing

### 2.1 Approccio
I test vengono condotti utilizzando un approccio combinato:
- **Grey Box Testing:** Gli auditor hanno accesso a un account utente standard e ad alcune documentazioni architetturali (es. i diagrammi C4) per validare l'impossibilità di *Privilege Escalation* orizzontale (verso altri tenant) e verticale (verso il ruolo Admin).
- **White Box Testing:** Su richiesta, per testare l'infrastruttura crittografica, il codice sorgente del Backend e del servizio di interfacciamento con Vault viene ispezionato manualmente.

### 2.2 Obiettivi del Test (Target Scopes)
1. **Frontend SPA & WebMail:**
   - Verifica di Cross-Site Scripting (XSS), Cross-Site Request Forgery (CSRF).
   - Analisi della sicurezza dei cookie e degli header HTTP.
2. **Backend API (Node.js):**
   - Validazione dell'autenticazione JWT/OIDC.
   - SQL Injection e NoSQL Injection.
   - Broken Object Level Authorization (BOLA/IDOR).
   - Insecure Direct Object References (IDOR).
   - Rate Limiting Bypass.
3. **Infrastruttura (Kubernetes / Traefik / Vault):**
   - Container Breakout.
   - Misconfiguration Ingress (TLS debole, Cipher non sicuri).
   - Tentativi di accesso non autenticato al key-value store di Vault.

## 3. Gestione dei Risultati (Remediation)
Le vulnerabilità rilevate durante i Penetration Test vengono classificate secondo il punteggio **CVSS v3.1** (Common Vulnerability Scoring System).
Le tempistiche di risoluzione (SLA) sono le seguenti:
- **Critical (CVSS 9.0 - 10.0):** Risoluzione entro 24 ore lavorative (Hotfix immediata).
- **High (CVSS 7.0 - 8.9):** Risoluzione entro 7 giorni.
- **Medium (CVSS 4.0 - 6.9):** Risoluzione entro 30 giorni (integrata nel prossimo sprint).
- **Low (CVSS 0.1 - 3.9):** Inserite nel backlog tecnico e gestite su base prioritaria.

Ogni remediation viene re-testata per confermare che l'Issue sia stata risolta correttamente (Re-test) prima della firma del Report finale da allegare alle evidenze per l'Auditor.

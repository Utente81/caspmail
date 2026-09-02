# Documento 11 – Secure SDLC (Software Development Life Cycle)

CasperMail adotta un processo di sviluppo sicuro integrato (Secure SDLC), allineato alle best practice DevSecOps. La sicurezza non è un processo finale, ma viene verificata costantemente fin dalle prime fasi di scrittura del codice (Shift-Left Security).

## 1. Modello di Sviluppo (Git Flow & Versioning)
Il codice sorgente è ospitato su repository sicuri con controlli di accesso rigidi e branch protection policies.
- **Git Flow:** Utilizzo del modello Git Flow classico (branch `main` per la produzione, `develop` per l'integrazione, e feature branches effimeri).
- **Code Review (Peer Review):** Nessun codice può essere unito (merged) sul branch `develop` o `main` senza la revisione esplicita di almeno un altro sviluppatore senior.
- **Versioning:** Semantic Versioning (SemVer) è utilizzato per garantire tracciabilità tra release (es. `v1.2.4`).

## 2. Pipeline DevSecOps (CI/CD)
La pipeline di Continuous Integration e Continuous Deployment automatizza la validazione di ogni commit.

### 2.1 Analisi Statica (SAST - Static Application Security Testing)
- Strumenti come **Semgrep** e **SonarQube** vengono eseguiti su ogni Pull Request.
- Rilevano hardcoded secrets, vulnerabilità OWASP Top 10 (es. Injection, XSS) e cattive pratiche crittografiche nel codice Node.js e Javascript.

### 2.2 Analisi delle Dipendenze (Dependency Scanning)
- Viene utilizzato **Trivy** e **npm audit** per analizzare i file `package-lock.json` e `Dockerfile`.
- Le pipeline si bloccano (Build Break) se vengono rilevate vulnerabilità di livello `CRITICAL` o `HIGH` per cui esiste una fix.

### 2.3 Secret Scanning
- L'utilizzo di strumenti come **TruffleHog** o **Gitleaks** assicura che nessuna password, token o chiave privata venga inavvertitamente commitata nel repository git.

### 2.4 Analisi Dinamica (DAST - Dynamic Application Security Testing)
- Prima del rilascio in produzione, l'ambiente di staging è sottoposto a scansioni dinamiche (es. tramite OWASP ZAP) per validare il comportamento delle API in esecuzione (verificando rate-limiting, CORS, e authentication bypass).

## 3. Gestione del Rilascio (Release Process)
- **Immutable Artifacts:** Le immagini Docker vengono buildate una sola volta, firmate (tramite Cosign/Sigstore) e promosse attraverso gli ambienti (Test -> Staging -> Prod). Questo garantisce che ciò che viene testato sia esattamente ciò che va in produzione.
- **GitOps:** Il deployment su Kubernetes è gestito in modo dichiarativo tramite **ArgoCD**. Le modifiche all'infrastruttura passano sempre per Git (Infrastruttura come Codice). Nessun intervento manuale via `kubectl` è permesso sui cluster di produzione.

## 4. Patch Management & Hotfix
- Le patch di sicurezza critiche seguono un percorso accelerato di SDLC. Viene creato un branch `hotfix/` da `main`, testato con CI/CD, e promosso istantaneamente in produzione, bypassando i normali cicli lunghi ma rispettando i controlli automatizzati.
- Le immagini base dei container (Node.js Alpine) vengono aggiornate e ri-buildate periodicamente.

## 5. Mobile App SDLC (React Native)
Il ciclo di vita dell'applicazione mobile segue rigide policy di Continuous Deployment private:
- Il codice è ospitato su repository separato (`caspmail-mobile`).
- Le dipendenze native vengono controllate tramite `expo doctor` per garantire la compatibilità con le release dell'SDK.
- La compilazione finale in file binari (.aab, .ipa) avviene unicamente su infrastrutture CI di terze parti sicure (Expo Application Services), senza stoccaggio di certificati e chiavi di firma sui dispositivi degli sviluppatori.

## 6. Tuning della Sicurezza e False Positives
La pipeline SAST/DAST è costantemente soggetta a tuning per bilanciare sicurezza e produttività:
- **Baseline Semgrep:** Vengono escluse dalle regole di blocco severo infrastrutture YAML (come i file `k8s/` in GitOps) o regex specifiche di Data Loss Prevention che potrebbero scatenare falsi positivi (es. pattern detector che simulano chiavi AWS).
- **Trivy Format & IAM Permissions:** Per repository senza licenza GitHub Advanced Security, gli export SARIF vengono inibiti e le vulnerabilità tabulate nei log crudi della CI.

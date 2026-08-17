# Documento 12 – SBOM (Software Bill of Materials)

L'adozione della distinta base del software (SBOM) è un requisito chiave delle direttive **Cyber Resilience Act (CRA)** e una best practice consolidata per la supply chain security.
Questo documento descrive il processo di generazione della SBOM per i microservizi di CasperMail.

## 1. Processo di Generazione
La generazione della SBOM è un processo completamente automatizzato integrato all'interno della pipeline CI/CD (Secure SDLC).
Ogni volta che un container Docker viene buildato, lo strumento **Trivy (da Aqua Security)** viene eseguito per analizzare in profondità il filesystem e i manifesti dei pacchetti (`package-lock.json`, `node_modules`, pacchetti Alpine Linux base).

### 1.1 Formato Adottato
L'output è generato nel formato standard industriale **CycloneDX** (in JSON), supportato dalla Open Web Application Security Project (OWASP) e universalmente accettato dai tool di Vulnerability Management.

### 1.2 Copertura dell'Inventario
L'inventario generato traccia in maniera esplicita e transitiva:
- **Librerie applicative:** Moduli NPM (Node.js/JavaScript) con relative versioni e licenze (es. `fastify`, `react`).
- **Dipendenze di sistema:** Pacchetti OS inclusi nell'immagine container (`alpine`, `musl`, `openssl`).
- **Dipendenze transitive:** Le librerie importate dalle librerie principali.

## 2. Integrazione con il Vulnerability Management
Le SBOM generate vengono ingerite automaticamente dallo stack di sicurezza per:
- Monitorare l'insorgere di nuove vulnerabilità (CVE) su pacchetti già in produzione (Day-2 Operations).
- Garantire la compliance sulle licenze Open Source (License Scanning) prevenendo violazioni di IP.
- Ridurre il Mean Time To Remediation (MTTR), in quanto il SOC è immediatamente in grado di sapere se e dove una libreria compromessa (es. Log4Shell-style event) è in uso.

## 3. Evidenze (Annexes)
Le SBOM effettive per il Frontend e il Backend di produzione sono state generate e archiviate nella cartella `evidence/sbom/` all'interno di questo repository.
- `evidence/sbom/backend-sbom.json`
- `evidence/sbom/frontend-sbom.json`

*(Consultare i file JSON allegati per l'alberatura completa dei nodi).*

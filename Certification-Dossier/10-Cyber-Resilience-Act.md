# Documento 10 – Cyber Resilience Act (CRA) Readiness

Il *Cyber Resilience Act* europeo introduce requisiti obbligatori di sicurezza informatica per i prodotti hardware e software immessi nel mercato dell'UE (prodotti con elementi digitali). 
CasperMail è progettato per essere "Secure-by-Design" ed è architetturalmente conforme ai requisiti essenziali previsti dalla legislazione imminente.

## 1. Requisiti Essenziali di Sicurezza (Secure-by-Design & By-Default)
- **Configurazioni sicure di default:** CasperMail non prevede credenziali predefinite ("admin/admin"). L'installazione genera dinamicamente password e segreti complessi (tramite HashiCorp Vault). Le policy password e la MFA (WebAuthn) sono forzate by-default per gli utenti con privilegi elevati.
- **Minimizzazione della superficie di attacco:** Il deployment in container Kubernetes (K3s) isola i processi applicativi. Le regole Ingress (Traefik) non espongono componenti non necessarie al di fuori della porta 443. Non vi sono porte SSH o di debug aperte verso l'esterno.
- **Limitazione dei privilegi:** L'applicazione Node.js gira senza privilegi di Root all'interno del container Docker e non ha la capacità di scalare privilegi (Privilege Escalation Prevention).

## 2. Gestione delle Vulnerabilità (Vulnerability Handling)
- **Aggiornamenti di Sicurezza (Patching):** Il ciclo SDLC automatizzato (CI/CD) permette di rilasciare aggiornamenti di sicurezza tempestivi e automatici. 
- **Monitoraggio Continuo (Day-2 Operations):** La presenza di SBOM automatiche (generazione CycloneDX via Trivy) consente il monitoraggio retroattivo. Se domani viene scoperta una CVE su una libreria NPM impiegata, il SOC viene allertato immediatamente incrociando l'NVD (National Vulnerability Database) con la SBOM depositata.

## 3. Trasparenza e Reporting degli Incidenti
- **Tracciabilità delle dipendenze:** Viene fornita totale trasparenza dei componenti di terze parti mediante SBOM.
- **Notifica delle Vulnerabilità Sfruttate:** In caso di un incidente di sicurezza attivo, la telemetria centralizzata in Loki/Grafana garantisce la possibilità di notificare tempestivamente l'ENISA (European Union Agency for Cybersecurity) o i CSIRT nazionali come imposto dal CRA (entro 24 ore dall'identificazione).

## 4. Protezione dell'Integrità del Software
- Le immagini container vengono sottoposte a Build deterministiche e possono essere firmate digitalmente (es. tramite Sigstore/Cosign). Questo assicura agli amministratori che l'immagine Kubernetes in esecuzione non sia stata alterata (Tampering) rispetto a quella validata nella pipeline CI/CD (Supply Chain Security).

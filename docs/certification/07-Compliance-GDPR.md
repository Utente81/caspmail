# Documento 7 – Compliance GDPR (General Data Protection Regulation)

CasperMail è stata progettata seguendo il principio fondamentale della **Privacy by Design e by Default** (Art. 25 GDPR). Questo documento illustra come la piattaforma soddisfa i requisiti del Regolamento Europeo 2016/679.

## 1. Mappatura dei Requisiti GDPR

### 1.1 Liceità, Correttezza e Trasparenza (Art. 5)
- **Minimizzazione dei dati:** Il sistema richiede e immagazzina esclusivamente i dati strettamente necessari per l'erogazione del servizio di posta elettronica (indirizzo e-mail e hash delle credenziali). Nessun dato di profilazione opzionale viene raccolto.
- **Trasparenza:** Sono presenti portali Self-Service tramite Keycloak per permettere agli utenti di visionare i dati del proprio profilo e gestire i consensi attivi.

### 1.2 Sicurezza del Trattamento (Art. 32)
Per garantire un livello di sicurezza adeguato al rischio, CasperMail implementa:
- **Pseudonimizzazione e Cifratura:** Tutte le email (corpo e allegati) sono crittografate at-rest (AES-GCM 256) tramite HashiCorp Vault. Le password sono hashatte tramite Argon2/PBKDF2.
- **Resilienza:** L'architettura Kubernetes e il database PostgreSQL (CloudNativePG) garantiscono la capacità di ripristinare tempestivamente la disponibilità e l'accesso dei dati personali in caso di incidente (Disaster Recovery e High Availability).
- **Test di Sicurezza Periodici:** L'integrazione di test SAST/DAST nella pipeline CI/CD costituisce una procedura per testare, verificare e valutare regolarmente l'efficacia delle misure tecniche.

### 1.3 Diritti dell'Interessato (Artt. 12-23)
- **Diritto all'Oblio (Art. 17):** L'eliminazione di un account dal backend triggera una *Soft-Delete* seguita da una *Hard-Delete* definitiva (dopo il periodo di retention legale). Le chiavi crittografiche associate all'utente in Vault vengono distrutte in modo crittografico (*Crypto-Shredding*), rendendo istantaneamente illeggibili eventuali backup dormienti contenenti le sue e-mail.
- **Diritto alla Portabilità (Art. 20):** L'utente può esportare la propria mailbox in formati standard aperti (es. EML, MBOX) interfacciandosi con le API autorizzate.

## 2. Gestione dei Data Breach (Artt. 33-34)
Grazie all'uso del SIEM integrato (Loki, Grafana, Promtail), CasperMail dispone di allarmi istantanei in caso di accessi anomali.
In caso di potenziale Data Breach:
1. Gli allarmi SOC vengono notificati al Data Protection Officer (DPO) o ai Security Admin.
2. Il sistema è in grado di fornire i log di *Audit* esatti (chi ha effettuato l'accesso, a che ora, da quale IP) per supportare la notifica all'Autorità Garante entro le canoniche **72 ore**.

## 3. Trasferimento Dati Extra-UE
La piattaforma è progettata per operare interamente **On-Premise** o su **Cloud Provider Europei** (es. Aruba, OVH, Exoscale) permettendo al Titolare del Trattamento di avere il pieno controllo della sovranità del dato (Data Sovereignty), senza trasferimenti occulti verso Paesi Terzi non adeguati.

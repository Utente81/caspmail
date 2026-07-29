# Documento 15 – Incident Response (IR)

Il Piano di Risposta agli Incidenti (IRP) di CasperMail è progettato per minimizzare l'impatto di violazioni di sicurezza, attacchi Denial of Service o malfunzionamenti critici, assicurando il ripristino dei servizi e la comunicazione agli stakeholder entro i parametri legali (es. 72 ore per il GDPR, 24 ore per la NIS2).

## 1. Fasi della Risposta agli Incidenti

### 1.1 Preparazione (Preparation)
- **Strumentazione:** Il Security Operations Center (SOC) ha accesso alla piattaforma Grafana/Loki che aggrega i log in tempo reale.
- **Formazione:** Il team tecnico effettua simulazioni annuali (Tabletop Exercises) su scenari quali ransomware, furto di token JWT e data exfiltration.

### 1.2 Identificazione (Identification)
L'identificazione è quasi interamente demandata agli alert automatici configurati su Prometheus/Loki, che inviano webhook (es. su Slack o PagerDuty) in caso di:
- Tentativi ripetuti di login falliti (Brute-force).
- Modifiche massicce ai permessi RBAC in Keycloak.
- Anomalie nel traffico di rete (es. Spike di richieste API dal Traefik proxy).

### 1.3 Contenimento (Containment)
A seconda della gravità, le misure di contenimento possono includere:
- **Short-Term:** Revoca istantanea di tutti i Token JWT attivi per un tenant compromesso.
- **Network Isolation:** Modifica on-the-fly delle Network Policies di Kubernetes per isolare un container infetto o bloccare l'accesso pubblico (Drop Traffic) dall'Ingress, mantenendo in vita l'istanza per le indagini (Forensics).
- **Vault Seal:** In caso estremo di compromissione del database o dell'infrastruttura, un amministratore può invocare l'API `vault operator seal`. Questo blocca istantaneamente l'Encryption as a Service, congelando ogni accesso ai dati fino allo sblocco manuale (Unseal) da parte di N amministratori.

### 1.4 Eradicazione (Eradication)
- Identificazione della root cause (es. patch non applicata o credenziale rubata).
- Eliminazione della minaccia distruggendo i pod compromessi e ricreandoli automaticamente dallo stato dichiarativo pulito di ArgoCD (Immutability).
- Cambio di tutte le password, chiavi master e secret token coinvolti.

### 1.5 Ripristino (Recovery)
Il ripristino avviene reindirizzando il traffico sulle istanze pulite (o cluster di Disaster Recovery). Il sistema viene strettamente monitorato per le 48 ore successive.

### 1.6 Lezioni Apprese (Lessons Learned)
Ogni incidente maggiore termina con una riunione Post-Mortem (*blameless*) entro 5 giorni. Viene stilato un report per capire come l'attaccante sia entrato, perché le difese non l'abbiano bloccato prima, e quali regole SIEM/WAF debbano essere aggiunte per prevenire il ripetersi dell'evento.

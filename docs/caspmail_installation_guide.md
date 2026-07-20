# 🛠 Guida all'Installazione CaspMail Enterprise

Benvenuto nella documentazione ufficiale di installazione di **CaspMail Enterprise**. CaspMail è una piattaforma Cloud-Native basata sull'architettura Zero-Trust, progettata per operare all'interno di cluster Kubernetes ad alta sicurezza.

> [!WARNING]
> Questa guida presuppone una profonda conoscenza di Kubernetes (K3s), di gestione di infrastrutture Linux e reti (Network Policies, Ingress, DNS). L'architettura è sensibile alle variazioni IP, pertanto richiede pianificazione di rete.

## 1. Prerequisiti Hardware e di Rete

Per un ambiente di Produzione On-Premise, è necessaria la seguente topologia di server:

| Server | Ruolo | Requisiti Hardware | IP (Esempio) |
|--------|-------|--------------------|--------------|
| **Server 1** | Nodo Principale (K3s, App, DB, Vault Main) | 4 vCPU, 16 GB RAM, 100GB SSD | `192.168.189.200` |
| **Server 2** | Vault Transit Node (Auto-Unseal) | 2 vCPU, 4 GB RAM, 20GB SSD | `192.168.189.203` |

### Configurazioni di Rete Obbligatorie
- **IP Statico**: Configurare IP statici per entrambi i server (es. via `Netplan` o Router DHCP Binding). Il cambio dell'IP del Server 1 corromperà i certificati interni TLS di K3s.
- **Porte Server 1 (Inbound)**: `80` (HTTP), `443` (HTTPS), `6443` (KubeAPI, opzionale).
- **Porte Server 2 (Inbound)**: `30000` (porta esposta per il servizio Vault Transit).

## 2. Configurazione Server 2 (Transit Vault - Zero Trust)

Il Server 2 detiene la chiave crittografica suprema (Master Key) per sbloccare la cassaforte del Server 1 senza intervento umano al riavvio, secondo il principio Zero-Trust.

1. **Installa K3s:**
   ```bash
   curl -sfL https://get.k3s.io | sh -s - server --disable traefik --write-kubeconfig-mode 644
   ```
2. **Deploy Transit Vault:**
   - Applica i manifest YAML del Vault sul Server 2 (Service tipo NodePort sulla porta 30000).
   - Inizializza il Vault: `vault operator init`
   - Salva i **Transit Unseal Keys** e il **Root Token** in un Password Manager esterno.
   - Crea il token per l'Auto-Unseal (destinato al Server 1).

## 3. Configurazione Server 1 (Nodo Principale CaspMail)

1. **Installa K3s:**
   ```bash
   curl -sfL https://get.k3s.io | sh -s - server --write-kubeconfig-mode 644
   ```
2. **Distribuzione Servizi Core (in ordine):**
   1. **Vault (HA)**: Configura Vault con storage `raft` e abilita l'opzione `awskms` sfruttando l'endpoint del Server 2 per il meccanismo di Auto-Unseal. Inizializza Vault e sbloccalo la prima volta.
   2. **CloudNativePG**: Installa l'operatore PostgreSQL e il cluster. Usa Vault (transit) per criptare dinamicamente le credenziali o i backup S3-compatibili.
   3. **Keycloak (Identity & Access Management)**: Applica la configurazione. Keycloak gestirà WebAuthn (Passkeys) e SSO.

> [!CAUTION]
> Vault deve risultare in stato **Unsealed** prima di poter deployare Backend e Frontend. Il Backend Node.js dipende dal Vault per recuperare dinamicamente le credenziali del database (Dynamic Secrets).

## 4. Deploy Applicativo (Paradigma GitOps)

L'intera piattaforma applicativa CaspMail viene erogata in modalità **GitOps** tramite ArgoCD.

1. Installa ArgoCD sul cluster principale.
2. Inietta il manifest dell'`Application` ArgoCD puntando al repository GitHub del progetto:
   ```yaml
   apiVersion: argoproj.io/v1alpha1
   kind: Application
   metadata:
     name: caspermail
     namespace: argocd
   spec:
     source:
       repoURL: 'git@github.com:Utente81/caspmail.git'
       path: k8s
       targetRevision: HEAD
     destination:
       server: 'https://kubernetes.default.svc'
       namespace: caspermail
     syncPolicy:
       automated:
         prune: true
         selfHeal: true
   ```
3. ArgoCD creerà i Deployment e scaricherà l'ultima versione delle immagini `caspermail-backend` e `caspermail-frontend` dal Container Registry.

## 5. Primi Passi & Verifica
- Assicurati che l'Ingress Traefik sia reindirizzando il traffico ai pod.
- Modifica il file `hosts` del client o configura un DNS locale per far puntare i domini di CaspMail all'IP del Server 1.
- Naviga all'indirizzo del pannello SOC o della Dashboard Admin.
- Il primo utente deve essere creato manualmente su Keycloak o tramite la piattaforma Admin integrata.
- **Quota Storage**: I nuovi utenti saranno automaticamente istanziati con la quota protetta di 500 MB definita a livello di cluster e API.

# CasperMail Enterprise Suite 🛡️✉️

CasperMail is a military-grade, next-generation enterprise communication and security operations suite. It merges an end-to-end encrypted mail client with a real-time SOC (Security Operations Center) Threat Map, governed by strict Role-Based Access Control (RBAC) and hardware-backed biometric authentication.

![CasperMail Suite](https://img.shields.io/badge/Status-Active-success) ![Kubernetes](https://img.shields.io/badge/Platform-Kubernetes-326ce5?logo=kubernetes) ![Vault](https://img.shields.io/badge/Security-HashiCorp%20Vault-000000?logo=vault) ![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react) ![Fastify](https://img.shields.io/badge/Backend-Fastify-000000?logo=fastify)

---

## 🌟 Key Features

### 1. 🔐 Zero-Trust Identity & Biometrics
- **WebAuthn / Passkey Native**: Passwordless, biometric-first login (Windows Hello, Touch ID, YubiKey) natively integrated via Keycloak.
- **Enterprise SSO & RBAC**: Strict separation of duties. Super Admins, Tenant Admins, SOC Analysts, and End Users are logically isolated.
- **Dynamic Vault Secrets**: Database and internal infrastructure passwords are automatically rotated by HashiCorp Vault. Zero standing privileges.

### 2. 🌍 Advanced SOC & Threat Intelligence
- **Real-Time 3D Threat Map**: WebGL-powered 3D globe visualizing inbound cyber attacks via Server-Sent Events (SSE).
- **SIEM Export (Splunk / QRadar)**: Asynchronous Webhook-based integration to forward High/Critical severity events to enterprise SIEMs (JSON/CEF format).
- **Anti-SSRF SOAR Engine**: Playbooks feature autonomous incident response with built-in network boundary protections.

### 3. 📧 Secure Webmail & Client-Side DLP
- **End-to-End Encryption**: Secure message drafting with robust client-side isolation.
- **Data Loss Prevention (DLP)**: Prevents exfiltration of PII (Credit Cards, IBANs, SSNs) directly in the browser before data reaches the network layer, generating instant SOC telemetry.

### 4. ⚙️ Cloud-Native & High Availability
- **CloudNativePG PostgreSQL**: Database high-availability clustering, continuous archiving, and disaster recovery via MinIO.
- **GitOps Ready**: Fully automated, declarative deployments powered by ArgoCD.
- **PLG Observability Stack**: Real-time log aggregation and monitoring via Prometheus, Loki, Promtail, and Grafana.

---

## 🏗️ Architecture Overview

The system is deployed on Kubernetes (K8s) using a microservices pattern:

- **Frontend**: React 18 (Vite, TailwindCSS).
- **Backend API**: Fastify (Node.js).
- **Identity Provider**: Keycloak 24+ (OIDC PKCE).
- **KMS**: HashiCorp Vault (raft storage, HA mode).
- **Database**: PostgreSQL (CloudNativePG Operator).
- **Ingress**: Traefik (Strict CSP headers, TLS termination).

*For a detailed technical breakdown, please refer to the [ARCHITECTURE.md](docs/ARCHITECTURE.md) guide.*

---

## 🚀 Deployment (GitOps)

CasperMail is designed for seamless, automated deployment via **ArgoCD**.

1. **Bootstrap the Cluster**:
   Ensure your Kubernetes cluster has ArgoCD and Traefik installed.
2. **Apply the Application**:
   Apply the root ArgoCD application manifest which tracks this repository's `k8s/` directory.
   ```bash
   kubectl apply -f argocd-app-caspermail.yaml
   ```
3. **Vault Initialization**:
   Once deployed, unseal the Vault StatefulSet manually (if auto-unseal is not configured) and initialize the Keycloak/PostgreSQL database connections using the provided initialization scripts.

---

## 📚 Documentation

- [Technical Architecture Deep Dive](docs/ARCHITECTURE.md)
- [Enterprise Sales Pitch & Value Proposition](docs/SALES_PITCH.md)

---

## ⚖️ License
Confidential and Proprietary. All rights reserved. Designed for Enterprise compliance (NIS2, GDPR, ISO 27001).

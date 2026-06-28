# CasperMail Enterprise Suite 🛡️✉️

CasperMail is a next-generation, highly secure enterprise communication and security operations suite. It combines an encrypted mail client with a real-time SOC (Security Operations Center) Threat Map, governed by robust Role-Based Access Control (RBAC) powered by Keycloak OIDC.

![CasperMail Suite](https://img.shields.io/badge/Status-Active-success) ![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react) ![Fastify](https://img.shields.io/badge/Backend-Fastify-000000?logo=fastify) ![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql) ![Keycloak](https://img.shields.io/badge/Auth-Keycloak-blue?logo=keycloak)

---

## 🌟 Key Features

### 1. 📧 Secure Webmail
- **End-to-End Encryption Readiness**: Secure PGP key management and encrypted message drafting.
- **Responsive Interface**: Modern, dark-themed UI built with Tailwind CSS.
- **Real-time Notifications**: Native browser notifications for incoming messages.

### 2. 🌍 SOC Threat Map (Security Operations Center)
- **WebGL 3D Globe**: Real-time visualization of inbound cyber attacks using `react-globe.gl`.
- **Live Event Stream**: Event-Driven architecture using Server-Sent Events (SSE) to push threats instantly from the backend.
- **MITRE ATT&CK & UEBA**: Advanced telemetry mapping and User Entity Behavior Analytics scoring for intelligent threat clustering.

### 3. 🔐 Enterprise Authentication (Identity Provider)
- **Keycloak OIDC Integration**: Fully standard OpenID Connect PKCE flow.
- **Single Sign-On (SSO) & Single Sign-Out**: Seamlessly switch between Mail, SOC, and Admin portals without re-authenticating. Clean session termination.
- **Role-Based Access Control (RBAC)**: Strict separation of duties (e.g., SOC Analysts cannot read user emails; Standard users cannot view the threat map).

### 4. ⚙️ Admin Console
- **Centralized Management**: Manage domains, tenants, users, and aliases.
- **Audit Trails**: Security auditing capabilities and permission enforcement.

---

## 🏗️ Architecture

The application follows a modern decoupled architecture:

*   **Frontend (SPA)**: React 18 bundled with Vite. Contains 4 separate entry points (Login, Admin, Mail, SOC) to keep bundle sizes optimized.
*   **Backend (API)**: Fastify (Node.js) providing REST endpoints and SSE streams.
*   **Database**: PostgreSQL for persistent storage of users, emails, and SOC logs.
*   **Identity**: Keycloak handles all users, roles, and issues JWT tokens.
*   **Reverse Proxy**: NGINX handles SSL termination, serves static frontend files, and proxies API requests to the Fastify backend.

---

## 🚀 Getting Started

### Prerequisites
*   Docker & Docker Compose
*   Node.js 18+ (for local development)

### Installation & Deployment (Production / Docker)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Utente81/caspmail.git
   cd caspmail
   ```

2. **Configure Environment:**
   Ensure your `.env` file (not committed to git) contains the required database passwords and Keycloak secrets.

3. **Deploy the stack:**
   ```bash
   docker compose up -d --build
   ```

4. **Access the application:**
   - **Login Portal**: `https://secure.internal/console/login`
   *(Note: Ensure your local DNS or `/etc/hosts` resolves `secure.internal` to your server's IP).*

### Local Development

1. **Start the Database and Keycloak:**
   ```bash
   docker compose up -d db pgadmin keycloak
   ```

2. **Run the Backend:**
   ```bash
   cd backend
   npm install
   npm run start
   ```

3. **Run the Frontend (Hot-Reload):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 🛠️ Tech Stack

*   **UI/UX**: React, Vite, Tailwind CSS, Lucide Icons
*   **Data Visualization**: react-globe.gl, Three.js
*   **Backend API**: Fastify, pg (node-postgres)
*   **Authentication**: Keycloak (OIDC PKCE flow)
*   **Infrastructure**: Docker, NGINX

---

## 📄 License
Confidential and Proprietary. All rights reserved.

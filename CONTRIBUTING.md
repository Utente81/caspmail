# Contributing to CasperMail

First off, thank you for considering contributing to CasperMail! It's people like you that make CasperMail such a great tool for secure, military-grade communication.

## 🌟 The Open-Core Model

CasperMail operates on an **Open-Core** model. This means that the core functionality is open-source and free to use (Community Edition), while advanced features tailored for large organizations are part of our commercial offering (Enterprise Edition).

### What belongs in the Community Edition?
- Core email client functionality.
- Basic end-to-end encryption.
- Standard authentication (Username/Password + Basic 2FA).
- Single-node PostgreSQL database setup.
- Basic UI/UX.

### What is reserved for the Enterprise Edition?
*Please do not submit PRs for these features, as they are maintained in a private repository:*
- HashiCorp Vault integrations (Dynamic Secrets, HA KMS).
- Enterprise SIEM integrations (Splunk, QRadar webhooks).
- 3D Threat Map and SOAR Playbooks.
- Advanced DLP (Data Loss Prevention) rules.
- High Availability (HA) Kubernetes operators (CloudNativePG clustering).
- SSO/SAML integrations for corporate Identity Providers.

---

## 🛠️ How to Contribute

### 1. Reporting Bugs
- Make sure you are on the latest main branch.
- Check if the issue has already been reported.
- Use the Bug Report template to provide logs, OS details, and steps to reproduce.

### 2. Suggesting Enhancements
- Open a discussion or an issue proposing your feature.
- Ensure the feature aligns with the Community Edition scope (see above).

### 3. Pull Requests
- Fork the repository and create your branch from `main`.
- If you've added code that should be tested, add tests.
- Ensure the test suite passes (`npm test`).
- Issue that PR!

## 💖 Support the Project

If you use CasperMail in your daily operations or simply want to support the development of secure, privacy-first communication tools, consider becoming a sponsor!

- **[Sponsor us on GitHub](https://github.com/sponsors/tuo-username)**
- Sponsor tiers include priority bug fixes, logo placement on our README, and direct consultations.

Your support helps us keep the lights on and the code secure!

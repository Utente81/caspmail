# Contributing to CasperMail

First off, thank you for considering contributing to CasperMail! It's people like you that make CasperMail such a great tool for secure, military-grade communication.

## 🌟 Enterprise Codebase

CasperMail is a highly secure, proprietary Enterprise Suite. We welcome bug reports and feature requests from our partners and users, but we currently do not accept unsolicited pull requests that modify core security components without prior architectural approval.

### Code Constraints
- All cryptography changes must be vetted against our FIPS 140-2 compliance checklist.
- Vault integration secrets must never be mocked in production.
- Do not submit PRs for SIEM exporters without consulting the SOC mapping guidelines.

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

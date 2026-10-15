# Project Proposal: SwimMeet Lite

## Short description
SwimMeet Lite is a small web application for recording swimmers and swim meets and registering swimmers for meets. It demonstrates a three-module application containerized with Docker and deployed through a Jenkins CI/CD pipeline. PostgreSQL stores records in a named volume. Git pushes trigger automated tests, image builds, deployment, and smoke verification.

## Roles
- Project Lead / Scrum Master: [Name]
- DevOps / CI-CD Engineer: [Name]
- Infrastructure Engineer: [Name]
- Backend and Database Engineer: [Name]
- Frontend, QA, and Documentation Lead: [Name]

## Technology choices
- HTML/CSS/JavaScript: simple user interface
- Node.js 20 + Express: small REST APIs
- PostgreSQL 16 Alpine: relational persistence
- Nginx Alpine: one public entry point and path routing
- Docker Compose: repeatable multi-container startup
- Jenkins: automated CI/CD
- Jest + Supertest: API unit tests

## Pipeline plan
Checkout -> Test -> Build Images -> Deploy -> Smoke Test

## Repository URL
[Add GitHub repository URL]

## Draft architecture
See `architecture.md`.

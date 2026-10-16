# SwimMeet Lite

A small swim-meet registration system built to demonstrate Docker, Docker Compose, PostgreSQL persistence, and Jenkins CI/CD.

## Stack
- Frontend: HTML/CSS/JavaScript served by Nginx
- Swimmer API: Node.js 20 + Express
- Meet API: Node.js 20 + Express
- Database: PostgreSQL 16
- Reverse proxy: Nginx
- CI/CD: Jenkins Pipeline
- Tests: Jest (backend unit tests) and HTTP smoke checks

## Requirements
- Docker Desktop with WSL 2 on Windows, or Docker Engine on Linux
- Git
- GitHub repository for automatic push triggers
- Optional: ngrok if you want to use a GitHub webhook to a local Jenkins instance

## 1. Run the app locally
1. Copy `.env.example` to `.env`.
2. Change the example passwords in `.env` to your own local development values.
3. From this directory run:

   ```powershell
   docker compose up -d --build
   ```

4. Open http://localhost:8082
5. Check status:

   ```powershell
   docker compose ps
   docker compose logs -f
   ```

The frontend supports adding swimmers, creating meets, and registering swimmers for meets. API endpoints:
- `GET /api/swimmers/health`
- `GET /api/swimmers/`
- `POST /api/swimmers/`
- `GET /api/meets/health`
- `GET /api/meets/`
- `POST /api/meets/`
- `POST /api/meets/:meetId/registrations`

## 2. Persistence check
Create a swimmer, then run:

```powershell
docker compose down
docker compose up -d
```

The swimmer should still be there because PostgreSQL uses the named volume `swimmeet-db-data`. **Do not use `docker compose down -v`** when testing persistence; `-v` deletes the volume.

## 3. GitHub setup
Create an empty GitHub repository, then:

```powershell
git add .
git commit -m "Initial SwimMeet Lite project"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the example remote with your actual repository URL. Do not commit `.env`.

## 4. Start Jenkins separately
Jenkins is deliberately in a separate Compose project so app deployments do not redeploy Jenkins.

```powershell
cd infra/jenkins
docker compose up -d --build
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open http://localhost:8081, complete setup, install suggested plugins and the **Docker Pipeline** plugin. Create an admin user.

The Jenkins container uses the host Docker socket for this classroom project. This grants Jenkins extensive control over Docker and is **not a production-safe configuration**.

## 5. Jenkins credentials and job
1. In Jenkins, go to **Manage Jenkins → Credentials**.
2. Add a **Secret file** credential containing the same environment variables as your local `.env`; use ID `swimmeet-env`.
3. Create a **Pipeline** job, choose **Pipeline script from SCM**, Git, your repository URL, branch `main`, and Script Path `Jenkinsfile`.
4. Ensure GitHub and Pipeline plugins are installed.

### Automatic trigger
Preferred: enable **GitHub hook trigger for GITScm polling** in the job and configure a GitHub webhook to:
`https://YOUR-PUBLIC-JENKINS-URL/github-webhook/`
Content type: `application/json`; event: push. For a local Jenkins, a tunnel such as ngrok may be needed.

Fallback: enable **Poll SCM** in the job with schedule `H/2 * * * *`. This checks for commits about every two minutes. Do not rely on clicking Build Now for the automatic-trigger demonstration.

## 6. Pipeline stages
The Jenkinsfile runs:
1. Checkout
2. Test (Docker test targets; a failure stops the pipeline)
3. Build Images (tagged with Jenkins build number)
4. Deploy (only after tests pass)
5. Smoke Test

Jenkins needs Docker CLI and Compose plugin access, provided by the custom Jenkins image.

## 7. Failed-test quality gate
Temporarily add a deliberately failing assertion to `swimmer-api/tests/app.test.js`, commit and push it. Jenkins should fail in the Test stage before Deploy. Revert the test change afterward. Do this only in a practice branch if you do not want a failed build on `main`.

## 8. Rollback
Images are tagged with Jenkins build numbers. To roll back to an earlier successful build tag, from the repository root (with a valid `.env`):

```powershell
$env:TAG = "1"
docker compose up -d --no-build
```

Replace `1` with a build number that exists locally. Compose uses the matching tagged images and does not rebuild. The database volume is unchanged. On Windows PowerShell, clear the override afterwards with `Remove-Item Env:TAG` if needed.

## Repository map
- `frontend/`: browser interface and Dockerfile
- `swimmer-api/`: swimmer REST API and tests
- `meet-api/`: meet REST API and tests
- `proxy/`: Nginx entry-point configuration
- `db/`: initial PostgreSQL schema and seed data
- `infra/jenkins/`: separate Jenkins deployment
- `Jenkinsfile`: pipeline as code at repository root

## Notes / limitations
- This is a classroom demonstration, not a production-ready application.
- Authentication, authorization, payments, and production hardening are intentionally out of scope.
- The GitHub webhook, Jenkins credentials, live build, rollback, and screenshots must be configured/verified in your own environment. A ZIP cannot include your private GitHub credentials or prove that the pipeline has already run.

<!-- CI trigger verification -->

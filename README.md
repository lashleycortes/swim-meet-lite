# SwimMeet Lite

A swim-meet registration system demonstrating Docker, Docker Compose,
PostgreSQL persistence, and Jenkins CI/CD.

## Technology stack

-   **Frontend:** HTML, CSS, and JavaScript served by Nginx
-   **Swimmer API:** Node.js 20 and Express
-   **Meet API:** Node.js 20 and Express
-   **Database:** PostgreSQL 16
-   **Reverse proxy:** Nginx
-   **CI/CD:** Jenkins Pipeline
-   **Testing:** Jest backend tests and HTTP smoke checks

## Requirements

-   Docker Desktop with WSL 2 on Windows, or Docker Engine on Linux
-   Git
-   A GitHub repository for source control and automatic SCM polling
-   Optional: a publicly reachable Jenkins URL or tunnel such as ngrok
    for a GitHub webhook to a local Jenkins instance

## 1. Run the application locally

1.  Copy `.env.example` to `.env`.

2.  Replace example passwords with your own local development values.

3.  From the project root, run:

    ``` powershell
    docker compose up -d --build
    ```

4.  Open <http://localhost:8082>.

5.  Check container status and logs:

    ``` powershell
    docker compose ps
    docker compose logs -f
    ```

The frontend supports adding swimmers, creating meets, and registering
swimmers for meets.

### API endpoints

  ------------------------------------------------------------------------------------
  Method                  Endpoint                             Purpose
  ----------------------- ------------------------------------ -----------------------
  `GET`                   `/api/swimmers/health`               Swimmer API health
                                                               check

  `GET`                   `/api/swimmers/`                     List swimmers

  `POST`                  `/api/swimmers/`                     Create a swimmer

  `GET`                   `/api/meets/health`                  Meet API health check

  `GET`                   `/api/meets/`                        List meets

  `POST`                  `/api/meets/`                        Create a meet

  `POST`                  `/api/meets/:meetId/registrations`   Register a swimmer for
                                                               a meet
  ------------------------------------------------------------------------------------

## 2. Verify database persistence

PostgreSQL uses the named Docker volume `swimmeet-db-data`.

1.  Create a swimmer using the application.
2.  Restart the application containers or database.
3.  Reopen the application and verify that the swimmer remains.

To recreate the Compose containers, run:

``` powershell
docker compose down
docker compose up -d
```

**Do not use `docker compose down -v` for this test.** The `-v` option
removes Compose-managed volumes and can delete persisted database data.

In the development environment, persistence was checked across
application-container restarts and a database-container restart; the
observed record counts remained unchanged.

## 3. GitHub setup

For a new repository, create an empty GitHub repository and configure
its remote from the project root:

``` powershell
git add .
git commit -m "Initial SwimMeet Lite project"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the example URL with your actual repository URL. If the remote
is already configured, do not add it again.

**Do not commit `.env` or credentials.** Use `.env.example` for safe
example configuration and keep actual secrets in local environment files
or Jenkins credentials.

## 4. Run Jenkins separately

Jenkins is deployed as a separate Compose project so application
deployments do not redeploy Jenkins.

From the project root:

``` powershell
cd infra/jenkins
docker compose up -d --build
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open <http://localhost:8081>, complete initial setup, install the
required plugins, and create an administrator account.

The Jenkins container uses the host Docker socket for this classroom
project. This gives Jenkins extensive control over Docker and is **not a
production-safe configuration**.

## 5. Configure Jenkins credentials and job

1.  In Jenkins, open **Manage Jenkins → Credentials**.
2.  Add a **Secret file** credential containing the required environment
    variables. Set its ID to `swimmeet-env`.
3.  Create a **Pipeline** job.
4.  Choose **Pipeline script from SCM**, select Git, enter the
    repository URL, select branch `main`, and set Script Path to
    `Jenkinsfile`.
5.  Ensure the necessary Git, Pipeline, and Docker/Compose tooling is
    available to Jenkins.

The pipeline copies the credential file to `.env` for build/deployment
and removes `.env` in post-build cleanup.

## 6. Automatic SCM triggering

The Jenkinsfile is configured for GitHub push triggering and Poll SCM.
The polling schedule is:

``` text
H/2 * * * *
```

This checks for source changes approximately every two minutes. A commit
pushed to the tracked branch can start a build without clicking **Build
Now**.

A GitHub webhook can also be configured by enabling **GitHub hook
trigger for GITScm polling** and setting the webhook URL to:

``` text
https://YOUR-PUBLIC-JENKINS-URL/github-webhook/
```

Use `application/json` as the content type and subscribe to push events.
A local Jenkins instance generally needs to be reachable from GitHub for
webhook delivery.

**Verified in this project:** Jenkins build #10 was reported as started
by an SCM change after a repository update. Build #11 completed
successfully from `origin/main`.

## 7. Jenkins pipeline stages

The pipeline stages are:

1.  **Checkout** --- retrieves the repository source.
2.  **Prepare Environment** --- loads the environment file from Jenkins
    credentials.
3.  **Test** --- builds the API Docker test targets, which run Jest in
    their Dockerfile test stages.
4.  **Build Images** --- builds the frontend, APIs, and reverse-proxy
    images using the Jenkins build number as the tag.
5.  **Deploy** --- starts or recreates application containers using the
    built images.
6.  **Smoke Test** --- checks swimmer and meet API health endpoints
    through the reverse proxy.

A failure in a stage prevents later normal stages from running. The
Jenkinsfile also contains failure-post logic intended to restore the
previous build's tagged images if rollback images are available.

### Latest recorded pipeline evidence

Jenkins build **#11** finished with `SUCCESS`. Its console output shows
all four application images were built with tag `11`, application
containers were recreated, both APIs became healthy, and both API health
endpoints passed the smoke checks.

The test stages completed successfully in that build, but Docker
reported cached layers for the `npm test` steps. That build log does not
prove Jest re-executed from scratch during build #11.

## 8. Rollback

Application images are tagged with Jenkins build numbers. The
Jenkinsfile contains automatic rollback logic in its failure
post-action. It checks whether images for the immediately preceding
build number are available, then attempts to start the application with
that tag and checks both API health endpoints.

**Rollback status:** implemented in the Jenkinsfile, but not yet
verified by deliberately inducing a failed deployment. The fallback
assumes the immediately preceding build number is the appropriate
rollback version; a production-grade deployment should track the last
known-good deployment explicitly.

A manual rollback can be performed from the repository root when the
matching images exist locally and a valid `.env` is available. For
example, to select build tag `10`:

``` powershell
$env:TAG = "10"
docker compose up -d --no-build
```

Replace `10` with the desired existing image tag. The command does not
rebuild images, and it does not remove the database volume. Afterwards,
clear the PowerShell environment override if needed:

``` powershell
Remove-Item Env:TAG
```

Use a known-good build tag and confirm API health endpoints after a
manual rollback.

## Repository map

-   `frontend/` --- browser interface and Dockerfile
-   `swimmer-api/` --- swimmer REST API, Dockerfile, and tests
-   `meet-api/` --- meet REST API, Dockerfile, and tests
-   `proxy/` --- Nginx reverse-proxy configuration
-   `db/` --- PostgreSQL initialization schema and seed data
-   `infra/jenkins/` --- separate Jenkins deployment
-   `Jenkinsfile` --- pipeline-as-code definition at the repository root

## Notes and limitations

-   This is a classroom demonstration, not a production-ready
    application.
-   Authentication, authorization, payments, and production hardening
    are outside the current scope.
-   The Docker socket gives Jenkins substantial host control and should
    be replaced with a safer build/deployment architecture for
    production.
-   The successful build and smoke checks are evidenced by Jenkins build
    #11. Database persistence was checked across container restarts.
-   Automatic rollback is present in the Jenkinsfile but has not been
    failure-tested.
-   Keep secrets out of source control and rotate any credential that
    may have been exposed.


pipeline {
  agent any

  environment {
    COMPOSE_PROJECT_NAME = 'swimmeet'
    TAG = "${env.BUILD_NUMBER}"
  }

  triggers {
    githubPush()
    pollSCM('H/2 * * * *')
  }

  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '15'))
    timestamps()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Prepare Environment') {
      steps {
        withCredentials([file(credentialsId: 'swimmeet-env', variable: 'ENV_FILE')]) {
          sh '''
            cp "$ENV_FILE" .env
          '''
        }
      }
    }

    stage('Test') {
      steps {
        sh 'docker build --target test -t swimmeet-swimmer-api:test ./swimmer-api'
        sh 'docker build --target test -t swimmeet-meet-api:test ./meet-api'
      }
    }

    stage('Build Images') {
      steps {
        sh 'docker compose build'
      }
    }

    stage('Deploy') {
      steps {
        sh 'docker compose up -d --no-build --remove-orphans'
      }
    }

    stage('Smoke Test') {
      steps {
        sh '''
          PROXY_ID=$(docker compose ps -q proxy)

          if [ -z "$PROXY_ID" ]; then
            echo "Smoke test failed: proxy container not found"
            docker compose ps
            exit 1
          fi

          for i in $(seq 1 18); do
            if docker exec "$PROXY_ID" wget -qO- http://127.0.0.1/api/swimmers/health >/dev/null \
              && docker exec "$PROXY_ID" wget -qO- http://127.0.0.1/api/meets/health >/dev/null; then
              echo "Smoke tests passed: both API health endpoints returned successfully"
              exit 0
            fi

            echo "Waiting for API health endpoints..."
            sleep 5
          done

          echo "Smoke test failed"
          docker compose ps
          exit 1
        '''
      }
    }
  }

  post {
    success {
      echo "SwimMeet Lite build ${TAG} deployed successfully."
    }

    failure {
      echo "Pipeline failed. Check the failed stage."

      script {
        if (env.TAG != '1') {
          def previousTag = (env.BUILD_NUMBER.toInteger() - 1).toString()

          try {
            withEnv(["ROLLBACK_TAG=${previousTag}"]) {
              sh '''
                set -eu

                echo "Checking availability of rollback images: $ROLLBACK_TAG"

                docker image inspect \
                  "swimmeet-frontend:$ROLLBACK_TAG" \
                  "swimmeet-swimmer-api:$ROLLBACK_TAG" \
                  "swimmeet-meet-api:$ROLLBACK_TAG" \
                  "swimmeet-proxy:$ROLLBACK_TAG" >/dev/null

                echo "Restoring application images from build $ROLLBACK_TAG"
                TAG="$ROLLBACK_TAG" docker compose up -d --no-build --remove-orphans

                PROXY_ID=$(docker compose ps -q proxy)
                [ -n "$PROXY_ID" ]

                for i in $(seq 1 18); do
                  if docker exec "$PROXY_ID" wget -qO- http://127.0.0.1/api/swimmers/health >/dev/null \
                    && docker exec "$PROXY_ID" wget -qO- http://127.0.0.1/api/meets/health >/dev/null; then
                    echo "Rollback to build $ROLLBACK_TAG succeeded"
                    exit 0
                  fi

                  echo "Waiting for rollback health checks..."
                  sleep 5
                  PROXY_ID=$(docker compose ps -q proxy)
                  [ -n "$PROXY_ID" ]
                done

                echo "Rollback health checks failed"
                docker compose ps
                exit 1
              '''
            }
          } catch (err) {
            echo "Automatic rollback failed. Manual recovery is required: ${err}"
            currentBuild.result = 'FAILURE'
          }
        } else {
          echo "No previous build number is available for automatic rollback."
        }
      }
    }

    always {
      sh 'rm -f .env || true'
    }
  }
}

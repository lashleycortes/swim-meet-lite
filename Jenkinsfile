pipeline {
  agent any

  environment {
    COMPOSE_PROJECT_NAME = 'swimmeet'
    TAG = "${env.BUILD_NUMBER}"
  }

  triggers {
    // Requires the GitHub plugin; also enable "GitHub hook trigger for GITScm polling" in the job.
    githubPush()
    // Polling is a fallback when a webhook cannot reach local Jenkins.
    pollSCM('H/2 * * * *')
  }

  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '15'))
    timestamps()
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
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
        withCredentials([file(credentialsId: 'swimmeet-env', variable: 'ENV_FILE')]) {
          sh '''
            cp "$ENV_FILE" .env
            docker compose up -d --no-build --remove-orphans
          '''
        }
      }
    }

    stage('Smoke Test') {
      steps {
        sh '''
          for i in $(seq 1 18); do
            if docker compose exec -T proxy wget -qO- http://localhost/api/swimmers/health >/dev/null \
              && docker compose exec -T proxy wget -qO- http://localhost/api/meets/health >/dev/null; then
              echo "Smoke tests passed"
              exit 0
            fi
            echo "Waiting for app health..."
            sleep 5
          done
          echo "Smoke test failed"
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
      echo "Pipeline failed. Check the failed stage; deployment should not run if Test failed."
    }
    always {
      sh 'rm -f .env || true'
    }
  }
}

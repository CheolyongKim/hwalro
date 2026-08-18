pipeline {
    agent any

    options {
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
    }

    environment {
        REGISTRY_URL = "${env.REGISTRY_URL ?: '123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/hwalro'}"
        AWS_REGION = "${env.AWS_REGION ?: 'ap-northeast-2'}"
        EC2_HOST = "${env.EC2_HOST ?: ''}"
        EC2_USER = "${env.EC2_USER ?: 'ubuntu'}"
        SSH_CREDENTIALS_ID = "${env.SSH_CREDENTIALS_ID ?: 'ec2-ssh-credentials'}"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Detect Changes') {
            steps {
                script {
                    def isMain = env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main'
                    if (isMain) {
                        env.CHANGE_FRONTEND = 'true'
                        env.CHANGE_AUTH = 'true'
                        env.CHANGE_REGULATION = 'true'
                        env.CHANGE_SIMULATION = 'true'
                    } else {
                        def diffOutput = sh(script: "git diff --name-only origin/main...HEAD || git diff --name-only HEAD~1", returnStdout: true).trim()
                        env.CHANGE_FRONTEND = diffOutput.contains('apps/frontend') || diffOutput.contains('package.json') || diffOutput.contains('pnpm-lock.yaml') ? 'true' : 'false'
                        env.CHANGE_AUTH = diffOutput.contains('apps/auth-service') ? 'true' : 'false'
                        env.CHANGE_REGULATION = diffOutput.contains('apps/regulation-service') ? 'true' : 'false'
                        env.CHANGE_SIMULATION = diffOutput.contains('apps/simulation-service') ? 'true' : 'false'
                    }
                    echo "Changed Services - Frontend: ${env.CHANGE_FRONTEND}, Auth: ${env.CHANGE_AUTH}, Regulation: ${env.CHANGE_REGULATION}, Simulation: ${env.CHANGE_SIMULATION}"
                }
            }
        }

        stage('CI: Lint & Test') {
            parallel {
                stage('Frontend CI') {
                    when {
                        expression { return env.CHANGE_FRONTEND == 'true' }
                    }
                    steps {
                        sh 'pnpm --filter @hwalro/frontend lint'
                        sh 'pnpm --filter @hwalro/frontend build'
                    }
                }

                stage('Auth Service CI') {
                    when {
                        expression { return env.CHANGE_AUTH == 'true' }
                    }
                    steps {
                        dir('apps/auth-service') {
                            sh './gradlew spotlessCheck test'
                        }
                    }
                }

                stage('Regulation Service CI') {
                    when {
                        expression { return env.CHANGE_REGULATION == 'true' }
                    }
                    steps {
                        dir('apps/regulation-service') {
                            sh './gradlew spotlessCheck test'
                        }
                    }
                }

                stage('Simulation Service CI') {
                    when {
                        expression { return env.CHANGE_SIMULATION == 'true' }
                    }
                    steps {
                        dir('apps/simulation-service') {
                            sh './gradlew spotlessCheck test'
                        }
                    }
                }
            }
        }

        stage('CD: Docker Build & Push') {
            when {
                anyOf {
                    branch 'main'
                    expression { return env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' }
                }
            }
            steps {
                script {
                    def registryDomain = env.REGISTRY_URL.tokenize('/')[0]
                    sh "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${registryDomain} || true"
                }
                parallel(
                    'Build & Push Frontend': {
                        if (env.CHANGE_FRONTEND == 'true') {
                            sh "docker build -f apps/frontend/Dockerfile -t ${REGISTRY_URL}/frontend:${IMAGE_TAG} -t ${REGISTRY_URL}/frontend:latest ."
                            sh "docker push ${REGISTRY_URL}/frontend:${IMAGE_TAG}"
                            sh "docker push ${REGISTRY_URL}/frontend:latest"
                        }
                    },
                    'Build & Push Auth Service': {
                        if (env.CHANGE_AUTH == 'true') {
                            sh "docker build -t ${REGISTRY_URL}/auth-service:${IMAGE_TAG} -t ${REGISTRY_URL}/auth-service:latest apps/auth-service"
                            sh "docker push ${REGISTRY_URL}/auth-service:${IMAGE_TAG}"
                            sh "docker push ${REGISTRY_URL}/auth-service:latest"
                        }
                    },
                    'Build & Push Regulation Service': {
                        if (env.CHANGE_REGULATION == 'true') {
                            sh "docker build -t ${REGISTRY_URL}/regulation-service:${IMAGE_TAG} -t ${REGISTRY_URL}/regulation-service:latest apps/regulation-service"
                            sh "docker push ${REGISTRY_URL}/regulation-service:${IMAGE_TAG}"
                            sh "docker push ${REGISTRY_URL}/regulation-service:latest"
                        }
                    },
                    'Build & Push Simulation Service': {
                        if (env.CHANGE_SIMULATION == 'true') {
                            sh "docker build -t ${REGISTRY_URL}/simulation-service:${IMAGE_TAG} -t ${REGISTRY_URL}/simulation-service:latest apps/simulation-service"
                            sh "docker push ${REGISTRY_URL}/simulation-service:${IMAGE_TAG}"
                            sh "docker push ${REGISTRY_URL}/simulation-service:latest"
                        }
                    }
                )
            }
        }

        stage('CD: Deploy to EC2') {
            when {
                anyOf {
                    branch 'main'
                    expression { return env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' }
                }
            }
            steps {
                script {
                    if (env.EC2_HOST) {
                        sshagent(credentials: [SSH_CREDENTIALS_ID]) {
                            sh """
                                ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} << 'EOF'
                                    cd /opt/hwalro || exit 1
                                    REGISTRY_DOMAIN=\$(echo "${REGISTRY_URL}" | cut -d'/' -f1)
                                    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin \${REGISTRY_DOMAIN} || true
                                    export FRONTEND_TAG=${IMAGE_TAG}
                                    export AUTH_TAG=${IMAGE_TAG}
                                    export SIMULATION_TAG=${IMAGE_TAG}
                                    export REGULATION_TAG=${IMAGE_TAG}
                                    docker compose -f deploy/docker-compose.prod.yml pull
                                    docker compose -f deploy/docker-compose.prod.yml up -d --remove-orphans
                                    docker image prune -af --filter "until=72h"
                                EOF
                            """
                        }
                    } else {
                        echo "EC2_HOST is not defined. Skipping remote deployment."
                    }
                }
            }
        }
    }

    post {
        success {
            echo "CI/CD Pipeline succeeded."
        }
        failure {
            echo "CI/CD Pipeline failed."
        }
    }
}

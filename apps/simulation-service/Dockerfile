FROM eclipse-temurin:17-jdk-jammy AS build

WORKDIR /workspace
COPY . .
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew && ./gradlew bootJar --no-daemon

FROM python:3.12-slim-bookworm

COPY --from=eclipse-temurin:17-jre /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"

WORKDIR /app
COPY engine/requirements.txt engine/requirements.txt
RUN python -m pip install --no-cache-dir --no-deps --requirement engine/requirements.txt
COPY engine engine
COPY --from=build /workspace/build/libs/*.jar app.jar

RUN addgroup --system hwalro && adduser --system --ingroup hwalro hwalro
USER hwalro

EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]

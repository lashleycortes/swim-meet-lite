FROM nginx:1.27-alpine
ARG BUILD_TAG=dev
COPY index.html /usr/share/nginx/html/index.html
RUN sed -i "s/__BUILD_TAG__/${BUILD_TAG}/g" /usr/share/nginx/html/index.html

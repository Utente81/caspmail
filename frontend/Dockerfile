FROM node:18-alpine AS builder
RUN apk upgrade --no-cache
WORKDIR /app
# Fix for permissions issue seen earlier
RUN mkdir -p dist && chown node:node dist
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk upgrade --no-cache
COPY --from=builder /app/dist /usr/share/nginx/html
# Note: we will supply nginx config via ConfigMap in K8s, so we don't copy it here
RUN adduser -D -u 1000 appuser && chown -R 1000:1000 /usr/share/nginx/html
USER 1000
EXPOSE 80

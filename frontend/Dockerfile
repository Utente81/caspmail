FROM node:18-alpine AS builder
WORKDIR /app
# Fix for permissions issue seen earlier
RUN mkdir -p dist && chown node:node dist
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Note: we will supply nginx config via ConfigMap in K8s, so we don't copy it here
EXPOSE 80

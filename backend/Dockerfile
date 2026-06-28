FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# ---- runtime image ----
FROM node:20-alpine

# Non-root user for security
RUN addgroup -S casper && adduser -S casper -G casper

WORKDIR /app

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY src/ ./src/

# Migrations are mounted as a volume at runtime (/app/migrations)
# so no COPY needed here — the compose file handles it.

# Drop privileges
USER casper

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/app.mjs"]

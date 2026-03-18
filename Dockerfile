# ── Build stage ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run server:build
RUN npm run expo:web:build
# Ensure static-build exists even if no Expo build has been run
RUN mkdir -p static-build
# Mark server_dist as ESM to avoid Node.js reparsing overhead
RUN echo '{"type":"module"}' > server_dist/package.json

# ── Build admin SPA ──
WORKDIR /app/admin
RUN npm ci --legacy-peer-deps
RUN npm run build
WORKDIR /app

# ── Production stage ──
FROM node:20-alpine
WORKDIR /app

# Copy only production artifacts
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY --from=builder /app/server_dist ./server_dist
COPY --from=builder /app/server/templates ./server/templates
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/web_dist ./web_dist
COPY --from=builder /app/static-build ./static-build
COPY --from=builder /app/admin_dist ./admin_dist
COPY --from=builder /app/app.json ./app.json
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 5000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "server_dist/index.js"]

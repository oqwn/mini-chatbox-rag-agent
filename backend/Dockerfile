# Build from root directory with: docker build -f backend/Dockerfile .
FROM node:18-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
RUN pnpm install --filter=mini-chatbox-rag-backend --prod --frozen-lockfile

FROM node:18-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
RUN pnpm install --filter=mini-chatbox-rag-backend --frozen-lockfile
COPY backend/ ./backend/
WORKDIR /app/backend
RUN pnpm run build

FROM node:18-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/backend/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/backend/package.json ./
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
RUN mkdir -p uploads logs && chown -R nodejs:nodejs uploads logs
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"
CMD ["node", "dist/index.js"]
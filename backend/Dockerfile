# Production Dockerfile
# For local build: docker build .
# For CI: Use Dockerfile.ci instead OR copy pnpm-lock.yaml first
FROM node:21-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json ./
# Try to copy pnpm-lock.yaml if it exists, otherwise install without lock
COPY pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --prod --no-frozen-lockfile; \
    else \
      pnpm install --prod; \
    fi

FROM node:21-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json ./
COPY pnpm-lock.yaml* ./
# Install all dependencies including devDependencies for build
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --no-frozen-lockfile; \
    else \
      pnpm install; \
    fi
COPY . .
# Debug: List files to ensure tsconfig.json is present
RUN ls -la && pnpm list typescript && which tsc && tsc --version
RUN pnpm run build

FROM node:21-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
RUN mkdir -p uploads logs && chown -R nodejs:nodejs uploads logs
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"
CMD ["node", "dist/index.js"]
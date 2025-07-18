# Stage 1: Dependencies
FROM node:18-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
# Copy package files - these should be prepared by prepare-docker.sh
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Install only production dependencies
RUN pnpm install --production --frozen-lockfile

# Stage 2: Build
FROM node:18-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Install all dependencies
RUN pnpm install --frozen-lockfile
# Copy source code
COPY . .
# Build the application
RUN pnpm run build

# Stage 3: Production
FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Create necessary directories
RUN mkdir -p uploads logs && chown -R nodejs:nodejs uploads logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start the application
CMD ["node", "dist/index.js"]
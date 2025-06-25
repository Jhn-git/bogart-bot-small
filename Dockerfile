# Multi-stage Dockerfile for Bogart Discord Bot
# Stage 1: Dependencies base (for caching)
FROM node:18-alpine AS deps

# Install build dependencies for native modules like sqlite3
RUN apk add --no-cache \
    dumb-init \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy package files and npm config for better layer caching
COPY package*.json .npmrc ./

# Install dependencies in a separate layer for caching
# Use --ignore-scripts for speed, then rebuild sqlite3 manually
ENV NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false NPM_CONFIG_LOGLEVEL=error
RUN npm ci --only=production --ignore-scripts && \
    npm rebuild sqlite3 && \
    npm cache clean --force

# Stage 2: Build stage  
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

WORKDIR /app

# Copy package files and npm config
COPY package*.json .npmrc ./

# Install ALL dependencies (including dev) for building  
ENV NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false NPM_CONFIG_LOGLEVEL=error
RUN npm ci --ignore-scripts

# Copy source code and configuration files
COPY src ./src
COPY tsconfig.json .
COPY tsconfig.build.json .

# Build the TypeScript code using production config
RUN npm run build -- --project tsconfig.build.json

# Stage 3: Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Add metadata
LABEL maintainer="Bogart Bot Team"
LABEL description="Bogart Discord Bot - Server companion with organic conversation timing"
LABEL version="2.0.0"

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bogart -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies from deps stage (cached!)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy necessary runtime files
COPY --chown=bogart:nodejs data/quotes.yaml ./data/

# Create directories for logs and data, ensure proper permissions
RUN mkdir -p /app/logs /app/data && \
    chown -R bogart:nodejs /app

# Switch to non-root user
USER bogart

# Health check - check if the bot process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD pgrep node > /dev/null || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV QUOTES_FILE=/app/data/quotes.yaml

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
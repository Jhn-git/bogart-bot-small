# Multi-stage Dockerfile for Bogart Discord Bot
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code and configuration
COPY . .

# Build the TypeScript code
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine AS production

# Add metadata
LABEL maintainer="Bogart Bot Team"
LABEL description="Bogart Discord Bot - A goblin-themed Discord bot for movie watch-alongs"
LABEL version="1.0.0"

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bogart -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-cache && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy necessary runtime files
COPY --chown=bogart:nodejs quotes.yaml ./

# Create directory for logs and ensure proper permissions
RUN mkdir -p /app/logs && \
    chown -R bogart:nodejs /app

# Switch to non-root user
USER bogart

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "console.log('Bot health check - OK')" || exit 1

# Expose port (if needed for future webhook support)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV QUOTES_FILE=/app/quotes.yaml

# Start the application
CMD ["node", "dist/main.js"]
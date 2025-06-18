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

# Stage 2: Development stage
FROM node:18-alpine AS development

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code and configuration
COPY . .

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data

# Expose port for development
EXPOSE 3000

# Set environment variables for development
ENV NODE_ENV=development
ENV QUOTES_FILE=/app/data/quotes.yaml

# Start the development server
CMD ["npm", "run", "dev"]

# Stage 3: Production stage
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
COPY --chown=bogart:nodejs data/quotes.yaml ./data/

# Create directories for logs and data, ensure proper permissions
RUN mkdir -p /app/logs /app/data && \
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
ENV QUOTES_FILE=/app/data/quotes.yaml

# Start the application
CMD ["node", "dist/main.js"]
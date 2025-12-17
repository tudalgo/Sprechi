# Build stage
FROM node:24.12.0-alpine AS builder

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy configuration files
COPY package.json pnpm-lock.yaml ./

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Prune development dependencies
RUN pnpm prune --prod

# Production stage
FROM node:24.12.0-alpine AS runner

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

WORKDIR /app

# Don't run as root
USER node

# Copy necessary files from builder
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules/ ./node_modules
COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/src/db/migrations ./src/db/migrations

# Basic signal handling via dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "build/src/main.js"]

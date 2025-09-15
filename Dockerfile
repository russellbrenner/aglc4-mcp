# syntax=docker/dockerfile:1
FROM node:20-slim AS base
WORKDIR /app

# Install deps separately for better caching
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Build
RUN npm run build

# Runtime image
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist

# Data directory is mounted at runtime to supply the PDF and index
RUN mkdir -p /app/data /app/data/index

# Default command runs the compiled MCP server over stdio
CMD ["node", "dist/server.js"]


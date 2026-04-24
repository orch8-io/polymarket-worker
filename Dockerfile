# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY node_modules ./node_modules
COPY dist ./dist

# Runtime stage
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV ORCH8_URL=https://cloud.orch8.io/api/tunnel

CMD ["node", "dist/main.js"]

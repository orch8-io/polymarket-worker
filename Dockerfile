FROM node:20-slim AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src/ src/
RUN npm install && npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist dist/
COPY --from=builder /app/node_modules node_modules/
COPY package.json ./
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]

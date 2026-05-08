# uk-bonn-survey-api — production image (Express + TS build)
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY public ./public

RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs nodejs \
  && mkdir -p /app/pdfs && chown nodejs:nodejs /app/pdfs
USER nodejs
EXPOSE 4000
ENV PORT=4000
CMD ["node", "dist/index.js"]

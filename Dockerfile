# Install dependencies only when needed
FROM node:22-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN env
ARG NEXT_PUBLIC_LOGIN_PROVIDER
COPY package.json package-lock.json ./
# Committed lockfile is out of sync with package.json (missing entries
# like string_decoder@1.1.1) and has range-specifier corruption from
# old npm-force-resolutions. Regenerate fresh from package.json.
RUN rm -f package-lock.json && npm install --legacy-peer-deps --ignore-scripts --no-audit --no-fund

# Rebuild the source code only when needed
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
ARG NEXT_PUBLIC_LOGIN_PROVIDER
RUN env
# COPY . . brought back the corrupt committed lockfile; remove again.
RUN rm -f package-lock.json && npm run build && npm install --production --ignore-scripts --prefer-offline --legacy-peer-deps

# Production image, copy all the files and run next
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# You only need to copy next.config.js if you are NOT using the default configuration
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/config /app/config/
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
RUN ls -lrt

USER nextjs

EXPOSE 3000

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry.
ENV NEXT_TELEMETRY_DISABLED 1

CMD ["npm", "run", "start"]

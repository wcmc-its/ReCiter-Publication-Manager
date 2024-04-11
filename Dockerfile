# Install dependencies only when needed
FROM node:14.16.0-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN env
ARG RECITER_DB_HOST
ARG RECITER_DB_NAME
ARG RECITER_DB_USERNAME
ARG RECITER_DB_PASSWORD
ARG NEXT_PUBLIC_RECITER_API_KEY
ARG NEXT_PUBLIC_RECITER_TOKEN_SECRET
ARG NEXT_PUBLIC_RECITER_BACKEND_API_KEY=test
ARG RECITER_DB_PORT
ARG SMTP_HOST_NAME
ARG SMTP_USER
ARG SMTP_PASSWORD
ARG SMTP_ADMIN_EMAIL
ARG ASMS_API_BASE_URL
ARG ASMS_USER_TRACKING_API_AUTHORIZATON
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile

# Rebuild the source code only when needed
FROM node:14.16.0-alpine AS builder
#FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
ARG RECITER_DB_HOST
ARG RECITER_DB_NAME
ARG RECITER_DB_USERNAME
ARG RECITER_DB_PASSWORD
ARG NEXT_PUBLIC_RECITER_API_KEY
ARG NEXT_PUBLIC_RECITER_TOKEN_SECRET
ARG NEXT_PUBLIC_RECITER_BACKEND_API_KEY=test
ARG RECITER_DB_PORT
ARG SMTP_HOST_NAME
ARG SMTP_USER
ARG SMTP_PASSWORD
ARG SMTP_ADMIN_EMAIL
ARG ASMS_API_BASE_URL
ARG ASMS_USER_TRACKING_API_AUTHORIZATON
RUN env
RUN npm run build && npm install --production --ignore-scripts --prefer-offline

# Production image, copy all the files and run next
FROM node:14.16.0-alpine AS runner
#FROM node:18-alpine AS runner
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

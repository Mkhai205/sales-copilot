FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-contracts/package.json ./packages/shared-contracts/
COPY packages/widget-sdk/package.json ./packages/widget-sdk/

RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared-contracts/node_modules ./packages/shared-contracts/node_modules
COPY --from=deps /app/packages/widget-sdk/node_modules ./packages/widget-sdk/node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ARG NEXT_PUBLIC_WS_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN pnpm nx build web

FROM node:22-alpine AS production
WORKDIR /app

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
# Use a glob to gracefully handle the case where public doesn't exist
COPY --from=build /app/apps/web/public* ./apps/web/public/

WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]

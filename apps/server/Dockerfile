FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared-contracts/package.json ./packages/shared-contracts/
COPY packages/widget-sdk/package.json ./packages/widget-sdk/

RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/shared-contracts/node_modules ./packages/shared-contracts/node_modules
COPY --from=deps /app/packages/widget-sdk/node_modules ./packages/widget-sdk/node_modules
COPY . .

RUN pnpm nx build server
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma

FROM node:22-alpine AS production
WORKDIR /app

COPY --from=build /app/dist/apps/server ./dist/apps/server
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/shared-contracts/node_modules ./packages/shared-contracts/node_modules
COPY --from=deps /app/packages/widget-sdk/node_modules ./packages/widget-sdk/node_modules
COPY --from=build /app/apps/server/prisma ./apps/server/prisma

ENV NODE_ENV=production
EXPOSE 8000

CMD ["node", "dist/apps/server/apps/server/src/main.js"]

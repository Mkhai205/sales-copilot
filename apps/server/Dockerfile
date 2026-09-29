FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm

# pnpm install --frozen-lockfile requires every lockfile importer directory to
# exist with its package.json, so all five workspace projects are copied here.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-contracts/package.json ./packages/shared-contracts/
COPY packages/email-templates/package.json ./packages/email-templates/
COPY packages/widget-sdk/package.json ./packages/widget-sdk/

RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/shared-contracts/node_modules ./packages/shared-contracts/node_modules
COPY --from=deps /app/packages/email-templates/node_modules ./packages/email-templates/node_modules
COPY --from=deps /app/packages/widget-sdk/node_modules ./packages/widget-sdk/node_modules
COPY . .

# nx builds the workspace libs (shared-contracts, email-templates) first via ^build
RUN pnpm nx build server
# Run inside apps/server so npx resolves the workspace's own prisma CLI
RUN cd apps/server && npx prisma generate --schema=prisma/schema.prisma

FROM node:22-alpine AS production
WORKDIR /app

COPY --from=build /app/dist/apps/server ./dist/apps/server
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
# Workspace libs resolve through their package.json "main" -> ./dist/index.js,
# so both the manifest and the compiled dist must be present.
COPY --from=deps /app/packages/shared-contracts/node_modules ./packages/shared-contracts/node_modules
COPY --from=build /app/packages/shared-contracts/package.json ./packages/shared-contracts/package.json
COPY --from=build /app/packages/shared-contracts/dist ./packages/shared-contracts/dist
COPY --from=deps /app/packages/email-templates/node_modules ./packages/email-templates/node_modules
COPY --from=build /app/packages/email-templates/package.json ./packages/email-templates/package.json
COPY --from=build /app/packages/email-templates/dist ./packages/email-templates/dist
COPY --from=build /app/apps/server/prisma ./apps/server/prisma

# The compiled entry lives under dist/ (rootDir is the repo root), while pnpm
# keeps every server dependency in apps/server/node_modules. Link it next to
# the dist tree so Node's upward resolution finds @nestjs/* and the workspace
# libs from the compiled entry.
RUN ln -s /app/apps/server/node_modules /app/dist/apps/server/node_modules

ENV NODE_ENV=production
EXPOSE 8000

CMD ["node", "dist/apps/server/apps/server/src/main.js"]

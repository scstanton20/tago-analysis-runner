FROM node:23-alpine AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy package.json files for the monorepo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN pnpm install --filter backend --frozen-lockfile --prod

FROM node:23-alpine AS run

# Set up pnpm in the runtime container
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy the package files needed for pnpm to run correctly
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/backend/package.json ./apps/backend/

# Copy dependencies from the deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy source code
COPY --chown=node:node apps/backend/src ./apps/backend/src

#Specify node path for package resolution by Node Children processes
ENV NODE_PATH=/app/apps/backend/node_modules:/apps/backend/src

USER root
RUN mkdir -p /app/analyses-storage/analyses \
   /app/analyses-storage/config \
   && chown -R node:node /app/analyses-storage

ENV NODE_ENV=production

VOLUME [ "/app/analyses-storage" ]

USER node
EXPOSE 3000
# Start in production mode
CMD ["node", "/app/apps/backend/src/server.js"]

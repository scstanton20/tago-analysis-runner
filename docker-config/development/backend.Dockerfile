FROM node:23-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy package.json files for the monorepo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN pnpm install --filter backend --frozen-lockfile

# Set working directory to backend app
WORKDIR /app/apps/backend

# Set development environment
ENV NODE_ENV=development
EXPOSE 3000
# Start in development mode
CMD ["pnpm", "dev"]
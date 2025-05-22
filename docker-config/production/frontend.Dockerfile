FROM node:23-alpine AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy package.json files for the monorepo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies
RUN pnpm install --filter frontend --frozen-lockfile

FROM node:23-alpine AS build
# Set up pnpm in the runtime container
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set working directory to frontend app
WORKDIR /app

# Copy the package files needed for pnpm to run correctly
COPY --chown=nginx:nginx package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=nginx:nginx apps/frontend/package.json ./apps/frontend/

# Copy dependencies from the deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules

# Copy source code
COPY --chown=nginx:nginx apps/frontend ./apps/frontend

# Set production environment
ENV NODE_ENV=production

# Build for production
WORKDIR /app/apps/frontend
RUN pnpm build

# Production stage - Frontend
FROM nginx:alpine AS frontend

WORKDIR /app
# Copy built frontend files to nginx
COPY --from=build --chown=nginx:nginx  /app/apps/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY --from=build --chown=nginx:nginx /app/apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose frontend port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
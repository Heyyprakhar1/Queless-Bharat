# ==============================================================================
# Stage 1: Build static assets
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install exact dependencies
RUN npm ci

# Copy frontend source code
COPY . .

# Optional build-time API base URL (empty defaults to same-origin relative proxying)
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Optional build-time Google OAuth Client ID (public, safe for client bundle)
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Build production bundle with TypeScript check
RUN npm run build

# ==============================================================================
# Stage 2: Minimal, secure unprivileged Nginx runtime
# ==============================================================================
FROM nginx:1.27-alpine AS runner

# Patch base OS packages and remove default boilerplate
RUN apk --no-cache upgrade && rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Grant ownership to non-root nginx user for unprivileged execution
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]

# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --silent

# Copy source and build
COPY . .
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM nginx:stable-alpine AS production

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

/**
 * Example Docker Compose files for "Try It" demos
 * Inline YAML examples for bundle optimization and Vercel build compatibility
 */

// Slide 1: Anchor Resolution Demo
const anchorDemo = `version: '3.8'

x-common: &default-logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"

services:
  web:
    image: nginx:1.25-alpine
    ports:
      - "8080:80"
    <<: *default-logging
`;

// Slide 2: Extends Demo (simplified for demo purposes)
const extendsDemo = `services:
  base:
    image: alpine:3.19
    environment:
      - NODE_ENV=production
    
  web:
    extends: base
    image: nginx:alpine
    ports:
      - "80:80"
      
  api:
    extends: base
    image: node:20-alpine
    ports:
      - "3000:3000"
`;

// Slide 3: Profiles Demo
const profilesDemo = `name: manual-profile-filtering

services:
  core:
    image: nginx:1.25-alpine
    ports:
      - "8080:80"
    networks:
      - app_net

  dev-tools:
    image: alpine:3.19
    command: ["sh", "-c", "echo dev tools ready && sleep 3600"]
    profiles:
      - dev
    networks:
      - app_net

  prod-cache:
    image: redis:7-alpine
    profiles:
      - prod
    networks:
      - app_net

  observability:
    image: prom/prometheus:latest
    profiles:
      - dev
      - prod
    ports:
      - "9090:9090"
    networks:
      - app_net

networks:
  app_net:
    driver: bridge
`;

// Slide 4: Performance Demo (simplified - 10 services for demo)
const performanceDemo = `name: performance-demo

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
  
  api-1:
    image: node:20-alpine
    ports:
      - "3001:3000"
  
  api-2:
    image: node:20-alpine
    ports:
      - "3002:3000"
      
  db-master:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
      
  db-replica:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
      
  redis:
    image: redis:7-alpine
    
  worker-1:
    image: node:20-alpine
    
  worker-2:
    image: node:20-alpine
    
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
      
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
`;

/**
 * Map of example IDs to their YAML content
 */
export const examples = {
    'anchor-demo': anchorDemo,
    'multi-file-project': extendsDemo,
    'profiles-demo': profilesDemo,
    '50-services': performanceDemo
};

/**
 * Get example YAML by ID
 */
export function getExample(id) {
    return examples[id] || null;
}

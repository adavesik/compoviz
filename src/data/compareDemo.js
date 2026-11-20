/**
 * Demo stacks for Compare mode.
 *
 * Three small projects that look reasonable on their own but collide when run
 * on one Docker host. Together they exercise most comparison categories:
 * - project name: "metrics" was copy-pasted with `name: shop`
 * - host ports: *:8080 (wildcard vs 127.0.0.1) and 0.0.0.0:6379
 * - container names: "api" and "redis"
 * - bind mount: ./data written by blog and metrics
 * - shared env file and a project-scoped "backend" network
 *
 * `name` is the display name in Compare; the compose `name:` inside the YAML
 * is what Docker uses at runtime.
 */

const shopYaml = `name: shop

services:
  api:
    image: node:20-alpine
    container_name: api
    ports:
      - "8080:3000"
    env_file:
      - .env
    networks:
      - backend
    depends_on:
      - db
      - cache

  db:
    image: postgres:16
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - backend

  cache:
    image: redis:7
    container_name: redis
    ports:
      - "6379:6379"
    networks:
      - backend

networks:
  backend: {}

volumes:
  pgdata: {}
`;

const blogYaml = `name: blog

services:
  web:
    image: nginx:1.27
    ports:
      - "80:80"
      - "127.0.0.1:8080:8080"
    volumes:
      - ./data:/usr/share/nginx/html
    networks:
      - backend
    depends_on:
      - wordpress

  wordpress:
    image: wordpress:6
    container_name: api
    env_file:
      - .env
    networks:
      - backend
    depends_on:
      - mysql

  mysql:
    image: mysql:8
    ports:
      - "3306:3306"
    volumes:
      - dbdata:/var/lib/mysql
    networks:
      - backend

networks:
  backend: {}

volumes:
  dbdata: {}
`;

const metricsYaml = `# Copied from the shop stack and never renamed
name: shop

services:
  grafana:
    image: grafana/grafana:11
    ports:
      - "3000:3000"
    volumes:
      - ./data:/var/lib/grafana

  prometheus:
    image: prom/prometheus:v3
    ports:
      - "9090:9090"

  exporter:
    image: redis:7
    container_name: redis
    ports:
      - "6379:6379"
`;

/** @type {Array<{ name: string, fileName: string, yaml: string }>} */
export const compareDemoProjects = [
    { name: 'shop', fileName: 'shop.yml', yaml: shopYaml },
    { name: 'blog', fileName: 'blog.yml', yaml: blogYaml },
    { name: 'metrics', fileName: 'metrics.yml', yaml: metricsYaml },
];

/**
 * Curated Docker Compose examples for the Examples Gallery.
 * Sourced from docker/awesome-compose (MIT licensed).
 * 
 * @see https://github.com/docker/awesome-compose
 * 
 * @typedef {Object} ExampleEntry
 * @property {string} id - Unique identifier (kebab-case)
 * @property {string} name - Display name
 * @property {string} description - Short description (1-2 sentences)
 * @property {string} category - Primary category: 'web' | 'backend' | 'fullstack' | 'monitoring' | 'database'
 * @property {string[]} tags - Technology tags for display (e.g., ['nginx', 'node', 'postgres'])
 * @property {number} serviceCount - Number of services in the example
 * @property {string} source - Attribution URL from awesome-compose
 * @property {string} yaml - Raw docker-compose.yml content as string
 * @property {Object<string, string>} [includes] - Optional map of included file paths to their YAML content
 */

/** @type {ExampleEntry[]} */
export const galleryExamples = [
  {
    id: 'react-express-mongodb',
    name: 'React + Express + MongoDB',
    description: 'Full-stack JavaScript app with React frontend, Express API, and MongoDB database.',
    category: 'fullstack',
    tags: ['react', 'node', 'mongodb'],
    serviceCount: 3,
    source: 'https://github.com/docker/awesome-compose/tree/master/react-express-mongodb',
    yaml: `services:
  frontend:
    build:
      context: frontend
      target: development
    ports:
      - 3000:3000
    stdin_open: true
    volumes:
      - ./frontend:/usr/src/app
      - /usr/src/app/node_modules
    restart: always
    networks:
      - react-express
    depends_on:
      - backend

  backend:
    restart: always
    build:
      context: backend
      target: development
    volumes:
      - ./backend:/usr/src/app
      - /usr/src/app/node_modules
    depends_on:
      - mongo
    networks:
      - express-mongo
      - react-express
    expose:
      - 3000

  mongo:
    restart: always
    image: mongo:4.2.0
    volumes:
      - mongo_data:/data/db
    networks:
      - express-mongo
    expose:
      - 27017

networks:
  react-express:
  express-mongo:

volumes:
  mongo_data:`
  },
  {
    id: 'nginx-golang-postgres',
    name: 'Nginx + Go + PostgreSQL',
    description: 'Three-tier web app with Nginx reverse proxy, Go backend, and PostgreSQL database with health checks.',
    category: 'fullstack',
    tags: ['nginx', 'golang', 'postgresql'],
    serviceCount: 3,
    source: 'https://github.com/docker/awesome-compose/tree/master/nginx-golang-postgres',
    yaml: `services:
  backend:
    build:
      context: backend
      target: builder
    secrets:
      - db-password
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres
    restart: always
    user: postgres
    secrets:
      - db-password
    volumes:
      - db-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=example
      - POSTGRES_PASSWORD_FILE=/run/secrets/db-password
    expose:
      - 5432
    healthcheck:
      test: ["CMD", "pg_isready"]
      interval: 10s
      timeout: 5s
      retries: 5

  proxy:
    image: nginx
    volumes:
      - type: bind
        source: ./proxy/nginx.conf
        target: /etc/nginx/conf.d/default.conf
        read_only: true
    ports:
      - 80:80
    depends_on:
      - backend

volumes:
  db-data:

secrets:
  db-password:
    file: db/password.txt`
  },
  {
    id: 'nginx-flask-mysql',
    name: 'Nginx + Flask + MySQL',
    description: 'Python Flask backend with Nginx reverse proxy and MySQL database, using secrets and health checks.',
    category: 'fullstack',
    tags: ['nginx', 'python', 'mysql'],
    serviceCount: 3,
    source: 'https://github.com/docker/awesome-compose/tree/master/nginx-flask-mysql',
    yaml: `services:
  db:
    image: mariadb:10-focal
    command: '--default-authentication-plugin=mysql_native_password'
    restart: always
    healthcheck:
      test: ['CMD-SHELL', 'mysqladmin ping -h 127.0.0.1 --password="$$(cat /run/secrets/db-password)" --silent']
      interval: 3s
      retries: 5
      start_period: 30s
    secrets:
      - db-password
    volumes:
      - db-data:/var/lib/mysql
    networks:
      - backnet
    environment:
      - MYSQL_DATABASE=example
      - MYSQL_ROOT_PASSWORD_FILE=/run/secrets/db-password
    expose:
      - 3306
      - 33060

  backend:
    build:
      context: backend
      target: builder
    restart: always
    secrets:
      - db-password
    ports:
      - 8000:8000
    networks:
      - backnet
      - frontnet
    depends_on:
      db:
        condition: service_healthy

  proxy:
    build: proxy
    restart: always
    ports:
      - 80:80
    depends_on:
      - backend
    networks:
      - frontnet

volumes:
  db-data:

secrets:
  db-password:
    file: db/password.txt

networks:
  backnet:
  frontnet:`
  },
  {
    id: 'react-rust-postgres',
    name: 'React + Rust + PostgreSQL',
    description: 'Modern full-stack with React frontend, Rust backend, and PostgreSQL with isolated networks.',
    category: 'fullstack',
    tags: ['react', 'rust', 'postgresql'],
    serviceCount: 3,
    source: 'https://github.com/docker/awesome-compose/tree/master/react-rust-postgres',
    yaml: `name: react-rust-postgres

services:
  frontend:
    build:
      context: frontend
      target: development
    networks:
      - client-side
    ports:
      - 3000:3000
    volumes:
      - ./frontend/src:/code/src:ro

  backend:
    build:
      context: backend
      target: development
    environment:
      - ADDRESS=0.0.0.0:8000
      - RUST_LOG=debug
      - PG_DBNAME=postgres
      - PG_HOST=db
      - PG_USER=postgres
      - PG_PASSWORD=mysecretpassword
    networks:
      - client-side
      - server-side
    volumes:
      - ./backend/src:/code/src
      - backend-cache:/code/target
    depends_on:
      - db

  db:
    image: postgres:12-alpine
    restart: always
    environment:
      - POSTGRES_PASSWORD=mysecretpassword
    networks:
      - server-side
    ports:
      - 5432:5432
    volumes:
      - db-data:/var/lib/postgresql/data

networks:
  client-side: {}
  server-side: {}

volumes:
  backend-cache: {}
  db-data: {}`
  },
  {
    id: 'wordpress-mysql',
    name: 'WordPress + MySQL',
    description: 'Classic WordPress CMS with MariaDB database backend. Simple two-service setup.',
    category: 'web',
    tags: ['php', 'mysql'],
    serviceCount: 2,
    source: 'https://github.com/docker/awesome-compose/tree/master/wordpress-mysql',
    yaml: `services:
  db:
    image: mariadb:10.6.4-focal
    command: '--default-authentication-plugin=mysql_native_password'
    volumes:
      - db_data:/var/lib/mysql
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=somewordpress
      - MYSQL_DATABASE=wordpress
      - MYSQL_USER=wordpress
      - MYSQL_PASSWORD=wordpress
    expose:
      - 3306
      - 33060

  wordpress:
    image: wordpress:latest
    ports:
      - 80:80
    restart: always
    environment:
      - WORDPRESS_DB_HOST=db
      - WORDPRESS_DB_USER=wordpress
      - WORDPRESS_DB_PASSWORD=wordpress
      - WORDPRESS_DB_NAME=wordpress

volumes:
  db_data:`
  },
  {
    id: 'prometheus-grafana',
    name: 'Prometheus + Grafana',
    description: 'Monitoring stack with Prometheus metrics collection and Grafana dashboards.',
    category: 'monitoring',
    tags: ['prometheus', 'grafana'],
    serviceCount: 2,
    source: 'https://github.com/docker/awesome-compose/tree/master/prometheus-grafana',
    yaml: `services:
  prometheus:
    image: prom/prometheus
    container_name: prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    ports:
      - 9090:9090
    restart: unless-stopped
    volumes:
      - ./prometheus:/etc/prometheus
      - prom_data:/prometheus

  grafana:
    image: grafana/grafana
    container_name: grafana
    ports:
      - 3000:3000
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=grafana
    volumes:
      - ./grafana:/etc/grafana/provisioning/datasources

volumes:
  prom_data:`
  },
  {
    id: 'elasticsearch-logstash-kibana',
    name: 'ELK Stack',
    description: 'Elasticsearch, Logstash, and Kibana for centralized logging and search analytics.',
    category: 'monitoring',
    tags: ['elasticsearch', 'logstash', 'kibana'],
    serviceCount: 3,
    source: 'https://github.com/docker/awesome-compose/tree/master/elasticsearch-logstash-kibana',
    yaml: `services:
  elasticsearch:
    image: elasticsearch:7.16.1
    container_name: es
    environment:
      discovery.type: single-node
      ES_JAVA_OPTS: "-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
      - "9300:9300"
    healthcheck:
      test: ["CMD-SHELL", "curl --silent --fail localhost:9200/_cluster/health || exit 1"]
      interval: 10s
      timeout: 10s
      retries: 3
    networks:
      - elastic

  logstash:
    image: logstash:7.16.1
    container_name: log
    environment:
      discovery.seed_hosts: logstash
      LS_JAVA_OPTS: "-Xms512m -Xmx512m"
    volumes:
      - ./logstash/pipeline/logstash-nginx.config:/usr/share/logstash/pipeline/logstash-nginx.config
      - ./logstash/nginx.log:/home/nginx.log
    ports:
      - "5000:5000/tcp"
      - "5000:5000/udp"
      - "5044:5044"
      - "9600:9600"
    depends_on:
      - elasticsearch
    networks:
      - elastic
    command: logstash -f /usr/share/logstash/pipeline/logstash-nginx.config

  kibana:
    image: kibana:7.16.1
    container_name: kib
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
    networks:
      - elastic

networks:
  elastic:
    driver: bridge`
  },
  {
    id: 'nextcloud-redis-mariadb',
    name: 'Nextcloud + Redis + MariaDB',
    description: 'Self-hosted cloud storage with Redis caching and MariaDB, using isolated networks.',
    category: 'web',
    tags: ['nextcloud', 'redis', 'mysql'],
    serviceCount: 3,
    source: 'https://github.com/docker/awesome-compose/tree/master/nextcloud-redis-mariadb',
    yaml: `services:
  nc:
    image: nextcloud:apache
    restart: always
    ports:
      - 80:80
    volumes:
      - nc_data:/var/www/html
    networks:
      - redisnet
      - dbnet
    environment:
      - REDIS_HOST=redis
      - MYSQL_HOST=db
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - MYSQL_PASSWORD=nextcloud

  redis:
    image: redis:alpine
    restart: always
    networks:
      - redisnet
    expose:
      - 6379

  db:
    image: mariadb:10.5
    command: --transaction-isolation=READ-COMMITTED --binlog-format=ROW
    restart: always
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - dbnet
    environment:
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - MYSQL_ROOT_PASSWORD=nextcloud
      - MYSQL_PASSWORD=nextcloud
    expose:
      - 3306

volumes:
  db_data:
  nc_data:

networks:
  dbnet:
  redisnet:`
  }
];

/**
 * Valid categories for filtering
 */
export const CATEGORIES = ['all', 'web', 'backend', 'fullstack', 'monitoring', 'database'];

/**
 * Filter examples by category.
 * 
 * @param {ExampleEntry[]} examples - Array of examples to filter
 * @param {string} category - Category to filter by ('all' returns everything)
 * @returns {ExampleEntry[]} Filtered array (original not mutated, order preserved)
 */
export function filterExamples(examples, category) {
  if (category === 'all') return examples;
  return examples.filter(ex => ex.category === category);
}

/**
 * Get all gallery examples sorted by category then name.
 * 
 * @returns {ExampleEntry[]} Sorted array of all examples
 */
export function getExamplesGallery() {
  return [...galleryExamples].sort((a, b) => {
    const catCompare = a.category.localeCompare(b.category);
    if (catCompare !== 0) return catCompare;
    return a.name.localeCompare(b.name);
  });
}

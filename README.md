<p align="center">
  <a href="https://compoviz.pro">
    <img src="public/banner.png" alt="Compoviz Banner" />
  </a>
</p>
</p>

<h1 align="center">🐳 Docker Compose Architect (Compoviz)</h1>

<h3 align="center">
  <a href="https://compoviz.pro">Live Demo</a> |
  <a href="#-docker-deployment">Self-Host</a> |
  <a href="#-local-development">Local Development</a> |
  <a href="#-contributing">Contributing</a>
</h3>

<p align="center">
  <strong>An open source visual Docker Compose architect.</strong><br/>
  Transform YAML into interactive architecture diagrams.
</p>

<p align="center">
  <a href="https://github.com/adavesik/compoviz/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" />
  </a>
  <a href="https://github.com/adavesik/compoviz/stargazers">
    <img src="https://img.shields.io/github/stars/adavesik/compoviz?style=flat&color=yellow" alt="GitHub Stars" />
  </a>
  <a href="https://github.com/adavesik/compoviz/issues">
    <img src="https://img.shields.io/github/issues/adavesik/compoviz" alt="GitHub Issues" />
  </a>
</p>

<br />

<p align="center">
  <img src="public/demo.png" alt="Compoviz Interface" width="100%" style="border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.5);" />
</p>

<br />

---

## ✨ Key Features

### 🎨 Visual Architecture Mapping

- **Pro-Grade Diagrams**: Automatically generates professional-grade architecture diagrams using an enhanced Mermaid.js engine.
- **Logical Grouping**: Services are visually grouped by their **Docker Networks**.
- **Edge Intelligence**: `depends_on` conditions (`healthy`, `started`) are visualized as labeled paths.
- **Infrastructure Insights**: Visualizes host path mounts, named volumes, secrets, and configs at a glance.

### 🔍 Multi-Project Comparison

- **Collision Detection**: Load up to 3 different `docker-compose.yml` files simultaneously.
- **Conflict Analysis**: Real-time detection of port collisions, duplicate container names, and shared host volumes.
- **Cross-Project Visualization**: See how distinct projects interact via shared networks or shared infrastructure.

### 🛠️ Robust Service Editor

- **Spec-Compliant**: Built for the modern [Compose Specification](https://compose-spec.io/) (no more obsolete `version: '3.8'`).
- **Smart Templates**: Instantly spin up standardized configurations for Redis, PostgreSQL, Nginx, MongoDB, and more.
- **Field Validation**: Real-time warnings for missing images, undefined network references, and duplicate resource names.
- **Rich Controls**: Full support for environment variables, `.env` files, healthchecks, entrypoints, and user permissions.

### ⌨️ Developer Experience

- **Undo/Redo**: Full history management with `Ctrl+Z` / `Ctrl+Y` shortcuts.
- **Modern Dark UI**: A sleek dark mode interface designed for maximum focus.
- **Instant Export**: Export clean, optimized YAML ready for production.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)

### Local Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/adavesik/compoviz.git
   cd compoviz
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   # Optional: To disable Vercel Analytics just copy the .env.example file with:
   cp .env.example .env
   ```

   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

---

## 🐳 Docker Deployment

The easiest way to run Compoviz is with Docker. No Node.js required!

| [Pre-built Images (Recommended)](#using-pre-built-image-recommended) | [Build & Deploy from Source](#build--deploy-from-source)  |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| [Docker Run (Pre-built)](#docker-run-pre-built)                      | [Docker Compose from Source](#docker-compose-from-source) |
| [Docker Compose (Pre-built)](#docker-compose-pre-built)              | [Docker CLI from source](#docker-cli-from-source)         |

### Using Pre-built Image (Recommended)

#### Docker Run (Pre-built)

```bash
docker run -d -p 8080:80 ghcr.io/adavesik/compoviz:latest
# Access the app at http://localhost:8080 or your port configuration
```

#### Docker Compose: (Pre-built)

```bash
# Make and change directory
mkdir compoviz && cd compoviz

# Download docker-compose.yml for prebuilt image from ./compose/docker-compose.yml
wget https://raw.githubusercontent.com/adavesik/compoviz/refs/heads/main/compose/docker-compose.yml

# Make any adjustments to docker-compose.yml as needed
# Deploy with docker compose
docker compose up -d

# Access the app at http://localhost:8080 or your port configuration
```

### Build Docker Image & Deploy from Source

#### First clone and cd into repository

```bash
git clone https://github.com/adavesik/compoviz.git && cd compoviz
```

#### Docker Compose from Source

> **Tip:** If you have node/npm installed, you can use the npm scripts instead of running the raw Docker compose commands below.  
> (See relevant npm docker commands in the [Local Development](#-local-development) section.)

```bash
# Build and run
docker compose up -d

# Stop and remove container
docker compose down

# Remove the image
docker image rm compoviz-dev:latest

# Clean builder cache
# Caution: Removes from global build cache
# Look into setting up a separate docker builder/buildx if you have other build cache you care about
docker builder prune
```

#### Docker CLI from source

```bash
# Build the image
docker build -t compoviz-dev .

# Run the container
docker run -d -p 8080:80 --name compoviz-dev compoviz-dev

# Stop and Remove container
docker rm -f compoviz-dev

# Remove the image
docker image rm compoviz-dev:latest

# Clean builder cache
# Refer to compose section above
```

---

## 🛠️ Tech Stack

- **Frontend**: React + Vite
- **Styling**: Tailwind CSS (Custom Dark Theme)
- **Diagrams**: Mermaid.js (Enhanced)
- **Logic**: Custom hooks for history (`useHistory`) and state (`useCompose`, `useMultiProject`)
- **YAML Parsing**: js-yaml

---

## 🧪 Local Development

### Scripts for Development & Testing

Below is a guide for local development, from cloning the repository to running and cleaning up Docker development environments. Each step is mapped to the corresponding command or npm script.

| Use Case                                | Command to Run                                                      | What It Does / Underlying Command                             |
| --------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| Clone & cd into repository              | `git clone https://github.com/adavesik/compoviz.git && cd compoviz` | Clones the Compoviz repository and changes into the directory |
| Install dependencies                    | `npm install`                                                       | Installs all npm dependencies                                 |
| Start Vite dev server (hot reload)      | `npm run dev`                                                       | `vite`                                                        |
| Build production bundle                 | `npm run build`                                                     | `vite build`                                                  |
| Lint codebase                           | `npm run lint`                                                      | `eslint .`                                                    |
| Run all tests (CI mode)                 | `npm run test`                                                      | `vitest run`                                                  |
| Run tests in watch mode                 | `npm run test:watch`                                                | `vitest`                                                      |
| Run interactive test UI                 | `npm run test:ui`                                                   | `vitest --ui`                                                 |
| Preview production build                | `npm run preview`                                                   | `vite preview`                                                |
| Build & Start container (with logging)  | `npm run docker:dev`                                                | `docker compose up`                                           |
| Build & Start container (detached)      | `npm run docker:dev -- -d`                                          | `docker compose up -d`                                        |
| Restart running container               | `npm run docker:restart`                                            | `docker compose restart`                                      |
| Rebuild image and start container       | `npm run docker:rebuild`                                            | `npm run docker:dev -- --build`                               |
| Stop and remove containers              | `npm run docker:down`                                               | `docker compose down`                                         |
| Remove locally built image              | `npm run docker:image-rm`                                           | `docker image rm compoviz-dev:latest`                         |
| All-in-one stop & remove image          | `npm run docker:clean`                                              | `docker compose down --rmi local --volumes`                   |
| Run docker compose with pre-built image | `docker compose -f compose/docker-compose.yml up -d`                | Runs docker compose using the pre-built image                 |

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for the Docker Community
</p>

<p align="center">
  <a href="https://compoviz.pro">
    <img src="public/banner.png" alt="Compoviz Banner" />
  </a>
</p>

<h1 align="center">🐳 Docker Compose Architect (Compoviz)</h1>

<h3 align="center">
  <a href="https://compoviz.pro">Live Demo</a> •
  <a href="#-docker-deployment">Self-Host</a> •
  <a href="#-local-development">Local Development</a> •
  <a href="#-contributing">Contributing</a>
</h3>

<p align="center">
  <strong>The most advanced open-source visual Docker Compose architect.</strong><br/>
  Production-grade parser. Spec-compliant. Multi-file support. Real-time visualization.
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
  <img src="https://img.shields.io/badge/tests-200%2B%20passing-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/Docker%20Compose-Spec%20V3%2B-2496ED?logo=docker" alt="Compose Spec" />
</p>

<br />

<p align="center">
  <img src="public/demo.png" alt="Compoviz Interface" width="100%" style="border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.5);" />
</p>

<br />

---

## 🎯 Why Compoviz?

Compoviz is the **only** Docker Compose tool that combines a **production-grade, spec-compliant parser** with **real-time visual architecture mapping**. Built for DevOps engineers who need to understand, debug, and architect complex multi-service applications.

### ⚡ Performance That Scales
- **50 services parsed in ~25ms** with Web Worker architecture
- **Non-blocking UI** - parse large compose files without freezing
- **200+ test cases** ensuring reliability with real-world fixtures

---

## ✨ Core Features

### 🏗️ **Production-Grade Parser** (NEW)

Built from the ground up to support the full [Docker Compose Specification v3+](https://compose-spec.io/):

- ✅ **Multi-file Includes** - `include` directive with circular dependency detection
- ✅ **Service Inheritance** - `extends` with spec-compliant merge strategies  
- ✅ **Advanced Variable Interpolation** - Full support for `${VAR:-default}`, `${VAR:?required}`, `${VAR?error}` syntax
- ✅ **Profile Support** - Filter services by profiles with visual profile selector
- ✅ **Environment Files** - `.env` file parsing and merging
- ✅ **Directory Upload** - Upload entire project folders with multiple compose files
- ✅ **Web Worker Architecture** - Asynchronous parsing that never blocks the UI

> **Technical Highlight**: Modular architecture with dedicated resolvers (Path, Extends, Variable, Include, Profile) orchestrated through a multi-stage pipeline. All parsing errors are gracefully handled with detailed diagnostic information.

### 🎨 **Visual Architecture Mapping**

Transform YAML into professional architecture diagrams instantly:

- **Network-Based Grouping** - Services automatically organized by Docker networks
- **Smart Dependency Visualization** - `depends_on` conditions (`healthy`, `started`, `completed`) shown as labeled edges
- **Infrastructure Mapping** - Host path mounts, named volumes, secrets, and configs visualized at a glance
- **Port Exposure** - Published ports clearly displayed with protocol indicators
- **Enhanced Mermaid.js** - Production-ready diagrams with customizable styling

### 🔍 **Multi-Project Comparison**

Analyze multiple compose files side-by-side:

- **Load up to 3 projects** simultaneously for comparison
- **Port Conflict Detection** - Real-time collision analysis with IP binding awareness
- **Resource Collision Analysis** - Detect duplicate container names and shared host volumes
- **Cross-Stack Visualization** - See how projects interact via shared networks or infrastructure
- **Differential Highlighting** - Unique and overlapping resources clearly marked

### 🛠️ **Advanced Service Editor**

Visual builder with full spec compliance:

- **Smart Templates** - Pre-configured setups for Redis, PostgreSQL, Nginx, MongoDB, MySQL, and more
- **Real-time Validation** - Warnings for missing images, undefined networks, and resource conflicts
- **Rich Field Support** - Environment variables, healthchecks, entrypoints, labels, user permissions, security options
- **Drag-and-Drop Design** - React Flow-based visual editor
- **Full Undo/Redo** - History management with `Ctrl+Z` / `Ctrl+Y` shortcuts

### ⚙️ **Developer Experience**

- **Modern Dark UI** - Sleek interface optimized for long coding sessions
- **Instant YAML Export** - Clean, formatted, production-ready output
- **Keyboard Shortcuts** - Efficiency-focused workflow
- **Graceful Error Handling** - Detailed error messages with context and suggestions
- **Zero Setup Required** - Works entirely in the browser, no backend needed

---

## 🆕 What's New

**Latest Release**: Spec-Compliant Parser & Multi-File Support

This major update introduces a production-grade Docker Compose parser that rivals CLI tools:

- 🔄 **Include Resolution** - Multi-file composition with circular dependency detection
- 🧬 **Extends Support** - Service inheritance with spec-compliant merging
- 🔧 **Advanced Variable Interpolation** - `${VAR:-default}`, `${VAR:?required}` syntax
- 🎯 **Profile Filtering** - Visual profile selector with service count indicators
- ⚡ **Web Worker Parsing** - Async architecture prevents UI blocking
- 📁 **Directory Upload** - Upload entire compose projects with `.env` files
- 🧪 **200+ Tests** - Comprehensive test suite with real-world fixtures

**Performance**: 50 services parsed in ~25ms | 100% passing tests | Zero linting errors

---

## 🚀 Getting Started

### 🌐 Quickest Start: Live Demo

Try Compoviz instantly in your browser (no installation required):

👉 **[compoviz.pro](https://compoviz.pro)**

### 🐳 Docker Deployment

The easiest way to self-host Compoviz. No Node.js required!

#### Using Pre-built Image (Recommended)

**Docker Run:**
```bash
docker run -d -p 8080:80 ghcr.io/adavesik/compoviz:latest
# Access at http://localhost:8080
```

**Docker Compose:**
```bash
# Create project directory
mkdir compoviz && cd compoviz

# Download compose file
wget https://raw.githubusercontent.com/adavesik/compoviz/refs/heads/main/compose/docker-compose.yml

# Deploy
docker compose up -d

# Access at http://localhost:8080
```

#### Build from Source

**Prerequisites:**
```bash
git clone https://github.com/adavesik/compoviz.git && cd compoviz
```

**Docker Compose:**
```bash
docker compose up -d
```

**Docker CLI:**
```bash
docker build -t compoviz-dev .
docker run -d -p 8080:80 --name compoviz-dev compoviz-dev
```

### 💻 Local Development

**Prerequisites:**
- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/)

**Setup:**
```bash
git clone https://github.com/adavesik/compoviz.git
cd compoviz
npm install
npm run dev
```

**Optional** - Disable Vercel Analytics:
```bash
cp .env.example .env
```

Access at `http://localhost:5173`

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite | Modern UI with fast HMR |
| **Styling** | Tailwind CSS | Custom dark theme with design system |
| **Diagrams** | Mermaid.js | Enhanced architecture visualization |
| **Visual Editor** | React Flow | Drag-and-drop node-based editor |
| **Parsing** | Custom Parser + js-yaml | Spec-compliant Docker Compose parsing |
| **State Management** | React Context + Custom Hooks | `useCompose`, `useMultiProject`, `useHistory` |
| **Worker Threads** | Web Workers | Non-blocking async parsing |
| **Testing** | Vitest | 200+ tests with real-world fixtures |

---

## 📚 Development Scripts

| Command | Description | Underlying Command |
|---------|-------------|-------------------|
| `npm run dev` | Start Vite dev server (hot reload) | `vite` |
| `npm run build` | Build production bundle | `vite build` |
| `npm run preview` | Preview production build | `vite preview` |
| `npm run lint` | Lint codebase | `eslint .` |
| `npm test` | Run all tests (CI mode) | `vitest run` |
| `npm run test:watch` | Run tests in watch mode | `vitest` |
| `npm run test:ui` | Run interactive test UI | `vitest --ui` |
| `npm run docker:dev` | Build & start container | `docker compose up` |
| `npm run docker:dev -- -d` | Build & start (detached) | `docker compose up -d` |
| `npm run docker:restart` | Restart running container | `docker compose restart` |
| `npm run docker:rebuild` | Rebuild image and start | `docker compose up --build` |
| `npm run docker:down` | Stop and remove containers | `docker compose down` |
| `npm run docker:clean` | Full cleanup (containers + images) | `docker compose down --rmi local --volumes` |

---

## 🏗️ Architecture Highlights

### Parser Pipeline

```
YAML Input → Parse → Includes → Extends → Variables → Profiles → Output
              │        │         │         │           │
              │        │         │         │           └─ Filter by active profiles
              │        │         │         └─ Interpolate ${VAR:-default}
              │        │         └─ Resolve service inheritance
              │        └─ Merge multi-file includes
              └─ Parse raw YAML with js-yaml
```

### Key Components

- **ComposeParser** - Multi-stage orchestrator with error recovery
- **IncludeResolver** - Circular dependency detection
- **ExtendsResolver** - Spec-compliant service merging
- **VariableInterpolator** - Advanced `${VAR}` syntax support
- **ProfileFilter** - Profile-based service filtering
- **WorkerManager** - Web Worker lifecycle management
- **GraphvizRenderer** - Mermaid.js diagram generation

---

## 🧪 Testing & Quality

- **200+ test cases** covering all parser stages
- **Integration tests** with real-world Docker Compose fixtures
- **Performance benchmarks** - 50 services in ~25ms
- **Zero linting errors** - ESLint strict mode
- **100% passing tests** - Continuous validation

**Run tests:**
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Interactive UI
```

---

## 🤝 Contributing

We welcome contributions! Whether it's bug reports, feature requests, or code contributions, your input helps make Compoviz better.

### How to Contribute

1. **Fork the Project** on GitHub
2. **Create a Feature Branch**: `git checkout -b feature/AmazingFeature`
3. **Make Your Changes**: Follow existing code style and add tests
4. **Run Tests**: `npm test` and `npm run lint`
5. **Commit Changes**: `git commit -m 'feat: add AmazingFeature'` (follow [Conventional Commits](https://www.conventionalcommits.org/))
6. **Push to Branch**: `git push origin feature/AmazingFeature`
7. **Open a Pull Request** with clear description

### Development Guidelines

- Follow existing code patterns and architecture
- Add tests for new features
- Ensure all tests pass and no linting errors
- Update documentation as needed
- Keep commits atomic and well-described

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

## 🙏 Acknowledgments

- **Docker Community** - For the amazing containerization ecosystem
- **Compose Specification** - For the comprehensive spec documentation
- **Contributors** - Everyone who has contributed code, issues, and ideas
- **Open Source** - Built on the shoulders of giants

---

## 🔗 Links

- **Live Demo**: [compoviz.pro](https://compoviz.pro)
- **GitHub**: [github.com/adavesik/compoviz](https://github.com/adavesik/compoviz)
- **Issues**: [Report a bug or request a feature](https://github.com/adavesik/compoviz/issues)
- **Docker Compose Spec**: [compose-spec.io](https://compose-spec.io/)

---

<p align="center">
  <strong>Built with ❤️ for the Docker Community</strong><br/>
  <sub>Making Docker Compose architecture beautiful, one diagram at a time.</sub>
</p>

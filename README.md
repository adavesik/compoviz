# 🐳 Docker Compose Architect (Compoviz)

> Transform your Docker infrastructure from static YAML to dynamic, visual architecture.

[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-%2320232b.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Mermaid](https://img.shields.io/badge/mermaid-%23ff5f5f.svg?style=for-the-badge&logo=mermaid&logoColor=white)](https://mermaid.js.org/)

**Docker Compose Architect** is a premium, web-based visual editor and architect tool for Docker Compose files. Whether you're onboarding newcomers to a complex microservices mesh or debugging port collisions across multiple legacy projects, Compoviz provides the clarity you need.

---

## ✨ Key Features

### 🎨 Visual Architecture Mapping
*   **Pro-Grade Diagrams**: Automatically generates professional-grade architecture diagrams using an enhanced Mermaid.js engine.
*   **Logical Grouping**: Services are visually grouped by their **Docker Networks**.
*   **Edge Intelligence**: `depends_on` conditions (`healthy`, `started`) are visualized as labeled paths.
*   **Infrastructure Insights**: Visualizes host path mounts, named volumes, secrets, and configs at a glance.

### 🔍 Multi-Project Comparison
*   **Collision Detection**: Load up to 3 different `docker-compose.yml` files simultaneously.
*   **Conflict Analysis**: Real-time detection of port collisions, duplicate container names, and shared host volumes.
*   **Cross-Project Visualization**: See how distinct projects interact via shared networks or shared infrastructure.

### 🛠️ Robust Service Editor
*   **Spec-Compliant**: Built for the modern [Compose Specification](https://compose-spec.io/) (no more obsolete `version: '3.8'`).
*   **Smart Templates**: Instantly spin up standardized configurations for Redis, PostgreSQL, Nginx, MongoDB, and more.
*   **Field Validation**: Real-time warnings for missing images, undefined network references, and duplicate resource names.
*   **Rich Controls**: Full support for environment variables, `.env` files, healthchecks, entrypoints, and user permissions.

### ⌨️ Developer Experience
*   **Undo/Redo**: Full history management with `Ctrl+Z` / `Ctrl+Y` shortcuts.
*   **Glassmorphism UI**: A stunning "Cyberpunk" dark mode interface designed for maximum focus.
*   **Instant Export**: Export clean, optimized YAML ready for production.

---

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/compoviz.git
   cd compoviz
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

---

## 🛠️ Tech Stack

*   **Frontend**: React + Vite
*   **Styling**: Tailwind CSS (Custom "Cyber" Theme)
*   **Diagrams**: Mermaid.js (Enhanced)
*   **Logic**: Custom hooks for history (`useHistory`) and state (`useCompose`, `useMultiProject`)
*   **YAML Parsing**: js-yaml

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

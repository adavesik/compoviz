<div align="center">

<a href="https://compoviz.pro">
  <img src="docs/assets/readme/logo.jpg" alt="Compoviz logo: a glowing cube connected to a network graph" width="220">
</a>

# Compoviz

### See the architecture behind your Docker Compose files.

Explore, edit, and visualize Docker Compose projects in your browser.<br>
Build stacks visually, compare configurations, and learn from real examples.

<p>
  <a href="https://compoviz.pro"><img src="https://img.shields.io/badge/%E2%96%B6%20Live%20app-compoviz.pro-6EE7F2?style=for-the-badge&labelColor=1a1033" alt="Open the live app at compoviz.pro"></a>
</p>

<p>
  <a href="https://github.com/adavesik/compoviz/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/adavesik/compoviz/ci.yml?branch=main&label=CI&logo=githubactions&logoColor=white&labelColor=1a1033" alt="CI status"></a>
  <a href="https://github.com/adavesik/compoviz/releases"><img src="https://img.shields.io/github/v/release/adavesik/compoviz?color=8B5CF6&labelColor=1a1033" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/adavesik/compoviz?color=22D3EE&labelColor=1a1033" alt="MIT license"></a>
  <a href="https://github.com/adavesik/compoviz/stargazers"><img src="https://img.shields.io/github/stars/adavesik/compoviz?style=flat&logo=github&color=E5A84B&labelColor=1a1033" alt="GitHub stars"></a>
  <a href="https://github.com/adavesik/compoviz/pkgs/container/compoviz"><img src="https://img.shields.io/badge/ghcr.io-compoviz-2496ED?logo=docker&logoColor=white&labelColor=1a1033" alt="Docker image on GHCR"></a>
</p>

<p>
  <a href="https://compoviz.pro"><b>Open Compoviz</b></a> &nbsp;·&nbsp;
  <a href="#self-host"><b>Self-host</b></a> &nbsp;·&nbsp;
  <a href="#explore-real-compose-projects"><b>Explore examples</b></a> &nbsp;·&nbsp;
  <a href="CONTRIBUTING.md"><b>Contribute</b></a>
</p>

<sub>No account required. Compose files you import are processed in your browser.</sub>

</div>

<br>

![Compoviz Build mode showing Docker services, networks, dependencies, volumes, and secrets on an interactive canvas](docs/assets/readme/build-canvas.png)

*An actual Compose project in Build mode. Select nodes to edit them, or connect resources on the canvas.*

---

## From Compose YAML to a picture you can work with

### Understand what's connected

Import a Compose file or project folder and switch to **View** for a structured diagram of services, networks, dependencies, published ports, and storage.

![Compoviz View mode visualizing services grouped by networks with dependency arrows, exposed ports and storage resources](docs/assets/readme/architecture-view.png)

### Build and edit without losing the YAML

Use **Build** to add services, networks, volumes, secrets, and configs on an interactive canvas. Start from a service template or edit the Compose definition directly in **Editor**.

![Compoviz Editor mode alongside the Compose source](docs/assets/readme/compose-editor.png)

### Explore real Compose projects

Not sure where to start? Open the **Examples Explorer** to browse curated stacks or load more from [docker/awesome-compose](https://github.com/docker/awesome-compose). Search by stack or category, select an example, and inspect its architecture without cloning a repository.

![Compoviz Examples Explorer with curated stacks and categories](docs/assets/readme/examples-explorer.png)

For supported examples and uploaded project folders, Compoviz can inspect Dockerfiles referenced by `build:` and show resolved base-image information in the diagrams. Resolution is best-effort; it doesn't inspect running containers or built images.

---

## More than a diagram

| | What you can do |
| --- | --- |
| **Compose-aware parsing** | Work with `include`, `extends`, variables, profiles, and multi-file projects. |
| **Visual builder** | Add and connect resources with drag and drop, or start from templates. |
| **Architecture view** | See service dependencies, network grouping, ports, volumes, secrets, and configs. |
| **Compare projects** | Inspect up to three Compose projects, including potential port and resource conflicts. |
| **Examples Explorer** | Browse real-world stacks and explore Dockerfile base-image details where available. |
| **Local-first workflow** | Import and work with your own Compose files without uploading them to a Compoviz backend. |

Compoviz visualizes **declared configuration**. It is not a container runtime monitor, vulnerability scanner, or replacement for `docker compose config` and deployment-time validation.

## Try it

**In your browser:** [compoviz.pro](https://compoviz.pro) — open an example or import a Compose file. No registration or installation.

### Self-host

Run the published image:

```bash
docker run -d --name compoviz -p 8080:80 ghcr.io/adavesik/compoviz:latest
```

Open **http://localhost:8080**.

Compoviz itself doesn't need a server-side application API to process your Compose files. Features that browse remote examples fetch those resources from GitHub when used.

### Run locally for development

```bash
git clone https://github.com/adavesik/compoviz.git
cd compoviz
npm install
npm run dev
```

Run the checks before submitting a change:

```bash
npm test
npm run lint
npm run build
```

## Under the hood

Compoviz is built with React and Vite. The interactive builder uses React Flow, while the architecture view is generated from a multi-stage Compose parser. Parsing work is moved off the main UI thread with Web Workers.

If you want to dig deeper, start with the [source code](src/), [contribution guide](CONTRIBUTING.md), and [changelog](CHANGELOG.md).

## Contributing and feedback

Compoviz is an independent open-source project. Bug reports, Compose edge cases, documentation improvements, and pull requests are welcome.

- [Report a bug or propose an improvement](https://github.com/adavesik/compoviz/issues)
- [Ask a question or share an idea](https://github.com/adavesik/compoviz/discussions)
- [Read the contribution guide](CONTRIBUTING.md)
- [See releases](https://github.com/adavesik/compoviz/releases)

**License:** [MIT](LICENSE) · **Live app:** [compoviz.pro](https://compoviz.pro)

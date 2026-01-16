# Contributing to Compoviz

Thanks for your interest in contributing to Compoviz! 🎉

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)

### Local Development

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/compoviz.git
   cd compoviz
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   # Optional: To disable Vercel Analytics just copy the .env.example file with:
   cp .env.example .env
   ```

   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

### Testing

Run the test suite locally to ensure everything is working:

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Open Vitest UI for a better experience
npm run test:ui
```

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

## How to Contribute

### Reporting Bugs

- Use the bug report template when creating an issue
- Include your browser version, OS, and steps to reproduce
- If possible, attach the problematic `docker-compose.yml` file

### Suggesting Features

- Use the feature request template
- Explain the use case and why it would benefit other users
- Check existing issues first to avoid duplicates

### Submitting Pull Requests

1. **Discuss first for big changes**: Open an issue to discuss major changes before investing time in a PR
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes**: Keep commits focused and write clear commit messages
4. **Test locally**: Make sure the app builds and runs without errors
5. **Push and create a PR**: Push to your fork and submit a pull request

## Code Style

- Follow the existing code style in the project
- Use meaningful variable and function names
- Add comments for complex logic

## Project Structure

```
src/
├── components/     # React components
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
└── styles/         # CSS files
```

## Questions?

Feel free to open a discussion or reach out via GitHub issues.

Thanks for contributing! 🐳

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See [PROJECT.md](PROJECT.md) for project overview, dev commands, and tech stack.
See [ARCHITECTURE.md](ARCHITECTURE.md) for process model, IPC patterns, and codebase structure.

## Feature Documentation

This project follows a **feature-first** architecture. Each feature is self-contained with its own UI components, data models, APIs, etc. organized within the codebase.

There is a `features/` directory at the project root containing **one markdown file per feature**. These files document:

- What the feature is and its purpose
- How it works from a user perspective
- Key technical details about its implementation

When building a new feature, always create a corresponding `features/{feature-name}.md` file. When modifying an existing feature, update its markdown file if the changes affect behavior or architecture. Always consult the relevant feature doc before working on a feature to understand its design intent.

## Development Rules

- Run `npm run watch` before starting development — auto-rebuilds TypeScript on changes via esbuild.
- Files in `media/webview/` (CSS, fonts, JS) are served directly to the webview and don't need a build step.
- Files in `src/` (TypeScript) must be built before changes appear in the Extension Development Host.
- To test, press F5 to launch the Extension Development Host, then reload it after rebuilds.
- TypeScript strict mode is enabled — do not disable it.
- `codicon.css` and `codicon.ttf` in `media/webview/` are copied from `@vscode/codicons` at build time by `esbuild.js`. If icons are missing, run `npm run build` to re-copy them.
- The webview uses a strict Content Security Policy with nonces — all inline scripts/styles must use the generated nonce.

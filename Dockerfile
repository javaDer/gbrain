# Production image for the HTTP/MCP server.
FROM oven/bun:1.4.2

WORKDIR /app

# Keep dependency installation in its own layer so source-only changes reuse it.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production --ignore-scripts

# The admin bundle is generated and committed as part of the release build.
COPY src ./src
COPY admin/dist ./admin/dist
COPY skills ./skills
COPY recipes ./recipes
COPY vendor ./vendor
COPY native ./native
COPY templates ./templates
COPY VERSION ./VERSION

# Verify the runtime and its platform-specific native addon before publishing.
RUN bun run src/cli.ts --version \
    && bun -e 'import postgres from "#postgres"; import { createRequire } from "node:module"; const require = createRequire(import.meta.url); require("./native/locks/prebuilds/linux-" + process.arch + "-glibc.node"); if (typeof postgres !== "function") throw new Error("Postgres module unavailable");'

ENV NODE_ENV=production
EXPOSE 8787

# The brain/config directory is supplied by the deployment (or a volume).
CMD ["bun", "run", "src/cli.ts", "serve", "--http", "--bind", "0.0.0.0"]

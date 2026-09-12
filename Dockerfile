# Production image for the HTTP/MCP server.
FROM oven/bun:1.3.13

WORKDIR /app

# Keep dependency installation in its own layer so source-only changes reuse it.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production --ignore-scripts

# The admin bundle is generated and committed as part of the release build.
COPY src ./src
COPY admin/dist ./admin/dist
COPY skills ./skills
COPY recipes ./recipes
COPY VERSION ./VERSION

ENV NODE_ENV=production
EXPOSE 8787

# The brain/config directory is supplied by the deployment (or a volume).
CMD ["bun", "run", "src/cli.ts", "serve", "--http", "--bind", "0.0.0.0"]

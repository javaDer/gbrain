FROM oven/bun:1.3.13

WORKDIR /app

# Layer 1 — dependencies (cached unless lockfile changes)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Layer 2 — source code (cached unless source changes)
COPY . .

# PGLite data + config persistence
VOLUME ["/root/.gbrain"]

# Default: HTTP MCP server on 3131
EXPOSE 3131

# Graceful shutdown
STOPSIGNAL SIGTERM

CMD ["bun", "run", "src/cli.ts", "serve", "--http"]

# Stage 1: Build
FROM oven/bun:1.3.13 AS build

WORKDIR /build

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

COPY . .
# 不指定 --target，让 bun 根据构建容器的 CPU 架构自动选择
# linux/amd64 容器 → bun-linux-x64，linux/arm64 容器 → bun-linux-arm64
RUN bun build --compile --outfile bin/gbrain src/cli.ts

# Stage 2: Runtime
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /build/bin/gbrain /usr/local/bin/gbrain

ENTRYPOINT ["gbrain"]

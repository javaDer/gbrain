# Stage 1: Build
FROM oven/bun:1.3.13 AS build

WORKDIR /build

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun build --compile --target=bun-linux-x64 --outfile bin/gbrain src/cli.ts

# Stage 2: Runtime
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /build/bin/gbrain /usr/local/bin/gbrain

ENTRYPOINT ["gbrain"]

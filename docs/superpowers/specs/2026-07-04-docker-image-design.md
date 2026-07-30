# Docker 镜像构建设计

**日期:** 2026-07-04
**状态:** 已确认
**目标:** 通过 GitHub Actions 自动构建 gbrain Docker 镜像，推送到 GHCR，支持 HTTP 服务部署和 stdio MCP 两种使用模式。

## 动机

gbrain 目前通过 `bun build --compile` 发布独立二进制文件（`release.yml`）。用户需要 Docker 镜像来：

- 将 gbrain 部署为长期运行的 MCP Server（HTTP 模式）
- 在容器化环境中通过 stdio 使用 MCP（`docker run -i`）
- 避免手动安装 Bun 运行时

## 设计

### Dockerfile

```dockerfile
FROM oven/bun:1.3.13

WORKDIR /app

# Layer 1 — dependencies (cached unless lockfile changes)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Layer 2 — source code (cached unless source changes)
COPY . .

VOLUME ["/root/.gbrain"]
EXPOSE 3131
STOPSIGNAL SIGTERM

CMD ["bun", "run", "src/cli.ts", "serve", "--http"]
```

**决策：**
- 基础镜像 `oven/bun:1.3.13`，与 release.yml 中使用的 Bun 版本一致
- `--production` 跳过 devDependencies，减小镜像体积
- 默认 CMD 为 HTTP 模式；stdio 模式通过覆盖 CMD 实现
- VOLUME 确保 PGLite 数据和 `/root/.gbrain/config.json` 持久化
- SIGTERM 配合 serve.ts 中已有的信号处理器实现优雅退出

### GitHub Actions 工作流

```yaml
# .github/workflows/docker.yml
name: Docker

on:
  push:
    tags: ['v*']

permissions:
  contents: read
  packages: write

env:
  REGISTRY: ghcr.io

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**决策：**
- 推送 `v*` tag 时触发，与二进制 release 并行运行
- 推送到 GHCR（零外部依赖，GITHUB_TOKEN 即可用）
- 标签策略：`v0.42.56.0` → `:v0.42.56.0` + `:v0.42` + `:latest`
- GitHub Actions Cache 缓存镜像层

### 使用方式

**HTTP 模式：**
```bash
docker run -d --name gbrain -p 3131:3131 -v gbrain-data:/root/.gbrain ghcr.io/<user>/gbrain:latest
docker exec -it gbrain bun run src/cli.ts init
curl http://localhost:3131/health
```

**stdio 模式：**
```bash
docker run -i --rm -v gbrain-data:/root/.gbrain ghcr.io/<user>/gbrain:latest bun run src/cli.ts serve
```

## 待交付

1. `.dockerignore`
2. `Dockerfile`
3. `.github/workflows/docker.yml`

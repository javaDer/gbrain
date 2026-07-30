# Docker 镜像构建 — 实施计划

**日期:** 2026-07-04
**规格:** docs/superpowers/specs/2026-07-04-docker-image-design.md
**状态:** 执行中

## 全局约束

- Dockerfile 基础镜像: `oven/bun:1.3.13`
- 端口: `3131`
- 仓库: `ghcr.io`，认证使用 `secrets.GITHUB_TOKEN`
- 触发条件: 推送 `v*` tag
- 默认 CMD: HTTP 模式 (`serve --http`)
- 卷: `/root/.gbrain`
- 缓存: GitHub Actions Cache (`type=gha`)

## 任务列表

### 任务 1 — 创建三个文件

- `.dockerignore` — 排除 node_modules, bin, .git, test, admin, docs, scripts, *.md, .env*
- `Dockerfile` — `oven/bun:1.3.13`, 两层缓存, VOLUME, EXPOSE 3131, SIGTERM, CMD serve --http
- `.github/workflows/docker.yml` — tag 触发, GHCR 登录, docker/metadata-action 标签, build-push-action 推送

**模型:** cheap（机械实现，规格完整，3 个独立文件）

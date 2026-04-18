# syntax=docker/dockerfile:1

# ---- builder ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache git

COPY package.json ./
# Install all deps (including devDeps for tsc)
RUN npm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build


# ---- runtime ----
FROM node:20-alpine AS runtime

# Install git and gh CLI (required by context-loader and github client)
RUN apk add --no-cache git curl bash && \
    # Install GitHub CLI
    apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community github-cli || \
    (curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apk/keys/githubcli-archive-keyring.gpg >/dev/null && \
     echo "https://cli.github.com/packages/stable/dists/alpine/main" | tee -a /etc/apk/repositories && \
     apk add --no-cache gh) || \
    (wget -q -O /tmp/gh.tar.gz "$(wget -q -O - https://api.github.com/repos/cli/cli/releases/latest | grep -o 'https://.*linux_amd64.tar.gz')" && \
     tar -xzf /tmp/gh.tar.gz -C /usr/local --strip-components=1 && \
     rm /tmp/gh.tar.gz)

WORKDIR /app

# Create var directory for quota state persistence
RUN mkdir -p /app/var

COPY package.json ./
# Production deps only
RUN npm install --frozen-lockfile --omit=dev

COPY --from=builder /app/dist ./dist

# Cloud Run expects an HTTP server on $PORT (default 8080)
ENV PORT=8080

# The bot is stateless except for var/ — use a volume mount in Cloud Run for quota persistence
EXPOSE 8080

CMD ["node", "dist/index.js"]

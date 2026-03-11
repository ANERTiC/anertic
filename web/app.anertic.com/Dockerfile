FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS dependencies
COPY package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG VITE_API_URL=https://api.anertic.com
ENV VITE_API_URL=$VITE_API_URL
COPY . /app/
COPY --from=dependencies /app/node_modules /app/node_modules
WORKDIR /app
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/build/client /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

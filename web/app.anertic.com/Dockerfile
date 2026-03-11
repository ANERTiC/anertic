FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS dependencies
COPY package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY . /app/
COPY --from=dependencies /app/node_modules /app/node_modules
WORKDIR /app
RUN pnpm build

FROM base
COPY package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/build /app/build
CMD ["pnpm", "start"]

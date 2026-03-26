FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS dependencies
COPY web/anertic.com/package.json web/anertic.com/pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY web/anertic.com/ /app/
COPY --from=dependencies /app/node_modules /app/node_modules
WORKDIR /app
RUN pnpm build

FROM base AS prod-dependencies
COPY web/anertic.com/package.json web/anertic.com/pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod

FROM base AS runtime
COPY --from=build /app/build /app/build
COPY --from=build /app/package.json /app/
COPY --from=prod-dependencies /app/node_modules /app/node_modules
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["pnpm", "start"]

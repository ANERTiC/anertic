FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS dependencies
COPY web/app.anertic.com/package.json web/app.anertic.com/pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
COPY web/app.anertic.com/ /app/
COPY --from=dependencies /app/node_modules /app/node_modules
WORKDIR /app
RUN pnpm build

FROM base AS runtime
COPY --from=build /app/build /app/build
COPY --from=build /app/package.json /app/
COPY --from=dependencies /app/node_modules /app/node_modules
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["pnpm", "start"]

FROM node:20.18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

FROM node:20.18-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* são inlinadas no bundle durante o `next build`: precisam existir
# AQUI, não no runner. `environment:` do container final não tem efeito, o JS
# que vai pro browser já foi gerado. Sem o build arg o valor vira "" e o
# `src/lib/env.ts` cai no fallback de produção.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ORG_SLUG
ARG NEXT_PUBLIC_HUB_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ORG_SLUG=$NEXT_PUBLIC_ORG_SLUG
ENV NEXT_PUBLIC_HUB_URL=$NEXT_PUBLIC_HUB_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20.18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]

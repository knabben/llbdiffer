# deps: installs node_modules only; reused for build, lint, and test targets
FROM node:20-alpine AS deps
# Next.js's SWC native binary needs glibc compatibility shims on musl/Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# build: compiles the Next.js standalone production server
FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# runner: minimal production image, no node_modules copy needed (standalone bundles deps)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

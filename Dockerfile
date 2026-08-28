FROM node:22-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install

FROM base AS build
COPY . .
RUN npm run build

FROM base AS migrator
COPY . .
CMD ["npm", "run", "db:migrate"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

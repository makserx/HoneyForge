
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .
RUN mkdir -p /app/data && npx next build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data


COPY --from=builder /app/lib ./lib

EXPOSE 3000

CMD ["npm", "run", "start"]
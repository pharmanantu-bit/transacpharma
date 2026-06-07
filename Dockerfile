# --- Étape 1 : build du front React ---
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Étape 2 : serveur Express + front compilé ---
FROM node:20-alpine
WORKDIR /app

# better-sqlite3 a besoin d'outils de build natifs (compilation à l'install)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY server/ ./server/
# Front compilé depuis l'étape 1
COPY --from=client-build /app/client/dist ./client/dist

# Volume de persistance de la base SQLite
RUN mkdir -p /app/db
VOLUME ["/app/db"]

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.js"]

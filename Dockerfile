# --- Étape 1 : build du front React ---
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Étape 2 : serveur Express + front compilé ---
# Base Debian "slim" (glibc) : meilleure compatibilité avec les binaires
# pré-compilés de @libsql/client, aucun outil de build natif nécessaire.
FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server/ ./server/
# Front compilé depuis l'étape 1
COPY --from=client-build /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# En production la base est dans le cloud Turso (TURSO_DATABASE_URL).
# Sans cette variable, l'app retombe sur un fichier SQLite local dans /app/db.
CMD ["node", "server/index.js"]

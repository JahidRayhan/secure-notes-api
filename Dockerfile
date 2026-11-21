FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4000
# Syncs indexes to match schema.index(), then starts the API.
CMD ["npm", "run", "start:prod"]

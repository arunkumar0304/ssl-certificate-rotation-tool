# Stage 1: build the React dashboard
FROM node:20-slim AS client
WORKDIR /build
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Express API + built dashboard
FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY demo ./demo
COPY ansible ./ansible
COPY config.json config.docker.json ./
COPY --from=client /build/dist ./client/dist
ENV CERTROTATOR_CONFIG=config.docker.json
EXPOSE 8000
CMD ["node", "src/index.js"]

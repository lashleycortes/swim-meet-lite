FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src ./src
COPY tests ./tests
COPY jest.config.js ./

FROM base AS test
RUN npm test

FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=base /app/src ./src
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]

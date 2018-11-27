FROM node:8 as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

FROM node:8-slim
USER node
WORKDIR /home/node
COPY --from=builder --chown=node:node /app .
CMD [ "node", "copy.js" ]

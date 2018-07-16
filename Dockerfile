FROM node:8

RUN groupadd -r nodejs && useradd -m -r -g nodejs -s /bin/bash nodejs
USER nodejs
WORKDIR /home/nodejs

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "node", "copy.js" ]

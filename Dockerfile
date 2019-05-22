FROM node:8-alpine

WORKDIR /app

COPY index.js package.json /app/

RUN npm install

CMD npm run start

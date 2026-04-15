FROM node:20-alpine

RUN apk add --no-cache ffmpeg curl

WORKDIR /app
COPY server.js .
COPY public/ public/

RUN npm init -y && npm install express

EXPOSE 8890
CMD ["node", "server.js"]

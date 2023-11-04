FROM node:latest
COPY . .
ENTRYPOINT [ "node", "main.js" ]
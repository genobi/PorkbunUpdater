FROM node:slim
COPY . .
RUN mkdir -p /data/porkbun_updater/
ENTRYPOINT [ "node", "main.js" ]
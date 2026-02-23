# syntax=docker/dockerfile:1
# docker build . -f docker/docker-y-websocket/Dockerfile -t micrology/prsm-y-websocket
# docker run -p1234:1234 --name prsm-y-websocket -d micrology/prsm-y-websocket

# multi-platform:
# docker buildx build -f docker/docker-y-websocket/Dockerfile --platform linux/amd64,linux/arm64 -t micrology/prsm-y-websocket --push .
# use same docker run command as above

# interactive:
# docker run -it --rm -p1234:1234 --name prsm-y-websocket micrology/prsm-y-websocket

FROM node:24-slim
WORKDIR /public/prsm/ws-server
COPY ./ws-server/src /public/prsm/ws-server/src
COPY ./ws-server/package.json /public/prsm/ws-server/package.json
RUN npm install --omit=dev
ENV YPERSISTENCE=/db/dbDir
EXPOSE 1234
ENV HOST=0.0.0.0
CMD [ "node", "./src/server.js" ] 
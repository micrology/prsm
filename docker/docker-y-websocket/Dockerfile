# syntax=docker/dockerfile:1
# docker build . -f docker/docker-y-websocket/Dockerfile -t micrology/prsm-y-websocket
# docker run -p1234:1234 --name prsm-y-websocket -d micrology/prsm-y-websocket

# multi-platform:
# docker buildx build -f docker/docker-y-websocket/Dockerfile --platform linux/amd64,linux/arm64 -t micrology/prsm-y-websocket --push .
# use same docker run command as above

FROM node:17-slim
RUN npm install -g y-websocket
EXPOSE 1234
ENV HOST=0.0.0.0
CMD ["npx", "y-websocket"]
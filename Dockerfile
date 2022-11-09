# syntax=docker/dockerfile:1

# create single arch image: 
# docker build -t micrology/alhttp .
# or for Intel chip
# docker build --build-arg TARGETPLATFORM=linux/amd64 -t  micrology/alhttp .  
# docker run -d -t -p8888:80 --name httponly --rm micrology/alhttp
# docker exec -ti httponly /bin/bash

# create multi arch image: 
# docker buildx create --name mybuilder --driver docker-container --use --bootstrap
# amd64 is the same as Intel x86-64  arm64 is the same as Mac M1 and aarch64
# docker buildx build --platform linux/amd64,linux/arm64 -t micrology/prsm --push .
# docker run -d -t -p8888:80 --name prsm --rm micrology/prsm
# docker exec -ti prsm /bin/bash

FROM amazonlinux:2  
ARG TARGETPLATFORM=linux/arm64

# Install necessary commands
RUN yum update -y && yum install procps httpd install tar xz -y

# Install node in /opt
ARG node_version=v17.7.1
RUN <<EOF 
  cd /opt
  if [ "$TARGETPLATFORM" = "linux/arm64" ] ; then 
  curl -LO https://nodejs.org/download/release/${node_version}/node-${node_version}-linux-arm64.tar.xz 
  tar xJf node-${node_version}-linux-arm64.tar.xz 
  rm node-${node_version}-linux-arm64.tar.xz 
  mv node-${node_version}-linux-arm64 node-${node_version} 
  else 
  curl -LO https://nodejs.org/download/release/${node_version}/node-${node_version}-linux-x64.tar.xz 
  tar xJf node-${node_version}-linux-x64.tar.xz 
  rm node-${node_version}-linux-x64.tar.xz 
  mv node-${node_version}-linux-x64 node-${node_version} 
  fi
EOF
ENV PATH=/opt/node-${node_version}/bin:${PATH}

# create user directory
RUN mkdir /home/prsm && cd /home/prsm
WORKDIR /home/prsm

# copy files for prsm app and web-socket server
COPY ["./DockerAssets/httpd.conf", "/etc/httpd/conf/httpd.conf"]
COPY ["index.html", ".htaccess", "./"]
COPY ["dist/*", "./dist/"]
COPY ["./DockerAssets/start_httpd", "start_httpd"]
RUN npm i y-websocket

# start web socket server and httpd
CMD ./start_httpd
EXPOSE 80 1234
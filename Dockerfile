# syntax=docker/dockerfile:1

# create single arch image: 
# docker build -t micrology/alhttp .
# or for Intel chip
# docker build --build-arg TARGETPLATFORM=linux/amd64 -t  micrology/alhttp .  
# docker run -d -t -p8888:80 -p1234:1234 --name httponly --rm -e HOST=0.0.0.0 micrology/alhttp
# poke around inside with:
# docker exec -ti httponly /bin/bash

# create multi arch image: 
# docker buildx create --name mybuilder --driver docker-container --use --bootstrap
# amd64 is the same as Intel x86-64  arm64 is the same as Mac M1 and aarch64
# docker buildx build --platform linux/amd64,linux/arm64 -t micrology/prsm --push .
# docker run -d -t -p8888:80 -p1234:1234 --name prsm --rm -e HOST=0.0.0.0 micrology/prsm
# docker exec -ti prsm /bin/bash

FROM amazonlinux:2  
ARG TARGETPLATFORM=linux/arm64

# Install necessary commands
RUN yum update -y && yum install procps httpd install tar xz -y

# Install node in /opt
ARG node_version=v17.7.1
RUN <<EOF 
set -x
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
RUN echo "here are some numbers: $(seq 10)"
RUN echo $PATH 
RUN ls -l /opt/node-v17.7.1/bin 
RUN pwd 
RUN ls -l /opt 
RUN ls -l /opt/node-v17.7.1/lib/node_modules/npm/bin/
RUN ln -s /opt/node-${node_version}/bin/node /usr/bin/node
RUN ls -l /usr/bin/node
RUN npm -v
# create user directory
RUN mkdir /home/prsm && cd /home/prsm
WORKDIR /home/prsm

# copy files for prsm app and websocket server
COPY ["./DockerAssets/httpd.conf", "/etc/httpd/conf/httpd.conf"]
COPY ["index.html", ".htaccess", "./"]
COPY ["dist/*", "./dist/"]
COPY ["./DockerAssets/start_httpd", "start_httpd"]

#install the websocket server
#RUN npm i y-websocket

# start the image by executing a shell script that starts the web server and the websocket server
RUN chmod +x ./start_httpd
ENTRYPOINT ["./start_httpd"]
EXPOSE 80 1234
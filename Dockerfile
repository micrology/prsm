# syntax=docker/dockerfile:1

# create single arch image: 
# docker build -t micrology/alhttp .
# or for Intel chip
# docker build --build-arg pf=linux-x64 -t  micrology/alhttp .  
# docker run -d -t -p8888:80 --name httponly --rm micrology/alhttp
# docker exec -ti httponly /bin/bash

# create multi arch image: 
# docker buildx build --platform linux/amd64,linux/arm64 -t micrology/alhttpm --push .
# docker run -d -t -p8888:80 --name alhttpm --rm micrology/alhttpm
# docker exec -ti alhttpm /bin/bash

FROM amazonlinux:2  

# Install necessary commands
RUN yum update -y
RUN yum install procps httpd -y

# Install node in /opt
RUN yum install tar xz -y
ARG node_version=v17.7.1
ARG pf=linux-arm64
RUN cd /opt \
  && curl -LO https://nodejs.org/download/release/${node_version}/node-${node_version}-${pf}.tar.xz \
  && tar xJf node-${node_version}-${pf}.tar.xz \
  && rm node-${node_version}-${pf}.tar.xz
ENV PATH=/opt/node-${node_version}-${pf}/bin:${PATH}

RUN mkdir /home/prsm
RUN cd /home/prsm
WORKDIR /home/prsm
RUN rm /etc/httpd/conf/httpd.conf
COPY ["./DockerAssets/httpd.conf", "/etc/httpd/conf/httpd.conf"]
COPY ["index.html", ".htaccess", "./"]
COPY ["dist/*", "./dist/"]
RUN npm i y-websocket
#RUN HOST=localhost PORT=1234 npx y-websocket &
CMD ["-D", "FOREGROUND"]
ENTRYPOINT ["/usr/sbin/httpd"]
EXPOSE 80

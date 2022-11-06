# syntax=docker/dockerfile:1

# create single arch image: 
# docker build -t micrology/alhttp .
# docker run --platform linux/amd64 -d micrology/alhttp
# docker exec -ti loving_wright /bin/bash
FROM --platform=linux/amd64 amazonlinux:2 

# Install necessary commands
RUN yum update -y
RUN yum install procps httpd tar xz -y

ARG node_version=v17.7.1
RUN cd /opt \
  && curl -LO https://nodejs.org/download/release/${node_version}/node-${node_version}-darwin-arm64.tar.xz \
  && tar xJf node-${node_version}-linux-x64.tar.xz \
  && rm node-${node_version}-linux-x64.tar.xz
 ENV PATH=/opt/node-${node_version}-linux-x64/bin:${PATH}
# ENV NODE_ENV=production
RUN mkdir /home/prsm
# RUN adduser prsm
# RUN sudo usermod -aG wheel prsm
# RUN su - prsm
RUN cd /home/prsm
WORKDIR /home/prsm
RUN node -v
RUN npm -v
# RUN touch ~/.bashrc && chmod +x ~/.bashrc
# RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | bash
# # RUN source ~/.bashrc
# RUN pwd
# RUN whoami
# RUN env
# RUN nvm install 17.7.1
# COPY ["package.json", "package-lock.json*", "./"]
# RUN npm install --production
COPY ["css", "doc", "fonts", "html", "icons", "img", "js", "public", "ws-server", "dist", ".htaccess", "index.html", "./"]
# RUN npm run build
CMD ["-D", "FOREGROUND"]
ENTRYPOINT ["/usr/sbin/httpd"]
EXPOSE 80

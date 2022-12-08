# syntax=docker/dockerfile:1

# run these commands from prsm top level
# docker build . -f docker/docker-httpd/Dockerfile -t micrology/prsm-httpd
# docker run -p8080:8080 --name prsm-httpd -d micrology/prsm-httpd

# multi-platform:
# docker buildx build --platform linux/amd64,linux/arm64 -t micrology/prsm-httpd --push -f docker/docker-httpd/Dockerfile .
# use same docker run command as above

# access the web page at http://localhost:8080

FROM node:17-slim
RUN npm install -g http-server
# copy PRSM run files
COPY ["dist/*", "/public/prsm/"]
# copy user manual files
COPY ["doc/help/build/", "/public/prsm/doc/help/"]
# redirect localhost to localhost/prsm
RUN echo '<META HTTP-EQUIV="Refresh" CONTENT="0; URL='\'''./prsm/index.html''\''">' > /public/index.html
ENV HOST=0.0.0.0
CMD ["http-server"]
EXPOSE 8080
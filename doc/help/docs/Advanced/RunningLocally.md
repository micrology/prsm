---
sidebar_position: 8
---
# Running PRSM locally or on an intranet

Some organisations would prefer to run PRSM entirely within their own intranet.  Sometimes it may be desirable to run PRSM just on one computer working offline.  For these cases, PRSM is also available in 'containerised' form, which makes it easy to install it on a local server on an intranet, or even on a laptop.  The server can be a Linux, Windows or Apple Mac machine. The following instructions assume that you have some experience with using the command line in a Terminal or Powershell.

1. Check to see whether `python3` is already installed, by typing `python3 --version` at the command prompt.  If it responds with the version of the python installation, you can go on to the next step.  If you get an error message, you will need to install python, using [these instructions](https://www.python.org/downloads/).
1. Install `podman` using the instructions [here](https://podman.io/getting-started/installation).
1. Install [podman-compose](https://github.com/containers/podman-compose) using the command:  
 `pip3 install podman-compose`
1. Create a blank, plain text file in a convenient directory and name it `compose.yaml`. Use a text editor to copy the following into the file (be sure to use a text editor, not a word processor):  

        services:
          y-websocket:
            image: docker.io/micrology/prsm-y-websocket
            ports: 
              - "1234:1234"
            restart: unless-stopped
          htppd:
            image: docker.io/micrology/prsm-httpd
            ports:
              - "8080:8080"
            restart: unless-stopped

1. Save the file and then run the command:  
`podman-compose up -d`  
in the same directory as the `compose.yaml` file
1. In a web browser,  on the same computer, enter `http://localhost:8080` in the address bar.  You should see the PRSM welcome page (the same as at [https://prsm.uk](https://prsm.uk)).  Click on the 'Start now' button to get to a blank PRSM map.  This copy of PRSM is running entirely locally: you can disconnect the computer from the internet and it will still function.  

If the computer is on an intranet, it should be possible to access this local version of PRSM with a URL something like [http://168.192.0.123:8080](http://168.192.0.123:8080), where the IP address is the local *intranet* address of the server (or if it has one, you can use the local network name of the computer, followed by :8080 as the port number).  If the browser reports that the location is not found, check for access being blocked by a firewall.  A firewall needs to pass ports 8080 *and* 1234.

To stop the PRSM service, navigate to the directory with the `compose.yaml` file and enter the command:  
`podman-compose down`

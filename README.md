<!-- markdownlint-disable-file MD026 MD033-->
# Participatory System Mapper

[![Join the chat at https://gitter.im/PRSM-community/community](https://badges.gitter.im/PRSM-community/community.svg)](https://gitter.im/PRSM-community/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
![MIT Licence](https://img.shields.io/github/license/micrology/prsm)
![Last commit](https://img.shields.io/github/last-commit/micrology/prsm)
![GitHub package.json version](https://img.shields.io/github/package-json/v/micrology/prsm)

## What is it?

The Participatory System Mapper (PRSM for short) is an app that runs in a web browser that makes it easy for a group of people working together to draw networks (or 'maps') of systems.  

The network or map can be anything that has items (or 'factors' or 'nodes') connected by links (or 'edges').  Here are some examples:

* People (the nodes) connected by knowing each other
* Factors or variables causing (the links) changes in other factors
* Switches connected by wires
* Computers connected by network links
* Theories expressed as variables and relationships between them
* Company boards of directors (the nodes) and the directors that sit on more than one board (the links)
* Twitter hashtags (the nodes) included together on posts (the links)
* Scientists (the nodes) co-authoring papers (the links)
* and so on.

### Participatory system mapping

The app is designed to enable groups of people, each using their own computer (or tablet) to collaborate in the drawing of a map.  They may be sitting around a table, discussing the map as it is created face to face, or working remotely, using video conferencing or the chat feature that is built into the app.  Everyone can participate because every edit (creating nodes and links, arranging them and so on) is broadcast to all the other participants as the changes are made (just as Google Docs does for text, for example).  

When you start the app in your browser, a 'room' is created for you in which to draw your network.  You can add other users to this room to share the work.  Only those with access to the room can see what is being created.

## Home page

For more on PRSM, see [the home page](https://prsm.uk) and the [guide to using PRSM](https://prsm.uk/help.html).

## Installation

No installation on your computer is needed.  The software is a web app, which means that it can be accessed using a web browser by pasting this link into the address bar:

<https://prsm.uk/prsm.html>

You need a modern web browser such as Chrome, Firefox, Microsoft Edge or Safari.  It will not work with Internet Explorer.

The software is free and available under a [PolyForm Noncommercial License](https://polyformproject.org/licenses/noncommercial/1.0.0) license.

## Source Code

The program code is available on [GitHub](https://github.com/micrology/prsm).

The javascript (ES6) code in sub-directory ```js``` is divided into modules:

* `prsm.js` handles the main network pane
* `background.js` manages drawing objects on the background
* `styles.js` creates and edits the styles
* the default styles are in `samples.js`
* `files.js` does the import and export functions
* `cluster.js` clusters factors
* `table.js` provides the data view
* `trophic.js` does the trophic layout algorithm
* `betweenness.js` is a web worker that cacilates network statistics in the background
* `tutorial.js` manages the initial tour
* `utils.js` includes utility functions common to several modules
* `merge.js` provides undocumented functions to merge two maps into one

The HTML files that display in the browser are in the ```html``` directory.

PRSM uses two important packages: [```yjs```](https://github.com/yjs/yjs) and [```vis-network```](https://visjs.org/).  The former handles the sharing between participants' browsers and the latter draws the network. A few other packages are used for dealing with touch input ([```Hammer```](https://hammerjs.github.io/)), drawing emojis, and parsing XML file input.  

These components are assembled using [```parcel```](https://parceljs.org/) and the bundled files are placed in the ```dist``` directory.  So that users have an easy URL to access (i.e. not needing to include ```dist``` in the link), there is an ```.htaccess``` file that rewrites URLs from what the user puts into their browser to the correct location.

To install the code, use ```git``` to clone the [repo](https://github.com/micrology/prsm) to your local disk and change to the cloned directory.  Then install the required packages with

```bash
npm install
```

and build the distribution with

```bash
npm run build
```

The Apache2 `headers` module must be enabled. If the installation isn't visible in your browser this is likely the cause.
Enabling the module is simple on Debian/Ubuntu systems:

```bash
sudo a2enmod headers
systemctl restart apache2
```

Documentation can be found in the ```doc``` directory.

See ```package.json``` for other npm commands.

## Acknowledgements

With thanks to all who helped inspire, suggest features for, comment on, and test PRSM, including the members of [CECAN](https://www.cecan.ac.uk/), [CRESS](https://cress.soc.surrey.ac.uk/), [Risk Solutions](https://www.risksol.co.uk/), and Robin Gilbert.

## Bug reports and feature requests

Please report problems, suggestions and praise to [nigel@prsm.uk](mailto:nigel@prsm.uk)

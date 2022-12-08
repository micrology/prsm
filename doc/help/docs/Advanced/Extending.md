---
sidebar_position: 11
---
# Extending PRSM
<!-- markdownlint-disable-next-line -->
*(The following is intended for developers who want to extend PRSM)*

The program code is available on [GitHub](https://github.com/micrology/prsm).  

The javascript (ES6) code in sub-directory `js` is divided into several modules: those that handle the main network pane (`prsm.js`), the background painting functions (`paint.js`), editing the styles (`styles.js`) (the default styles are in `samples.js`), the initial tour (`tutorial.js`),  trophic layout (`trophic.js`), clustering (`cluster.js`), the calculation of  betweenness centrality (`betweenness.js`), file saving and reading (`files.js`), the data view (`table.js`) and  shared utility functions (`utils.js` and `merge.js`).  The HTML file that displays in the browser is in the `html` directory.

PRSM uses two important packages: [`yjs`](https://github.com/yjs/yjs) and [`vis-network`](https://visjs.org/).  The former handles the sharing between participants' browsers and the latter draws the network. A few other packages are used for dealing with touch input ([`Hammer`](https://hammerjs.github.io/)), vector graphics for the background (`fabric.js`), drawing emojis, and parsing XML file input.  

These components are assembled using [`parcel`](https://parceljs.org/) and the bundled file is placed in the `dist` directory.  So that users have an easy URL to access (i.e. not needing to include `dist` in the link), there is an `.htaccess` file that rewrites URLs from what the user puts into their browser to the correct location.

To install the code, use `git` to clone the [repo](https://github.com/micrology/prsm) to your local disk and change to the cloned directory.  Then install the required packages with

        npm install

and build the distribution with

        npm run build

Documentation can be found in the `doc` directory including a [jsdoc](https://jsdoc.app/index.html) index of all functions and methods.

See `package.json` for other npm commands.

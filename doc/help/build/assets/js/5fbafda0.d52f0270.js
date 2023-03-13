"use strict";(self.webpackChunkdocs=self.webpackChunkdocs||[]).push([[80],{3905:(e,t,n)=>{n.d(t,{Zo:()=>d,kt:()=>h});var r=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function o(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function p(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var l=r.createContext({}),s=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):o(o({},t),e)),n},d=function(e){var t=s(e.components);return r.createElement(l.Provider,{value:t},e.children)},c="mdxType",u={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},m=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,i=e.originalType,l=e.parentName,d=p(e,["components","mdxType","originalType","parentName"]),c=s(n),m=a,h=c["".concat(l,".").concat(m)]||c[m]||u[m]||i;return n?r.createElement(h,o(o({ref:t},d),{},{components:n})):r.createElement(h,o({ref:t},d))}));function h(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var i=n.length,o=new Array(i);o[0]=m;var p={};for(var l in t)hasOwnProperty.call(t,l)&&(p[l]=t[l]);p.originalType=e,p[c]="string"==typeof e?e:a,o[1]=p;for(var s=2;s<i;s++)o[s]=n[s];return r.createElement.apply(null,o)}return r.createElement.apply(null,n)}m.displayName="MDXCreateElement"},4184:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>o,default:()=>u,frontMatter:()=>i,metadata:()=>p,toc:()=>s});var r=n(7462),a=(n(7294),n(3905));const i={sidebar_position:11},o="Extending PRSM",p={unversionedId:"Advanced/Extending",id:"Advanced/Extending",title:"Extending PRSM",description:"(The following is intended for developers who want to extend PRSM)",source:"@site/docs/Advanced/Extending.md",sourceDirName:"Advanced",slug:"/Advanced/Extending",permalink:"/doc/help/Advanced/Extending",draft:!1,tags:[],version:"current",sidebarPosition:11,frontMatter:{sidebar_position:11},sidebar:"tutorialSidebar",previous:{title:"Running PRSM locally or on an intranet",permalink:"/doc/help/Advanced/RunningLocally"},next:{title:"Acknowledgements",permalink:"/doc/help/Acknowledgements"}},l={},s=[],d={toc:s},c="wrapper";function u(e){let{components:t,...n}=e;return(0,a.kt)(c,(0,r.Z)({},d,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"extending-prsm"},"Extending PRSM"),(0,a.kt)("p",null,(0,a.kt)("em",{parentName:"p"},"(The following is intended for developers who want to extend PRSM)")),(0,a.kt)("p",null,"The program code is available on ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/micrology/prsm"},"GitHub"),".  "),(0,a.kt)("p",null,"The javascript (ES6) code in sub-directory ",(0,a.kt)("inlineCode",{parentName:"p"},"js")," is divided into several modules: those that handle the main network pane (",(0,a.kt)("inlineCode",{parentName:"p"},"prsm.js"),"), the background painting functions (",(0,a.kt)("inlineCode",{parentName:"p"},"paint.js"),"), editing the styles (",(0,a.kt)("inlineCode",{parentName:"p"},"styles.js"),") (the default styles are in ",(0,a.kt)("inlineCode",{parentName:"p"},"samples.js"),"), the initial tour (",(0,a.kt)("inlineCode",{parentName:"p"},"tutorial.js"),"),  trophic layout (",(0,a.kt)("inlineCode",{parentName:"p"},"trophic.js"),"), clustering (",(0,a.kt)("inlineCode",{parentName:"p"},"cluster.js"),"), the calculation of  betweenness centrality (",(0,a.kt)("inlineCode",{parentName:"p"},"betweenness.js"),"), file saving and reading (",(0,a.kt)("inlineCode",{parentName:"p"},"files.js"),"), the data view (",(0,a.kt)("inlineCode",{parentName:"p"},"table.js"),") and  shared utility functions (",(0,a.kt)("inlineCode",{parentName:"p"},"utils.js")," and ",(0,a.kt)("inlineCode",{parentName:"p"},"merge.js"),").  The HTML file that displays in the browser is in the ",(0,a.kt)("inlineCode",{parentName:"p"},"html")," directory."),(0,a.kt)("p",null,"PRSM uses two important packages: ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/yjs/yjs"},(0,a.kt)("inlineCode",{parentName:"a"},"yjs"))," and ",(0,a.kt)("a",{parentName:"p",href:"https://visjs.org/"},(0,a.kt)("inlineCode",{parentName:"a"},"vis-network")),".  The former handles the sharing between participants' browsers and the latter draws the network. A few other packages are used for dealing with touch input (",(0,a.kt)("a",{parentName:"p",href:"https://hammerjs.github.io/"},(0,a.kt)("inlineCode",{parentName:"a"},"Hammer")),"), vector graphics for the background (",(0,a.kt)("inlineCode",{parentName:"p"},"fabric.js"),"), drawing emojis, and parsing XML file input.  "),(0,a.kt)("p",null,"These components are assembled using ",(0,a.kt)("a",{parentName:"p",href:"https://parceljs.org/"},(0,a.kt)("inlineCode",{parentName:"a"},"parcel"))," and the bundled file is placed in the ",(0,a.kt)("inlineCode",{parentName:"p"},"dist")," directory.  So that users have an easy URL to access (i.e. not needing to include ",(0,a.kt)("inlineCode",{parentName:"p"},"dist")," in the link), there is an ",(0,a.kt)("inlineCode",{parentName:"p"},".htaccess")," file that rewrites URLs from what the user puts into their browser to the correct location."),(0,a.kt)("p",null,"To install the code, use ",(0,a.kt)("inlineCode",{parentName:"p"},"git")," to clone the ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/micrology/prsm"},"repo")," to your local disk and change to the cloned directory.  Then install the required packages with"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre"},"    npm install\n")),(0,a.kt)("p",null,"and build the distribution with"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre"},"    npm run build\n")),(0,a.kt)("p",null,"Documentation can be found in the ",(0,a.kt)("inlineCode",{parentName:"p"},"doc")," directory including a ",(0,a.kt)("a",{parentName:"p",href:"https://jsdoc.app/index.html"},"jsdoc")," index of all functions and methods."),(0,a.kt)("p",null,"See ",(0,a.kt)("inlineCode",{parentName:"p"},"package.json")," for other npm commands."))}u.isMDXComponent=!0}}]);
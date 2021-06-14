<!-- markdownlint-disable-file MD026 MD033 MD036-->
# Participatory System Mapper

## What is it?

The Participatory System Mapper (PRSM for short) is an app that runs in a web browser that makes it easy for a group of people working together to draw networks (or 'maps') of systems.  

### Maps

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

### Systems

The software is aimed at people who are interested in understanding whole systems.  Wikipedia defines a system as [a group of interacting or interrelated entities that form a unified whole](https://en.wikipedia.org/wiki/System).

### Participatory system mapping

The app is designed to enable groups of people, each using their own computer (or tablet) to collaborate in the drawing of a map.  They may be sitting around a table, discussing the map as it is created face to face, or working remotely, using video conferencing or the chat feature that is built into the app.  Everyone can participate because every edit (creating nodes and links, arranging them and so on) is broadcast to all the other participants as the changes are made (just as Google Docs does for text, for example).  

When you start the app in your browser, a 'room' is created for you in which to draw your network.  You can add other users to this room to share the work.  Only those with access to the room can see what is being created.

## Examples

Here are a few examples of what you can do with the app:

The first is a theory of change adapted from an [NPC report](https://www.thinknpc.org/resource-hub/ten-steps/).

![NCP Example](/doc/images/NPCexample.png)

The second is a system map about the environmental impact of goods transport developed by a small group of experts working together using the app.

![SCandL Example](/doc/images/SCandLexample.png)

The third is a large network of 736 nodes and about 9000 links representing the team members playing in the 2019 football World Cup.

![World Cup 2019 Example](/doc/images/WorldCup2019example.png)

## Installation

No installation on your computer is needed.  The software is a web app, which means that it can be accessed using a web browser by pasting this link into the address bar:

<https://prsm.uk/prsm.html>

You need a modern web browser such as Chrome, Firefox, Microsoft Edge or Safari.  It will not work with Internet Explorer.

The software is free and available under an [MIT](https://choosealicense.com/licenses/mit/) license.

## Basic use

When the app is started for the first time in your browser, there is an option to type in your name and then to follow a brief tour that shows you the main items on the web page.  

![Nav Bar icons](/doc/images/start-screen.png)

This introductory tour is only shown the very first time you use PRSM.  If you want to view the tour again, click <button onclick="localStorage.setItem('doneIntro', 'false'); return false">here</button>.

At the top of the screen are a row of buttons.
<!-- ![Nav Bar icons](/doc/images/prsm-nav-icons.png)
<img src="/doc/images/prsm-nav-icons.png" width="400"> -->
This what they do, from left to right:

* **New factor** (or node).  Click on the cross and then click on the blank area below (the 'network pane') to create a node for the network.  A small dialog box will open for you to type in a label for the factor.
* **New link** (or edge). Click on the arrow button and then drag from one factor to another to link them. If you wish, you can have two links between a pair of factors: one for each direction.

![Creating and linking two nodes](/doc/images/create-link-nodes.gif)

* **Undo**. Reverses the last action (e.g. if you have just created a new factor, it will be removed).
* **Redo**. Redo the last action (e.g. if you have just undone the creation of a factor, this will return the factor to the network).
* **Bin**. First, select a factor or a link by clicking on it.  Note that the selected factor or link gains a shadow and is listed in the status bar at the bottom of the window. Then click on the Bin button - the factor or link is deleted.  The Undo button will restore it if you deleted it by mistake.
* **Share**. Shows a dialog box with a web link that you can copy and send to someone else.  If they then access that link, they will see your network and can edit and add to it. See [Sharing](#sharing) below.
* **Open file**. Read in a file containing a network from your computer drive.  See [below](#file-formats) for supported file formats.  The content of the file replaces the network in the browser.
* **Save file**.  Save the network in a file on your computer. The file is saved in the app's own format, or if you click on the small triangle next to the button, you can choose to save an image of the map as an a .PNG file, or the map data in GML (Graph Markup Language) or CSV (Comma Separated Values) formats.
* **Search**. Search for factors by name.
* **Help** Display this help page in a separate window.
* **Settings**. Opens a panel that allows much more customisation and exploration of the network (see [Styling the map](#styling-the-map) below).

To select a factor or a link, click on it. To select more than one, click on one factor or link and then *hold down* the pointer over the other.  Or you can hold down the control (CTRL) key and click  to add to the selection. At the bottom of the window is the status bar, which will show which factors and links have been selected. Clicking anywhere on the background will deselect the factors and links.

Also at the bottom of the window on the right is a slider that will adjust the magnification: slide to the right to make the factors and links larger and to the left to make them smaller (or click on the + and - signs).  To return the network to a size that will fit neatly in the window, double click anywhere on the network background.  On a tablet or phone, you can zoom by using the 'pinch' gesture.

Holding down the Shift key and then moving the mouse pointer will show a 'magnifying glass' with an enlarged view of the part of the map under the pointer.  You need to be using a keyboard for this.

Each factor can be moved across the network pane by selecting it and dragging.  The whole network can be moved by dragging the background.

### Notes

If you select just one factor or one link, a small panel appears.  This shows the factor or link label (if it has one), the time and date  when the factor or link was created, when it was last modifed if it has been changed since it was created, some network statistics about the factor, and an area where you can type a note to show further information about the factor or link.  For factors, there is also an open or closed padlock symbol. If this is shown closed, the factor will be locked into place on the network pane and cannot be dragged elsewhere.

If a factor or link has a note, a small 'scroll' icon is shown next to it.

<img src="/doc/images/FactorWithNote.png" width="400">

A basic editor is provided for writing the Notes.  You can format the text with **bold**, *italic* or <u>underline</u>, create bulletted or numbered lists, and add URLs to the text.

### Sharing

If you use the link above to start the app, a new room is created for you.  When you click on the share icon, a dialog box is shown that includes the name of the room in the link that is displayed:

![Sharing box](/doc/images/prsm-share.png)

Click the button to copy the web link to the clipboard, and then paste the link into an email or a text message. or just tell other participants the name of the room (which is a randomly generated set of 4 groups of three capital letters separated by hyphens).  When they access the link, they will see whatever is in your app window.

There are two options for the sharing link.  If you check the 'Clone map' box, the link will be to the map in a new room - any changes made to this new map will *not* happen in the original room.  If you click the 'View only' box, the recipient of the link will not be able to make any changes to the map.

### Avatars and pointers

When there are others in the room, the initial letters of their name appear in a circle at the top left - their *avatar*.  If you hover the mouse pointer over the circle, their full name is shown (their real name or the name they have been given by the app).  If they don't do anything for 15 minutes, the avatar fades and, if they close their browser window, it disappears.

The other users' mouse pointers are shown on the map.  As you move your mouse pointer (or finger on a touchscreen), a small disc containing your initials moves on every other users' map correspondingly.  If you are talking with other users by audio or video link, you can use your mouse to point to things of interest, and the other users can see what you are pointing at.

<!-- ![Avatars](/doc/images/avatars.png) -->
<img src="/doc/images/avatars.png" width="400">

You can 'follow' the mouse movements of another user by clicking on their avatar.  When you do that, if that user moves to another part of the map, your map moves too, following that user's mouse pointer.  This can be very helpful if the other user is showing you something on the map.  To stop following, just click anywhere on the map.

### Using the mouse and touch

You can use the following mouse actions (or finger or pencil gestures on a tablet):

* a *click* on a factor or a link will select it (the factor or link gains a shadow to show it has been selected, and a message appears in the status bar).  Selected factors can be moved by dragging them (hold down and then move the mouse ) and can be deleted (click on the dustbin icon in the navigation bar).
* a *long click* on a factor or link extends the selection: that factor or link is added to those already selected.
* a *control-click* (hold down the control key and click with the mouse) on a factor or link also extends the selection.
* a *double-click* on a factor or link opens an editing dialog so that you can edit its label, change colors and border widths etc. (see [Formatting factors and links](#formatting-factors-and-links)).
* a *click* on the background de-selects all factors and links.
* *dragging* the background moves the whole map.
* a *double-click* on the background zooms the whole map in or out so that it neatly fits the window.
* holding down the *shift* key and moving the mouse shows a loupe or magnifying glass to see small details of the map.
* holding down the *control* key and dragging shows a selection rectangle - when you release the mouse, all factors in the rectangle are selected.
* holding down the *option* or ALT key and clicking on the background is a shortcut for adding a new factor
* holding down the *option* or ALT key and clicking on a factor is a shortcut for adding a link - the pointer will becoem a cross and you can then drag from the factor to another factor to create the link.

### Copy and paste

You can copy selected factors to the clipboard and then paste them into either the same map (to duplicate them) or into another map in another browser window or tab.

To copy, first select the factors that you want copied (a long press on the factors).  Then hold down the Command or CTRL key and type C.  If you copy more than one factor, all the links that go between the selected factors get copied too.

If you want to copy these factors and links into a new map, open a new tab in your browser, go to [https://prsm.uk/prism.html](https://prsm.uk/prism.html), click on the map and type Command/CTRL P.  Or to duplicate the factors in the same map, just type Command/CTRL P.

### Formatting factors and links

Double clicking on a factor or a link will bring up a small dialog that enables you to change the design of the factor or link - its colour, shape or the label.

<!-- ![Editing a node](/doc/images/Editingnode.png) -->
<img src="/doc/images/Editingnode.png" width="400">

See [Styling the map](#styling-the-map) for more on changing the look of factors and links.

### The chat window

Clicking on the speech ballons at the bottom right opens up a chat window that you can use to type messages to other participants in your room.

<!-- ![Chat window](/doc/images/ChatWindow.png) -->
<img src="/doc/images/ChatWindow.png" width="400">

If you haven't provided your real name, the  name at the top is initially randomly generated, but if you click on it, you can substitute your own.  You can write messages in the box at the bottom and send them by clicking the paper plane button.  Use the **X** to close the chat window.

You can choose to send your messages either to everyone or to one selected person (from among those online).

If someone has sent you a message but your chat window is closed, the button will gently pulse to remind you to open it:

![Chat Window Button](/doc/images/ChatWindowButton.gif)

### File formats

The app can read files in its native format (files with the suffix '.prsm'), or in [GRAPHML](http://graphml.graphdrawing.org/) (.graphml), [GML](https://en.wikipedia.org/wiki/Graph_Modelling_Language) (.gml) or [Comma Separated Values](https://en.wikipedia.org/wiki/Comma-separated_values) (.csv) formats.  A CSV file must contain a two columns of values.  Each row represents a link. In the first column is the label of the factor from which the link points, and in the second column is the label of the factor the link is pointing to.  This very simple format is designed to allow straightforward imports from other software. Optionally, the third and fourth columns may contain an integer between 1 and 9 - if they do, the factor is styled with that style (styles are numbered from top left to bottom right as shown on the [Factors tab](#factors-tab)).  The fifth column may contain the style number for the link.

The app can create output files in the app's own native format, as a GML file or as a CSV file.  You can also save an image of the map as a Portable Network Graphics (.png) file.  The image shows the same view of the map as you see on the screen (so, for example, it will not show factors that have been moved out of the app window).

### Privacy and security

The only way to join the room and see the network is by using the randomly generated room name, and the chances of finding that name by trial and error is very, very small.  The network is not stored on any server (there is a central server, but this is only used to broadcast encoded messages from one participant in a room to another).  The server is located in Europe.

## Styling the map

The view you see when you first open the app is intentionally very simple, but hidden away are many more features.  To access these, click on the last, Settings, button on the top bar: <!-- ![Settings Button](/doc/images/SettingsButton.png) --><img src="/doc/images/SettingsButton.png" style="display: inline" width="20">.  This will reveal a set of three tabs: Network, Factors and Links, with the Factors tab open.

The panel showing the tabs can moved across the network pane: drag it using the thin black strip at the top of the panel.  This can be useful if the panel gets in the way of seeing the network.

### Factors tab

<!-- ![FactorsWindow](/doc/images/FactorsPanel.png) -->
<img src="/doc/images/FactorsPanel.png" width="250">

There are 9 sample styles for how factors can look.  If you select a factor from the network and then click on one of the 9 styles, the factor will change to resemble the style.  As a short cut, if you click on the 'Select all factors' button at the bottom, and then click on a style, all the factors will change to the chosen style.

Double clicking on any of the 9 styles opens a dialog box to change the style:

<!-- ![FactorStyleDialog](/doc/images/FactorStyle.png) -->
<img src="/doc/images/FactorsStyle.png" width="600">

There are options to change the colour of the background (the 'fill'), the border and the font of the label, to change the shape, for example to a rectangle or a circle, to change the border from solid to dashed or dotted or none, and to change the font size of the label.

If you right click on one of the style samples, there is a menu with which you can either select all the Factors that have that style, or hide all those Factors from view.

#### Legend

You can also change the name of the style.  If you do so, this name will appear on the network pane as one item in the 'legend'.  So, for example, if you had some factors that are Activities, some that are Change mechanisms, some Outcomes and some Impacts, you could give four of the styles these names, colour their fills red, orange, yellow and blue, and then apply these styles to the appropriate factors in the network.  The legend will be automatically displayed on the network pane:

![Legend](/doc/images/Legend.png)

The legend can be moved by dragging the top of the Legend pane.

### Links tab

The Links tab is very similar to the Factors tab, except that it relates to the links.  There are 9 link styles and each of these can be changed by double clicking the link style. There are options to change the colour of the link, whether it has an arrow at the end, whether it is solid, dashed or dotted, and to add a  link label.

<!-- ![LinksPanel](/doc/images/LinksPanel.png) -->
<img src="/doc/images/LinksPanel.png" width="250">

### Network tab

The Network tab enables you to change many aspects of the network visualisation, including where the Factors are placed and which are visible.  

It is sometimes useful to get PSRM to layout Factors using an automatic procedure and then adjust their positions manually to achieve the desired placement.  PRSM has the *trophic* algorithm built in. The trophic layout  helps to reveal [the causal structure of the map](https://royalsocietypublishing.org/doi/10.1098/rsos.201138). With the trophic layout, the factors are arranged along the horizontal axis according to their positions (their trophic levels) in the overall causal flow within the system, making it easier to identify upstream and downstream factors; the linked chains of influence that connect them; and where policies act on the system within this overall causal structure (which may be upstream or downstream).

On the Network tab, there are controls for:

<!-- ![NetworkPanel](/doc/images/NetworkPanel.png) -->
<img src="/doc/images/NetworkPanel.png" width="250">

* **Trophic Layout** If this switch is set to ON, the app moves the factors and links to create a layout such that all the links point from left to right and are arranged accoriding to [trophic level](https://en.wikipedia.org/wiki/Trophic_level). Clicking the Trophic Layout button will re-arrange the factors, and you can then adjust the map manually to a neat and pleasing layout.  If you don't like the result, the Undo button on the top bar will revert the map to its original layout.
* **Snap to grid**  When ON, factors shift to be at the intersection of invisible grid lines.  This makes it much easier to line up factors neatly.
* **Link** Links can either be drawn using a curved line or a straight line.  This control swaps between these two styles.
* **Background** Changes the colour of the background of the network pane.  Click on the colour well to display possible colours.  The default is white, but a black background can also be effective.
* **Show legend** If the factor and link styles are given names (other than 'Sample'), the styles and their names will be shown in a panel at the left bottom of the network pane headed 'Legend', when this switch is ON.  See the description of the [Factors tab](#factors-tab).
* **Show drawing layer** Puts the network pane into drawing mode, so that background shapes, images and text can be added.  See [Drawing Mode](#drawing-mode) for more details.
* **Show other users** When ON, the positions of other users' mouse pointers are shown in real time.  
* **Show history** When ON, a panel displaying every change to a factor or link (adding a factor or link, editing it or deleting it) is shown.
* **Show only neighbouring Factors** If you first select a Factor, (or several Factors) and then one of these buttons, all Factors in the network will be hidden, except for those 1, 2, or 3 links away from the selected Factor(s).  This is useful when one wants to focus on one part of a large network.
* **Show only up or downstream Factors**  If you first select a Factor, (or several Factors) and then one of these buttons, all Factors in the network will be hidden, except for those 'downstream' (i.e. linked to the selected Factor(s) by following links directed away from those Factor(s)), or those 'upstream' (i.e. linked to the selected Factor(s) by following links directed towards those Factor(s)).
* **Size Factors to** This is used to change the size of the Factors to be proportional to one of a set of metrics: the number of inputs (the 'in-degree'), the number of outputs (the 'out-degree'), the leverage (ratio of inputs to outputs), or the [betweenness centrality](https://en.wikipedia.org/wiki/Betweenness_centrality).  Note that the Factors are always drawn large enough to accommodate their labels, and so the size may not be exactly proportional to the metric.

## Drawing Mode

Switching 'Show drawing layer' ON reveals a group of buttons on the left that enable you to draw shapes, write text, and import images onto the network background.  

![Drawing layer](/doc/images/drawingLayer.png)

In drawing mode, the background has a faint square grid to help line up your drawing.  When you draw, you are 'painting' on the background, which means that the shapes and text you apply can only be moved by erasing them and redrawing.

When you click on a drawing button, a small dialog box appears that can be used to adjust the drawing tool. For instance, the Line tool, which draws straight lines, has options for the line thickness and line colour.

To stop using a tool, either click on another one, or click a second time on that tool's button.

The drawing tools are, in order from top to bottom:

* **Line** draws straight lines.  There are options for the line width, the colour of the line, and whether the line must be along the axes, i.e. either horizontal or vertical.  To use the tool, click on the background at the desired start position, drag across to the line end and lift the mouse pointer.
* **Rectangle** The options are the width of the border around the rectangle and its colour, the colour of the inside of the rectangle (the 'fill' colour) and whether it should have rounded or sharp corners.  To draw a rectangle, click where one corner should be,  then drag out to where the opposite corner should be and lift the pointer.
* **Text**  Use this tool to add fixed text to the background. The options are the colour and size of the text.  Click on the background to show a text box into which you can type.  You can move the box by dragging on the grey border and expand it by dragging the black square at the bottom right corner.  Click anywhere outside the box to finish.
* **Pencil** draws freehand lines.
* **Marker** draws lines like a marker or highlighter pen.
* **Eraser** removes everything it passes over.
* **Image** Clicking on this tool gives you a file chooser to select an image file (picture) from your computer - JPG, PNG and GIF formats are accepted. When the image has been placed on the background, you can drag it to where you want it, and resize it by dragging on the small black square at the bottom right.  Click anywhere outside the image to fix it to the background.
* **Undo** This tool will undo the effect of the last drawing (e.g. if you have just placed an image on the background, it will remove the image, or if you have drawn a line with the pencil, it will undo that line).  Each click of the Undo button removes the previous drawing.

## Analysis

Once you have a map, you may want to examine it for themes and patterns. This is easiest if you examine portions of the map, or 'sub-maps', one at a time.  As  Barbrook-Johnson and Penn explain ([Barbrook-Johnson, P., & Penn, A. (2021). Participatory systems mapping for complex energy policy evaluation. Evaluation, 27(1), 57–79.](https://doi.org/10.1177/1356389020976153)), network analysis can be combined with subjective information to answer a range of questions, as indicated in the table below.

<table class="analysis">
<thead>
<tr class="header">
<th><strong>Way to start</strong></th>
<th><strong>Starting point options</strong></th>
<th><strong>How to build</strong></th>
<th><strong>Interpretation</strong></th>
<th><strong>How to do it with PRSM</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td rowspan="9"><strong>Stakeholder-suggested factors</strong></td>
<td rowspan="3">Intervention or controllable factors</td>
<td>Downstream factors and edges</td>
<td>What is the intervention or controllable factor affecting? Unexpected indirect effects?</td>
<td>Select the intervention factor and choose ‘Show only Factors downstream’</td>
</tr>
<tr class="even">
<td>For multiple factors create a union or intersection of multiple downstream submaps</td>
<td>How are multiple interventions complementing or clashing with each other?</td>
<td>Select all the interventions and choose ‘Show only Factors downstream’</td>
</tr>
<tr class="odd">
<td>Paths between intervention factors and outcome factors, including ego networks of factors on paths</td>
<td>What does the intervention rely on to achieve its goals? What wider context might affect it?</td>
<td>Select all the factors on the path(s) between the intervention(s) and the outcomes(s), and choose ‘Show only Factors 1 link away’ (or 2 or 3 links away)</td>
</tr>
<tr class="even">
<td rowspan="4">Important or outcome factors</td>
<td>Upstream factors and edges</td>
<td>What is influencing the thing we care about? Constraints? Control? Buffered or buffeted?</td>
<td>Select the intervention factor and choose ‘Show only Factors upstream’</td>
</tr>
<tr class="odd">
<td>For multiple factors create a union or intersection of ego networks. Or, pull out paths between outcomes.</td>
<td>What trade-offs or synergies might there be between achieving the things we care about?</td>
<td>Select all the interventions and choose ‘Show only Factors upstream’</td>
</tr>
<tr class="even">
<td><p>Ego networks</p>
<p> </p></td>
<td>What is influencing the thing we care about, what does it influence and how do those things interact?</td>
<td>Select the factor and choose ‘Show only Factors 1 link away’ (or 2 or 3 links away)</td>
</tr>
<tr class="odd">
<td>Union or intersection of upstream factors and edges</td>
<td>What factors influence multiple outcomes? Identify potential levers in the system, co-benefits, synergies, or risks.</td>
<td>Select all the outcome factors and choose ‘Show only Factors upstream’</td>
</tr>
<tr class="even">
<td rowspan="2">Vulnerable to change factors</td>
<td>Up and/or downstream factors and edges</td>
<td>What might mitigate change in this factor? What impact might change have?</td>
<td>Select one or more factors and choose ‘Show only Factors 1 link away’ (or 2 or 3 links away)</td>
</tr>
<tr class="odd">
<td>Union/intersection multiple downstream sub maps</td>
<td>Are there compound risks, how might interventions interact with external change?</td>
<td>Select factors and choose ‘Show only Factors downstream’</td>
</tr>
<tr class="even">
<td rowspan="5"><strong>System-suggested factors</strong></td>
<td>Influential (i.e. many outgoing connections)</td>
<td>Downstream factors and edges</td>
<td>What is this influential thing affecting? Vulnerability or lever?</td>
<td>First, set ‘Size Factors to: Outputs’ to see which factors have many outgoing connections. Then select an influential factor and choose ‘Show only Factors downstream’.</td>
</tr>
<tr class="odd">
<td rowspan="2">Central to the map (i.e. well-connected, or bridging)</td>
<td>Downstream and/or upstream factors and edges</td>
<td>What is influencing this central factor? What influence does it have? Bottleneck, bridge, transmitter?</td>
<td>First, set ‘Size Factors to: Centrality’ to see which factors are central. Then select a central factor and choose ‘Show only Factors upstream’.</td>
</tr>
<tr class="even">
<td>Ego networks</td>
<td>What does this factor bridge or connect?</td>
<td>First, set ‘Size Factors to: Centrality’ to see which factors are central. Then select a central factor and choose ‘Show only Factors 1 link away’.</td>
</tr>
<tr class="odd">
<td>Influenced (i.e. many incoming connections)</td>
<td>Upstream factors and edges</td>
<td>What is influencing this highly influenced factor? Buffered or buffeted?</td>
<td>First, set ‘Size Factors to: Inputs’ to see which factors have many incoming connections. Then select a factor and choose ‘Show only Factors upstream'.</td>
</tr>
<tr class="even">
<td>Unusual network property</td>
<td>Any of the above</td>
<td>Does this factor play an important but counter-intuitive role in the system? </td>
<td>Set ‘Size Factors to: Leverage’ to see which factors have either many incoming but few outgoing connections or few outgoing but many incoming connections.</td>
</tr>
</tbody>
</table>
With thanks to Alex Penn and Pete Barbrook-Johnson for the original of this table.

## Data View

## Source Code

*(The following is intended for developers who want to extend PRSM)*

The program code is available on [GitHub](https://github.com/micrology/prsm).  

The javascript (ES6) code in sub-directory ```js``` is divided into five modules: one that handles the main network pane (```prsm.js```), one that manages the background painting functions (```paint.js```), one that creates and edits the styles (```styles.js```) (the default styles are in ```samples.js```), one that handles the tour (```tutorial.js```) and one that includes common utility functions (```utils.js```).  The HTML file that displays in the browser is in the ```html``` directory.

PRSM uses two important packages: [```yjs```](https://github.com/yjs/yjs) and [```vis-network```](https://visjs.org/).  The former handles the sharing between participants' browsers and the latter draws the network. A few other packages are used for dealing with touch input ([```Hammer```](https://hammerjs.github.io/)), drawing emojis, and parsing XML file input.  

These components are assembled using [```parcel```](https://parceljs.org/) and the bundled file is placed in the ```dist``` directory.  So that users have an easy URL to access (i.e. not needing to include ```dist``` in the link), there is an ```.htaccess``` file that rewrites URLs from what the user puts into their browser to the correct location.

To install the code, use ```git``` to clone the [repo](https://github.com/micrology/prsm) to your local disk and change to the cloned directory.  Then install the required packages with

```bash
npm install
```

and build the distribution with

```bash
npm run build
```

Documentation can be found in the ```doc``` directory.

See ```package.json``` for other npm commands.

## Acknowledgements

With thanks to all who helped inspire, suggest features for, comment on, and test PRSM, including the members of [CECAN](https://www.cecan.ac.uk/), [CRESS](https://cress.soc.surrey.ac.uk/), [Risk Solutions](https://www.risksol.co.uk/), and Robin Gilbert.

## Bug reports and feature requests

Please report problems, suggestions and praise to [nigel@prsm.uk](mailto:nigel@prsm.uk)

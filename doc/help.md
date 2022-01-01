<!-- markdownlint-disable-file MD026 MD033 MD036-->
# Participatory System Mapper

## What is it?

The Participatory System Mapper (PRSM for short) is a web app that makes it easy for a group of people working together to draw networks (or 'maps') of systems.  

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

The software is aimed at people who are interested in understanding whole systems.  [Wikipedia](https://en.wikipedia.org/wiki/System){target="_blank"} defines a system as a group of interacting or interrelated entities that form a unified whole.

### Participatory system mapping

The app is designed to enable groups of people, each using their own computer (or tablet) to collaborate in the drawing of a map.  They may be sitting around a table, discussing the map as it is created face to face, or working remotely, using video conferencing or the chat feature that is built into the app.  Everyone can participate because every edit (creating nodes and links, arranging them and so on) is broadcast to all the other participants as the changes are made (just as Google Docs does for text, for example).  

When you start the app in your browser, a 'room' is created for you in which to draw your network.  You can add other users to this room to share the work.  Only those with access to the room can see what is being created.

## Examples

Here are a few examples of what you can do with the app:

The first is a theory of change adapted from an [NPC report](https://www.thinknpc.org/resource-hub/ten-steps/){target="_blank"}.

![NCP Example](/doc/images/NPCexample.png)

The second is a system map about the environmental impact of goods transport developed by a small group of experts working together using the app.

![SCandL Example](/doc/images/SCandLexample.png)

The third is a large network of 736 nodes and about 9000 links representing the team members playing in the 2019 football World Cup.

![World Cup 2019 Example](/doc/images/WorldCup2019example.png)

## Installation

No installation on your computer is needed.  The software is a web app, which means that it can be accessed using a web browser by pasting this link into the address bar:

[https://prsm.uk/prsm.html](https://prsm.uk/prsm.html){target="_blank"}

You need a modern web browser such as Chrome, Firefox, Microsoft Edge or Safari.  It will not work with Internet Explorer.

The software is free and available under an [MIT](https://choosealicense.com/licenses/mit/){target="_blank"} license.

## Basic use

When the app is started for the first time in your browser, there is an option to type in your name and then to follow a brief tour that shows you the main items on the web page.  

![Nav Bar icons](/doc/images/start-screen.png)

This introductory tour is only shown the very first time you use PRSM.  If you want to view the tour again, click <button onclick="localStorage.setItem('doneIntro', 'false'); return false">here</button>.

At the top of the screen are a row of buttons.
<!-- ![Nav Bar icons](/doc/images/prsm-nav-icons.png)-->
<img src="/doc/images/Buttons.png" width="400">

This what they do, from left to right:

* **New factor** (or node).  Click on the cross and then click somewhere on the blank area below (the 'network pane') to create a node for the network.  A small dialog box will open for you to type in a label for the factor.
* **New link** (or edge). Click on the arrow button and then drag from one factor to another to link them. If you wish, you can have two links between a pair of factors: one for each direction.

<p style="text-align: center"><video width="640" height="360" autoplay muted loop><source src="/doc/images/create-link-nodes.mp4" type="video/mp4">Your browser does not support the video tag.</video></p>

* **Undo**. Reverses the last action (e.g. if you have just created a new factor, it will be removed).  See also using rollback from the History window, described in the section about the [Network Tab](#network-tab).
* **Redo**. Redo the last action (e.g. if you have just undone the creation of a factor, this will return the factor to the network).
* **Bin**. First, select a factor or a link by clicking on it.  Note that the selected factor or link gains a shadow and is listed in the status bar at the bottom of the window. Then click on the Bin button - the factor or link is deleted.  The Undo button will restore it if you deleted it by mistake.
* **Share**. Shows a dialog box with a web link that you can copy and send to someone else.  If they then access that link, they will see your network and can edit and add to it. See [Sharing](#sharing) below.
* **Open file**. Read in a file containing a network from your computer drive.  See [below](#file-formats) for supported file formats.  The content of the file replaces the network in the browser.
* **Save file**.  Save the network in a file on your computer. The file is saved in the app's own format, or if you click on the small triangle next to the button, you can choose to save an image of the map as a high resolution image (a .PNG file), or the map data in GML (Graph Markup Language) or CSV (Comma Separated Values) formats.
* **Search**. Search for factors by name.
* **Help** Display this help page in a separate window.
* **Settings**. Opens a panel that allows much more customisation and exploration of the network (see [Styling the map](#styling-the-map) and [Analysing the map](#analysing-the-map) below).

To **select** a factor or a link, click on it. To select more than one, click on one factor or link and then *hold down* the pointer on the other.  Or you can hold down the control (CTRL) key and click to add to the selection. At the bottom of the window is the status bar that will show which factors and links have been selected. Clicking anywhere on the background will deselect all the factors and links.

Each factor can be moved across the network pane by dragging it.  The whole network can be moved by dragging the background.

Also at the bottom of the window on the right is a slider that will adjust the **magnification**: slide to the right to make the factors and links larger and to the left to make them smaller (or click on the + and - signs).  To return the network to a size that will fit neatly in the window, double click on the black bar at the top, or anywhere on the network background (the latter will also desleect any selected factors or links).  On a tablet or phone, you can zoom by using the 'pinch' gesture.

At the top left, you can enter a **title** for the  map.  Click on 'Untitled map' and type in your title. If you have created or used several maps (and they have titles), a small downward triangle will appear to the right of the title.  Clicking on this shows a list of those previous maps, and clicking on one of those takes you away from the current map and loads the previous one (after you have confirmed that this is what you want to do).

Holding down the Shift key and then moving the mouse pointer will show a **magnifying glass** with an enlarged view of the part of the map under the pointer.  You need to be using a keyboard for this.

### Notes

If you select just one factor or one link, a small panel appears.  This shows the factor or link label (if it has one), the time and date  when the factor or link was created, when it was last modifed if it has been changed since it was created, some network statistics about the factor, and an area where you can type a note to show further information about the factor or link.  For factors, there is also an open or closed padlock symbol. If this is shown closed, the factor will be locked into place on the network pane and cannot be dragged elsewhere.

If a factor or link has a note, a small 'scroll' icon is shown next to it.

<img src="/doc/images/FactorWithNote.png" width="500">

A basic editor is provided for writing the Notes.  You can format the text with **bold**, *italic* or <u>underline</u>, create bulletted or numbered lists, and add weblinks (URLs) to the text.

### Sharing

If you use the [link above](#Installation) to start the app, a new room is created for you.  When you click on the share icon, a dialog box is shown that includes the name of the room in the link that is displayed:

![Sharing box](/doc/images/prsm-share.png)

Click the 'Copy to clipboard' button to copy the web link to the clipboard, and then paste the link into an email or a text message or just tell other participants the name of the room (which is a randomly generated set of 4 groups of three letters separated by hyphens).  When they access the link, they will see whatever is in your app window.

There are three options for the sharing link.  If you check the 'Clone map' box, the web link will be to the same map but in a new room - any changes made to this new map will *not* appear in the original room.  If you check the 'View only' box, the recipient of the web link will not be able to make any changes to the map.  If you check the Data view box, the web link will be a a spreadsheet-like view of the facors and links in the map (see the [section on the Data view](#data-view)).

### Avatars and pointers

When there are others in the room, the initial letters of their name appear in a circle at the top left - their *avatar*.  If you hover the mouse pointer over the circle, their full name is shown (their real name or the name they have been given by the app).  If they don't do anything for 15 minutes, the avatar fades and, if they close their browser window, it disappears.

The other users' mouse pointers are shown on the map.  As you move your mouse pointer (or finger on a touchscreen), a small disc containing your initials moves on every other users' map correspondingly.  If you are talking with other users by audio or video link, you can use your mouse to point to things of interest, and the other users can see what you are pointing at.

<!-- ![Avatars](/doc/images/avatars.png) -->
<img src="/doc/images/avatars.png" width="400">

You can 'follow' the mouse movements of another user by clicking on their avatar.  When you do that, if that user moves to another part of the map, your map moves too, following that user's mouse pointer.  This can be very helpful if the other user is showing you something on the map.  To stop following, just click anywhere on the map.

### Using the mouse and touch

You can use the following mouse actions (or finger or pencil gestures on a tablet):

* a *click* on a factor or a link will select it (the factor or link gains a shadow to show it has been selected, and a message appears in the status bar).  Selected factors can be moved by dragging them (hold down and then move the mouse ) and can be deleted (click on the dustbin/trash can icon in the navigation bar).
* a *long click* on a factor or link extends the selection: that factor or link is added to those already selected.
* a *control-click* (hold down the control key and click with the mouse) on a factor or link also extends the selection.
* a *double-click* on a factor or link opens an editing dialog so that you can edit its label, change colors and border widths etc. (see [Formatting factors and links](#formatting-factors-and-links)).
* a *click* on the background de-selects all factors and links.
* *dragging* the background moves the whole map.
* a *double-click* on the background zooms the whole map in or out so that it neatly fits the window.  Any selected factors or links are de-selected.
* holding down the *shift* key and moving the mouse shows a loupe (a magnifying glass) to see small details of the map.
* holding down the *control* key and dragging shows a selection rectangle - when you release the mouse, all factors in the rectangle are selected.
* holding down the *option* or ALT key and clicking on the background is a shortcut for adding a new factor
* holding down the *option* or ALT key and clicking on a factor is a shortcut for adding a link - the pointer will become a cross and you can then drag from the factor to another factor to create the link.

### Copy and paste

You can copy selected factors to the clipboard and then paste them into either the same map (to duplicate them) or into another map in another browser window or tab.

To copy, first select the factors that you want copied (a long press on the factors).  Then hold down the Command &#8984; or
CTRL &#8963;key and type C.  If you copy more than one factor, all the links that go between the selected factors get copied too.

If you want to copy these factors and links into a new map, open a new tab in your browser, go to [https://prsm.uk/prsm.html](https://prsm.uk/prsm.html){target="_blank"}, click on the map and type &#8984;V or &#8963;V.  Or to duplicate the factors in the same map, just type &#8984;V or &#8963;V.

### Formatting factors and links

Double clicking on a factor or a link will bring up a small dialog that enables you to change the design of the factor or link - its colour, shape or the label.

<!-- ![Editing a node](/doc/images/Editingnode.png) -->
<img src="/doc/images/Editingnode.png" width="400">

See [Styling the map](#styling-the-map) for more on changing the look of factors and links.

### The chat window

Clicking on the speech balloon at the bottom right opens up a chat window that you can use to type messages to other participants in your room.

<!-- ![Chat window](/doc/images/ChatWindow.png) -->
<img src="/doc/images/ChatWindow.png" width="300">

If you haven't provided your real name, the  name at the top is initially randomly generated, but if you click on it, you can substitute your own.  You can write messages in the box at the bottom and send them by clicking the paper plane button.  Use the **X** to close the chat window.

You can choose to send your messages either to everyone or to one selected person (from among those online).

If someone has sent you a message but your chat window is closed, the button will gently pulse to remind you to open it:

![Chat Window Button](/doc/images/ChatWindowButton.gif)

### File formats

The app can read files in its native format (files with the suffix '.prsm'), or in [GRAPHML](http://graphml.graphdrawing.org/){target="_blank"} (.graphml), [GML](https://en.wikipedia.org/wiki/Graph_Modelling_Language){target="_blank"} (.gml) or [Comma Separated Values (CSV)](https://en.wikipedia.org/wiki/Comma-separated_values){target="_blank"} (.csv) formats.  A CSV file must contain at least two columns of values.  Each row represents a link. In the first column is the label of the factor from which the link points, and in the second column is the label of the factor the link is pointing to.  This very simple format is designed to allow straightforward imports from other software. Optionally, the third and fourth columns may contain an integer between 1 and 9 - if they do, the factor is styled with that style (styles are numbered from top left to bottom right as shown on the [Factors tab](#factors-tab)).  The fifth column may contain the style number for the link.

The app can create output files in the app's own native format, as a GML file or as a CSV file.  You can also save an image of the map as a Portable Network Graphics (.png) file.  The image shows the same view of the map as you see on the screen (so, for example, it will not show factors that have been moved out of the app window).

### Privacy and security

The only way to join the room and see the network is by using the randomly generated room name, and the chances of finding that name by trial and error is very, very small.  The network data are stored on a central server in encoded form.  The server is located in Europe.

## Styling the map

fourThe view you see when you first open the app is intentionally very simple, but hidden away are many more features.  To access these, click on the last, Settings, button on the top bar: <!-- ![Settings Button](/doc/images/SettingsButton.png) --><img src="/doc/images/SettingsButton.png" style="display: inline" width="20">.  This will reveal a set of four tabs: Factors, Links, Netork and Analysis, with the Factors tab open.

The panel showing the tabs can moved across the network pane: drag it using the thin black strip at the top of the panel above the tab buttons.  This can be useful if the panel gets in the way of seeing the network.

### Factors tab

<!-- ![FactorsWindow](/doc/images/FactorsPanel.png) -->
<img src="/doc/images/FactorsPanel.png" width="250">

There are 9 sample styles for how factors can look.  If you select a factor from the network and then click on one of the 9 styles, the factor will change to resemble the style.  As a short cut, if you click on the 'Select all factors' button at the bottom, and then click on a style, all the factors will change to the chosen style.

Double clicking on any of the 9 styles opens a dialog box to change the style:

<!-- ![FactorStyleDialog](/doc/images/FactorStyle.png) -->
<img src="/doc/images/FactorsStyle.png" width="600">

There are options to change the colour of the background (the 'fill'), the border and the font, to change the shape, for example to a rectangle or a circle, to change the border from solid to dashed or dotted or none, and to change the font size of the label.

If you right click (or Control click) on one of the style samples, there is a menu with which you can either select all the Factors that have that style, or hide all those Factors from view.

#### Legend

You can also change the name of the style.  If you do so, this name will appear on the network pane as one item in the 'legend'.  So, for example, if you had some factors that are Activities, some that are Change mechanisms, some Outcomes and some Impacts, you could give four of the styles these names, colour their fills red, orange, yellow and blue, and then apply these styles to the appropriate factors in the network.  The legend will be automatically displayed on the network pane:

![Legend](/doc/images/Legend.png)

The legend can be moved by dragging the top of the Legend pane.

### Links tab

The Links tab is very similar to the Factors tab, except that it relates to the links.  There are 9 link styles and each of these can be changed by double clicking the link style. There are options to change the colour of the link, whether it has an arrow at the end, whether it is solid, dashed or dotted, and to add a  link label.

<!-- ![LinksPanel](/doc/images/LinksPanel.png) -->
<img src="/doc/images/LinksPanel.png" width="250">

### Network tab

The Network tab enables you to change many aspects of the network visualisation andwhat is shown in the window.  

It is sometimes useful to get PSRM to layout Factors using an automatic procedure and then adjust their positions manually to achieve the desired placement.  PRSM has the *trophic* algorithm built in. The trophic layout  helps to reveal [the causal structure of the map](https://royalsocietypublishing.org/doi/10.1098/rsos.201138){target="_blank"}. With the trophic layout, the factors are arranged along the horizontal axis according to their positions (their trophic levels) in the overall causal flow within the system, making it easier to identify upstream and downstream factors; the linked chains of influence that connect them; and where policies act on the system within this overall causal structure (which may be upstream or downstream).

On the Network tab, there are controls for:

<!-- ![NetworkPanel](/doc/images/NetworkPanel.png) -->
<img src="/doc/images/NetworkPanel.png" width="250">

* **Trophic Layout** Clicking the Trophic Layout button will re-arrange the factors and links to create a layout such that all the links point from left to right and are arranged accoriding to [trophic level](https://en.wikipedia.org/wiki/Trophic_level){target="_blank"}. You can then adjust the map manually to a neat and pleasing layout.  If you don't like the result, the Undo button on the top bar will revert the map to its original layout.
* **Snap to grid**  When ON, factors shift to be at the intersection of invisible grid lines.  This makes it much easier to line up factors neatly.
* **Link** Links can either be drawn using a curved line or a straight line.  This control swaps between the two.
* **Background** This changes the colour of the background of the network pane.  Click on the colour well to display possible colours.  The default is white, but a black background can also be effective.
* **Show legend** If the factor and link styles are given names (other than 'Sample'), the styles and their names will be shown in a panel at the left bottom of the network pane headed 'Legend', when this switch is ON.  See the description of the [Factors tab](#factors-tab).
* **Show drawing layer** Puts the network pane into drawing mode, so that background shapes, images and text can be added.  See [Drawing Mode](#drawing-mode) for more details.
* **Show other users** When ON, the positions of other users' mouse pointers are shown in real time.  
* **Show history** When ON, a panel displaying every change to a factor or link (adding a factor or link, editing it or deleting it) is shown. It is possible to 'rollback' the map to the state it was in before a change.  This can be quicker than repeatedly undoing changes with the Undo button.  To rollback, click on the [SYMBOL].  You will be asked to confirm the action.
* **Show notes** When a factor or link is selected, normally a Notes panel pops up at the bottom right of the map.  Turning this switch OFF prevents the Notes panels from being displayed.

### Analysis tab

The Analysis tab allows you to view portions of the map and to cluster Factors to help with the analysis of the network (see the [Analysis](#analysis) section below for help on how this can be useful).

<img src="/doc/images/AnalysisPanel.png" width="250">

The panel is divided into five sections:

* **Show only neighbouring Factors** If you first select a Factor (or several Factors) and then one of these options, all Factors in the network will be hidden, except for those 1, 2, or 3 links away from the selected Factor(s).  This is useful when you want to focus on just one part of a large network.
* **Show only up or downstream Factors**  If you first select a Factor (or several Factors) and then one of these options, all Factors in the network will be hidden, except for those 'downstream' (i.e. linked to the selected Factor(s) by following links directed *away* from those Factor(s)), or those 'upstream' (i.e. linked to the selected Factor(s) by following links directed *towards* those Factor(s)).
* **Show paths between** If you first select at least two Factors, and then the **Show all paths between** option, only those links that lie on a path between the selected Factors will be shown.  A 'path' is a set of links that, following the direction of the arrows, connects two Factors.  There may be several ways of getting from one Factor to another; if so, all the paths are shown.  All Factors that do not lie on the connecting paths are hidden. Selecting the **Show shortest path between** option displays only the path with the fewest links between the selected Factors. For both these options, all the selected Factors in turn are used as the starting point for the paths, and all other Factors are used as the end points.  For example, if Factors A, B and C are selected, paths from A to B, A, to C, B to A, B to C , C to A and C to B will be shown (if they exist).  This has the incidental use of identifying 'loops' that could indicate feedbacks.  If there is a path from A to B *and* a path from B to A, the effect of A on B will feedback on A.

Here is an example.  The first is the original network.
<img src="/doc/images/ShowAll.png" width="250">
The second is the same network with Show all paths between Factors 1 and 7.
<img src="/doc/images/ShowAllPaths.png" width="250">
The third is the same network with Show the shortest path between Factors 1 and 7.
<img src="/doc/images/ShowShortestPath.png" width="250">

The above three options can be combined.  For example, the shortest path between two Factors option may display two paths: one with a couple of links and another feedback path going in the reverse direction that winds around the map and includes many links.  Because it consists of many links, the latter path may not be of much interest.  Choosing both Shortest path and Show Factors only 2 links away will display just the direct path.

* **Size Factors to** This is used to change the size of the Factors to be proportional to one of a set of metrics: the number of inputs (the 'in-degree'), the number of outputs (the 'out-degree'), the leverage (ratio of inputs to outputs), or the [betweenness centrality](https://en.wikipedia.org/wiki/Betweenness_centrality){target="_blank"}.  Note that the Factors are always drawn large enough to accommodate their labels, and so the size may not be exactly proportional to the metric.  The  values of these metrics for a Factor are shown in its Notes panel.
* **Cluster** With large maps, it is sometimes useful to aggregate Factors into groups, thus displaying the map at a higher level of abstraction. For example, all the Factors relating to the effect of climate change might be replaced on the map by one 'Climate Change Cluster' Factor, and similarly, all the Factors concerned with transport replaced by one Transport Factor. Links that used to go to Factors outside the cluster are replaced by links that go to the new Cluster Factor (and likewise for links that go from the clustered Factors to Factors outside the cluster).

  For example, here is a simple map before clustering:

  <img src="/doc/images/BeforeClustering.png" width="600">

  and here is the same map afterclustering by Style:

   <img src="/doc/images/Clustered.png" width="600">

  Links to and from cluster Factors are labelled with the number of links that they aggregate.

  Clustering is done according to the values of  a clustering attribute - all Factors with the same value for this attribute are joined into the same cluster.  The Cluster pulldown menu offers as standard, Style (i.e. the Factors' style as set in the Factor tab) and Colour (i.e. the colour of the Factors' backgrounds) as possible attributes with which to cluster.  In addition, bespoke attributes can be used by creating a new column in the Data View and giving each Factor a value there (see the section on the [Data View](#data-view) for how to create attributes).  These additional atributes are automatically added to Cluster pull-down menu when they are created.

  Once the map has been clustered, a cluster Factor can be 'unclustered' (its component Factors revealed) by right (Control) clicking it, and reclustered by right (Control) clicking any of the component Factors.  To uncluster the map as a whole, select None from the Cluster pull-down menu.

## Drawing Mode

Switching 'Show drawing layer' ON reveals a group of buttons on the left that enable you to draw shapes, write text, and import images onto the network background.  

![Drawing layer](/doc/images/drawingLayer.png)

In drawing mode, the background has a faint square grid to help line up your drawing.  When you draw, you are 'painting' on the background, which means that the shapes and text you apply can only be moved by erasing them and redrawing.

When you click on a drawing button, a small dialog box appears that can be used to adjust the drawing tool. For instance, the Line tool, which draws straight lines, has options for the line thickness and line colour.

To stop using a tool, either click on another one, or click a second time on that tool's button.

The drawing tools are, in order from top to bottom:

* **Line** draws straight lines.  There are options for the line width, the colour of the line, and whether the line must be along the axes, i.e. either horizontal or vertical.  To use the tool, click on the background at the desired start position, drag across to the line end and lift the mouse pointer.
* **Rectangle** The options are the width of the border around the rectangle and its colour, the colour of the inside of the rectangle (the 'fill' colour) and whether it should have rounded or sharp corners.  To draw a rectangle, click where one corner should be, then drag out to where the opposite corner should be and lift the pointer.
* **Text**  Use this tool to add fixed text to the background. The options are the colour and size of the text.  Click on the background to show a text box into which you can type.  You can move the box by dragging on the grey border and expand it by dragging the black square at the bottom right corner.  Click anywhere outside the box to finish.
* **Pencil** draws freehand lines.
* **Marker** draws lines like a marker or highlighter pen.
* **Eraser** removes everything it passes over.
* **Image** Clicking on this tool gives you a file chooser to select an image file (picture) from your computer - JPG, PNG and GIF formats are accepted. When the image has been placed on the background, you can drag it to where you want it, and resize it by dragging on the small black square at the bottom right.  Click anywhere outside the image to fix it to the background.
* **Undo** This tool will undo the effect of the last drawing (e.g. if you have just placed an image on the background, it will remove the image, or if you have drawn a line with the pencil, it will undo that line).  Each click of the Undo button removes a previous drawing.

## Analysis

Once you have a map, you may want to examine it for themes and patterns. This is easiest if you examine portions of the map, or 'sub-maps', one at a time.  As  Barbrook-Johnson and Penn explain ([Barbrook-Johnson, P., & Penn, A. (2021). Participatory systems mapping for complex energy policy evaluation. Evaluation, 27(1), 57–79.](https://doi.org/10.1177/1356389020976153){target="_blank"}), network analysis can be combined with subjective information to answer a range of questions, as indicated in the table below.

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

As well as the map view described above, PRSM also provides an alternative Data View.  This shows the Factors and Links in tables like a spreadsheet.  You can make changes in the Data View and the changes to Factors and Links will immediately be passed over to the Map view.  For some tasks, the Data View is more convenient than the Map, especially when one wants to summarise or make changes to lots of Factors or Links at the same time.

To see a Data View, open a PRSM map, click on the Share button at the top, check the box labelled 'Data View' in the dialog that appears, and then click on the 'Copy to clipboard' button to copy the URL shown.  Open a new tab in your browser and paste the URL into the address bar.  

<img src="/doc/images/DataView.png">

The main part of the Data View when opened shows a table with one row for each of the Factors in the map.  On the left are the Factors' labels.  To the right, there is  a group of columns that show the format of the Factors, a group of columns with various statistics about the Factors and column showing the Notes attached to the Factors. At the bottom of the table are summaries (counts of how many Factors there are, the average betweenness centrality, and so on).  If there are too many Factors to fit in the window, you can scroll the table to the top or bottom.

Only the first column of the Fornat and Statistics column groups are shown when the Data View is first opened.  To reveal the other columns in each group, click on the <img src="/doc/images/ExpandSymbol.png" style="display: inline" width="20"> to the right of the group heading.  Similarly, the Notes column can be expanded to show more of the Notes.

<img src="/doc/images/ExpandedDataView.png">

Use the small triangles in the column headings to sort the table according to the values in that column - one click for ascending  and two for descending.

The values in columns with headings in black letters can be edited from the Data View, but the ones in columns with grey headings are read only.  

Some columns need further explanation:

* **Select** If  you edit a value in a row that has a check mark (tick) in the Select column, the same edit will be made in all the other rows that are checked.  For example, if you check three rows and change the value of the Shape column in any one of the three Selected rows to 'ellipse', the other two rows' shape will also change to 'ellipse'.  This is a convenient way to change multiple Factors at once. Clicking the check box in the heading will Select all the Factors (or unselect them all if they are all selected).
* **Style** The values in this column are the styles assigned in the Style panel in the Map view.  '--' is shown for Factors that use a style that has not been named.
* **Hidden** A Factor with a check (tick) in this column is not displayed in the Map view.  The Links to that Factor are also hidden.  For instance, when you use the 'Show only Factors upstream' feature in the Network panel in the Map view, this hides the Factors that are downstream. However, using this column in the Data view is more flexible: you can hide any factor on the map. Clicking the check box in the heading will Hide all the Factors (so nothing will show in the Map view). Unchecking it will 'unhide' all Factors.
* **Relative size** This column can be used to alter the size (width and height) of Factors on the map.  Enter a number between 0 and 10 to control the size (e.g. a Factor with a relative size of 10 will be shown as much bigger on the map than a Factor with relative size 1).
* **Fill colour** Clicking on the cell will open a colour editor that you can use to change the background colour of the Factor.
* **Notes** Clicking on a cell in the Notes column will display a dialog in the middle of the window in which you can create or edit a Note. Click anywhere outside the dialog box to save the edit.

Above the table, there are tabs labelled 'Factors' and 'Links'.  Clicking the Links tab displays a similar table but with one row for each Link:

![Data View Links Tab](/doc/images/DataViewLinksTab.png)

Most of the cells in the Format section of these tables are editable (columns with headings in **bold** have editable cells; those with headings in grey are not). To edit a cell, click it. Depending on the column, you can then edit the text (e.g. the Label), select from a drop down menu (e.g. Shape) or enter a number (e.g. Font size).

### Top button bar

At the top right is a row of buttons.  These are:

* **Add column** Clicking on this button will add an extra column on the right of the Factcor table. This can be used to add any 'attribute' you wish to the Factors.  You can edit the heading to give the column an appropriate title, and then enter numbers or text into the cells.  For example, you might use the extra column to record the importance of Factors.  Right click the column heading to see a menu to delete the column.

![Filter](/doc/images/Attribute.png)

* **Undo** Restores the previous edit of a cell value.
* **Redo** Retracts a previous 'undo'.
* **Share** Allows you to copy the web link you need to open a Map view.
* **Copy table** Clicking on this button copies the whole table to the clipboard.  You can then paste it into a spreadsheet such as Microsoft Excel for further analysis.
* **Filter** This enables you to filter rows according to some condition - for example, you might filter out all the rows that have labels that do not have the word 'climate' in them.  Clicking on the button reveals a dialog just above the table:

![Filter](/doc/images/Filter.png)

  The first drop down menu includes all the columns (except those that are for colours; you cannot filter by colour).  The second drop down menu has a set of conditions to apply to the values in the filter column.  To the right of this is a text box where you can complete the condition.  For example, to filter out all but those Factors that have the word 'climate' in their label, you would use:

  The rightmost &#9746; is a button to dismiss the filter (or you can click the filter button again).

* **Help** brings you to this documentation.

### Using the Filter and Select

The Filter and the Select column can be used in combination.  For example, suppose you wanted to display all the Factors that influenced  2 or more other factors larger than the rest, to emphasise them in the Map view.  This is what you could do:

1. Click on the Filter button. Set up a filter with Out-degree >= 2
2. Click on the Select all check box at the top of the first column
3. Click on one of the cells in the Relative Size column.  Edit the value to ‘5’
4. Look at the Map view. Observe that all the Factors with 3 or more links pointing away from them are now larger than the rest.

![OutDegreeFilter](/doc/images/OutDegreeFilter.png)

Another, more complicated example: Show only those Factors in the map with a value of Betweenness Centrality greater than some threshold, together with the links that go between these Factors, and hide all other Factors and Links.

1. In the Data view, sort the Factors by Betweenness (click on the sorting triangle in the column header).
2. Click the checkbox in the Hidden column header.  This hides every Factor in the map (if you glance at the map now, you’ll find that it is apparently empty)
3. Open the Filter (click on the Filter button at the top), and filter using ‘Betweenness’ ‘>=’ ‘70’   (or whatever threshold value you choose).
4. Uncheck the cells in the Hidden column in each of the rows that are now visible.  This reveals the Factors on the Map that have a Betweenness Centrality greater than the threshold, and the Links between them.

## Source Code

*(The following is intended for developers who want to extend PRSM)*

The program code is available on [GitHub](https://github.com/micrology/prsm){target="_blank"}.  

The javascript (ES6) code in sub-directory ```js``` is divided into several modules: those that handle the main network pane (```prsm.js```), the background painting functions (```paint.js```), editing the styles (```styles.js```) (the default styles are in ```samples.js```), the initial tour (```tutorial.js```), does tophic layout (```trophic.js```), does clustering (```cluster.js```), calulates the betweenness centrality (```betweenness.js```) and provides shared utility functions (```utils.js```).  The HTML file that displays in the browser is in the ```html``` directory.

PRSM uses two important packages: [```yjs```](https://github.com/yjs/yjs){target="_blank"} and [```vis-network```](https://visjs.org/){target="_blank"}.  The former handles the sharing between participants' browsers and the latter draws the network. A few other packages are used for dealing with touch input ([```Hammer```](https://hammerjs.github.io/){target="_blank"}), drawing emojis, and parsing XML file input.  

These components are assembled using [```parcel```](https://parceljs.org/){target="_blank"} and the bundled file is placed in the ```dist``` directory.  So that users have an easy URL to access (i.e. not needing to include ```dist``` in the link), there is an ```.htaccess``` file that rewrites URLs from what the user puts into their browser to the correct location.

To install the code, use ```git``` to clone the [repo](https://github.com/micrology/prsm){target="_blank"} to your local disk and change to the cloned directory.  Then install the required packages with

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

With thanks to all who helped inspire, suggest features for, comment on, and test PRSM, including the members of [CECAN](https://www.cecan.ac.uk/){target="_blank"}, [CRESS](https://cress.soc.surrey.ac.uk/){target="_blank"}, [Risk Solutions](https://www.risksol.co.uk/){target="_blank"}, and Robin Gilbert.

## Bug reports and feature requests

Please report problems, suggestions and praise to [nigel@prsm.uk](mailto:nigel@prsm.uk)

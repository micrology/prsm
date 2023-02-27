---
sidebar_position: 13
---
# Release Notes

## 2.0

Comparing version 2.0.x with version 1.9.0:

### New features

* Factors can be voted on (see Setting, Network, Show Reactions).
* Data from Excel spreadsheets can be imported and the data in maps can be exported to Excel.
* Notes attached to factors and links can now be edited in a separate window, which can be much larger than the existing Notes panel and offers a wider range of editing commands.
* Right clicking on a user's avatar (the initials in a circle at the top left of the map) selects all the factors and links that that user has created or modified.
* Networks in [DOT or GV](https://en.wikipedia.org/wiki/DOT_(graph_description_language)) formatted files can be imported.
* The log of a map's history can be copied to the clipboard and pasted into a wordprocessor or spreadsheet.
* It is possible to run PRSM within an intranet, with no access needed to the wider internet, for use cases requiring the highest level of security.

### Improvements

* The User Manual has been completely re-implemented and is now much easier to use.
* The drawing layer behind the map now uses  'objects' which can be moved, resized, modified and deleted.  The logic for the drawing layer was completely re-implemented.
* PRSM supports many more simulataneous users working together at the same time (at least 25), because of an improved way of handling updates to users' cursors.
* `.prsm` files,the native format for saving PRSM maps, are now compressed and much smaller than previously.  Older files can still be read.
* Cloning maps is much faster.
* Users can use trackpads on laptops instead of a mouse.
* The Styles palette now offers more shapes for factors (ellipse, diamond,star, triangle, hexagon).
* Keyboard shortcuts have been added for Delete, Undo, and Redo.

### Resolved issues

* Numerous optimisations and bug fixes.
* Some minor changes to the appearance of the  interface to make PRSM easier and more intuitive to use.

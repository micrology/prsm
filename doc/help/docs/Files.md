---
sidebar_position: 8
---

# Files

## Reading and Importing maps

The app can read files in its native format (files with the suffix '.prsm'), or in [GRAPHML](http://graphml.graphdrawing.org/) (.graphml), [GML](https://en.wikipedia.org/wiki/Graph_Modelling_Language) (.gml), [GraphVix](https://graphviz.org/) (.gv or .dot), or [Microsoft Excel](https://www.microsoft.com/en-us/microsoft-365/excel) (.xlsx) formats.  Not all features of the GraphML, GML and GraphViz formats are supported.

To read in files any of these format, either use the **Open** button <img src={require("/static/images/Open.png").default} width="20" /> in the top bar, or drop the file on a PRSM map window.  PRSM will work out from the file contents which type of file it is reading.

### Excel

An **Excel** workbook should contain two spreadsheets, one named ‘Factors’ and the other named ‘Links’.  Both should have a Header (i.e. first row) of column names, with the remaining rows containing data about each Factor or Link (in any order).

The *Factors sheet* must have a column headed ‘Label’.  This column should contain text that will become the labels of the factors. It may, optionally, have:

* a column headed either 'Note' or ‘Description’.  The contents of this column will become notes for the Factors (i.e. the text shown in the Notes box when you select a Factor).
* a column headed ‘Style’, with the contents being numbers between 1 and 9, representing the style to be applied to the Factor (the styles are numbered according to the [Factor Styles](Styling/#factors-tab) tab, from top left to bottom right).
* columns headed 'x' and 'y', holding the numeric coordinates of the Factors in the map.

All other columns are considered to be values of Attributes assigned to Factors and visible in the [Data View](DataView/#data-view) of the map.

The *Links sheet* must have a column headed ‘From’ and another headed ‘To’.  The contents of these columns should be text identical to one of the Labels in the Factors sheet.
It may also, optionally, have:

* a column headed ‘Label’, with text of a label to be applied to the link
* a column headed either 'Note' or ‘Description’.  The contents of this column will become notes for the Links (i.e. the text shown in the Notes box when you select a Link).
* a column headed ‘Style’, with the contents being numbers between 1 and 9, representing the link style to be applied to the Link (the styles are numbered according to the [Link Styles](Styling/#links-tab) tab, from top left to bottom right).

## Saving and Exporting maps

To save the map in PRSM's own format that can be easily opened in another copy of the app, click on the **Save** button at the top of the window.

To save an output file in another format, click on the small downward pointing triangle beside the **Save** button and choose which format you want.

<p align="center">
<img src={require("/static/images/Save.png").default} width="70"/>
</p>

The map can be saved in the app's own native format, as **GML** and **GraphViz** files, or as an **Excel** workbook. The Notes can be written into a file readable by **Microsoft Word**. PRSM can also output the map as a high resolution image.

### Notes file

The output is a **Word** file (.docx) containing, in order, the name of the map, the contents of the map description, any Notes attached to Factors and any Notes attached to Links. The file will be formatted as far as possible similarly to the text in the app (e.g. it will retain bold and italic and bullets, and inserted images).

### Image file

You can save a high resolution (8192 x 8192 pixels) image of the map as a **Portable Network Graphics** (.png) file.  If no factors or links are selected, the image will show the whole map.  Here is an example of an image of a large map.

<img src={require("/static/images/imageexample.jpg").default} width="600"/>

If, however, you want the image to include just a portion of the map, select a factor or factors that you want the image to be centred on.  The image will include those factors and the neighbouring ones.  The example below was created afer selecting the factors 'Traffic noise' and 'Socio-demographic Mobility Equity' from the map above.

<img src={require("/static/images/subsetimageexample.jpg").default} width="600"/>

---
sidebar_position: 5
---

# Files

## Reading and Importing maps

The app can read files in its native format (files with the suffix '.prsm'), or in [GRAPHML](http://graphml.graphdrawing.org/) (.graphml), [GML](https://en.wikipedia.org/wiki/Graph_Modelling_Language) (.gml), [GraphVix](https://graphviz.org/) (.gv or .dot), [Comma Separated Values](https://en.wikipedia.org/wiki/Comma-separated_values) (.csv)  or [Microsoft Excel](https://www.microsoft.com/en-us/microsoft-365/excel) (.xlsx) formats.  Not all features of the GraphML, GML and GraphViz formats are supported.

An **Excel** workbook should contain two spreadsheets, one named ‘Factors’ and the other named ‘Links’.  Both should have a Header (i.e. first row) of column names, with the remaining rows containing data about each Factor or Link (in any order).

The *Factors sheet* must have a column headed ‘Label’.  This column should contain text that will become the labels of the factors. It may, optionally, have:

* a column headed ‘Description’.  The contents of this column will become notes for the Factors (i.e. the text shown in the Notes box when you select a Factor).
* a column headed ‘Style’, with the contents being numbers between 1 and 9, representing the style to be applied to the Factor (the styles are numbered according to the [Factor Styles](Styling/#factors-tab) tab, from top left to bottom right).
* columns headed 'x' and 'y', holding the numeric coordinates of the Factors in the map.

All other columns are considered to be values of Attributes assigned to Factors and visible in the [Data View](DataView/#data-view) of the map.

The *Links sheet* must have a column headed ‘From’ and another headed ‘To’.  The contents of these columns should be text identical to one of the Labels in the Factors sheet.
It may also, optionally, have:

* a column headed ‘Label’, with text of a label to be applied to the link
* a column headed ‘Description’.  The contents of this column will become notes for the Links (i.e. the text shown in the Notes box when you select a Link).
* a column headed ‘Style’, with the contents being numbers between 1 and 9, representing the link style to be applied to the Link (the styles are numbered according to the [Link Styles](Styling/#links-tab) tab, from top left to bottom right).

All other columns are considered to be values of Attributes assigned to Links and visible in the [Data View](DataView/#data-view) of the map.

A **CSV** file must contain at least two columns of values.  Each row represents a link. In the first column is the label of the factor from which the link points, and in the second column is the label of the factor the link is pointing to.  This very simple format is designed to allow straightforward imports from other software. Optionally, the third and fourth columns may contain an integer between 1 and 9 - if they do, the factor is styled with that style (styles are numbered from top left to bottom right as shown on the [Factors tab](Styling/#factors-tab)).  The fifth column may contain the style number for the link. *Note: the CSV format is now deprciated, becuase the Excel format is easier to use and Excel can read and write CSV files.  The CSV format may be removed in a future version.*

To read in files any of these format, use the **Open** button <img src="/images/Open.png" width="20" /> in the top bar.  PRSM will work out from the file contents which type of file it is reading.

## Saving and Exporting maps

The app can create output files in the app's own native format or as **GML**, **GraphViz** or **CSV** files, or as an **Excel** workbook. It can also output the map as a high resolution image.

The CSV output produces two files, one listing all the factors and the other all the links.  The factor file starts with a header row with the names of the columns (`Id,Label,Style,Note`) and then describes each factor. The links file has a header: `Source,Target,Type,Id,Label,Style,Note`, where the Source and Target refer to the Ids listed in the factors CSV file.

You can also save a high resolution (600 dpi) image of the map as a **Portable Network Graphics** (.png) file.  The image shows the same view of the map as you see on the screen (so, for example, it will not show factors that have been moved out of the app window).

To save the output files, click on the small downward pointing triangle beside the Save button in the top bar and choose which format you want.

<p align="center">
<img src="/images/Save.png" width="70"/>
</p>

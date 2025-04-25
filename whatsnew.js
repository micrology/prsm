/**
 * This file should contain a list of descriptions of what is new in the current version.  
 * Each item should start with <li>
 */

document.write(`
<li><b>Version 2.5, April 2025</b></li>
<li>New: importing and exporting GEXF and GraphML files.  These are standard formats for representing graphs and networks.  You can now import and export PRSM maps in these formats, making it easier to share your maps with other applications and tools. See <a href="doc/help/doc_build/manual/Files.html" target="_blank">Opening and Saving maps</a>.</li>
<li>The Force Atlas 2 layout engine has been tuned to give a more useful layout of complex maps.</li>
<li>The Settings Factor Styles panel has the number of available styles doubled from 6 to 12.</li>
<li><b>Version 2.4, December 2024</b></li> 
<li>This version introduces a new type of factor: 'Portals'.  A portal factor is a special type of factor that links to another map.  When you click on a portal factor, the map it links to will open in a new browser tab.  This useful when, for example, you have several related maps and want to move easily between them.  It is also useful if you have a high level or abstract map. Portal factors on this map can link to more detailed maps that expand on the factors in the high level one. See <a href="doc/help/doc_build/manual/Cloning.html#linking-one-map-to-another" target="_blank">Linking one map to another</a> for further details.</li>
<li>When opening a map from a file, you can now choose whether the map should replace the existing map, or be merged with it. See <a href="doc/help/doc_build/manual/Cloning.html#merging-maps" target="_blank">Merging Maps</a>.</li>
<li>The colour picker, used to choose the colour of factors, links, background shapes and the map background, has been enhanced to control the transparency of the colour.  One use of this is that if you make the map background transparent and then obtain a high definition image of the map, that image will also have a transparent background, which can be helpful when incorporating the image into a web page.</li>
<li>When creating a 'read-only' copy of a map, you can choose whether to include a 'Copy map' button in the top bar.  If you do, viewers cannot change the read only map, but they can create a fully editable copy of the map in a new room, displayed in a new browser tab.</li>
<li>The User Manual has ben reformatted and extended and you can now search it.</li>
<li>And bug fixes and security updates.<hr></li>
<li><b>Version 2.3, May 2024</b></li>
<li>The chat feature (the dialog icon in the bottom right corner) has been removed - it was very rarely used.</li>
<li>A "minimap" has replaced it. The minimap is a small version of the entire map, displayed in the bottom right corner of the screen. It only appears if some parts of the map are not visible within the main window. A rectangular outline on the minimap indicates the portion of the map that is currently visible in the main window. This helps you to see how the visible section fits within the larger map, especially if the map is extensive. You can drag the rectangle on the minimap to quickly move the visible area to a different part of the map.</li>
<li>To change your name and your initials shown on the avatar at the top right corner of the map and elsewhere, click on the avatar.  A dialog will open for you to enter your new name.</li>
<li>To open a PRSM map file (or any of the other types of file that PRSM can read), you can either use the Open button or you can now drag a file from your desktop and drop it on the PRSM browser window.<hr></li>
<li><b>Version 2.2, January 2024</b></li>
<li>The shapes for individual factors, or for all the factors of the same style, can be resized to be relatively larger than other factors.  This is done with new sliders included on the pop-up dialogs for editing factors and editing factor styles.
<li>You can save a high resolution (8192 x 8192 pixels) image of the map as a Portable Network Graphics (.png) file using the Save drop down menu.  The image, which is suitable for publication, will show the whole map.  If, however, you want the image to include just a portion of the map, select a factor or factors that you want the image to be centred on before Saving the image.  The image will include just those factors and the neighbouring ones.
<li>And other enhancements, bug fixes and security updates.<hr></li>
<li><b>Version 2.1, August 2023</b></li>
<li>There is now a panel into which you can write a description or notes about the map as a whole. To view the panel, click on the small grey button on the left edge of the map area. While entering or editing text, you can use the formatting buttons at the top of the panel: bold, italic, underline, as well as change font size, insert images etc. The contents of the panel are shared with other participants as you write. Click on the grey button again to put the panel away.</li>
<li>Instead of some factors and links being hidden when using the Analysis features, they are faded out, to provide more context around those that are shown.</li>
`)
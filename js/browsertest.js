/* global Modernizr */

if (
	!(
		Modernizr.es6number &&
		Modernizr.borderradius &&
		Modernizr.boxsizing &&
		Modernizr.flexbox &&
		Modernizr.boxshadow &&
		Modernizr.canvas &&
		Modernizr.fileinput &&
		Modernizr.eventlistener &&
		Modernizr.webworkers &&
		Modernizr.json
	)
) {
	alert(
		'Your browser does not support all the features required.  Try an up-to-date copy of Edge, Chrome, Firefox or Safari'
	);
}
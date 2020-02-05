export const samples = {

nodes: {
	base: {
		groupLabel: 'Sample',
		borderWidth: 2,
		borderWidthSelected: 1,
		chosen: true,
		color: {
			border: 'black',
			background: 'white',
			highlight: {
				border: 'black',
				background: 'white'
				},
			hover: {
				border: 'black',
				background: 'white'
			},
		},
		font: {
			color: 'black',
			size: 14
		},
		labelHighlightBold: true,
		shape: 'ellipse',
		shapeProperties: {
			borderDashes: false
		},
		size: 50,
		widthConstraint: {
			minimum: 50
		},
		heightConstraint: {
			minimum: 20
		}
	},
	//------------------------------
	// blue bordered white ellipse 
	group0: {
		color: {
			border: '#0000ff',
			background: "white",
			},
		font: {
			color: 'black',
		},
	},

	//------------------------------
	// black bordered white ellipse 

	group1: {
		color: {
			border: 'black',
			background: "white",
		},
		font: {
			color: 'black',
		},
	},

	//------------------------------
	// black bordered green ellipse 

	group2: {
		color: {
			border: 'black',
			background: "#99e699",
		},
		font: {
			color: 'black',
		},
	},

	//------------------------------
	// black bordered pink ellipse 

	group3: {
		color: {
			border: 'black',
			background: "#ffccdd",
		},
		font: {
			color: 'black',
		},
	},

	//------------------------------
	// black dashed bordered pink ellipse 

	group4: {
		color: {
			border: 'black',
			background: "#ffccdd",
		},
		font: {
			color: 'black',
		},
		shapeProperties: {
			borderDashes: true
		},
	},


	//------------------------------
	// black bordered blue ellipse 

	group5: {
		color: {
			border: 'black',
			background: "#b3ccff",
		},
		font: {
			color: 'black',
		},
	},
	
	//------------------------------
	// black bordered yellow ellipse 


	group6: {
		color: {
			border: 'black',
			background: "#ffff99",
		},
		font: {
			color: 'black',
		},
	},


	//------------------------------
	//  black large text only 

	group7: {
		color: {
			border: 'black',
			background: "#ffff99",
		},
		font: {
			color: 'black',
			size: 20
		},
		labelHighlightBold: true,
		shape: 'text',
	},

	//------------------------------
	//  red text only 

	group8: {
		color: {
			border: 'black',
			background: "#ffff99",
		},
		font: {
			color: 'red',
			size: 20
		},
		shape: 'text',
	}

}, // end of node samples


edges: {

	base: {
			arrows: {
			to: {
				enabled: true,
				type: "arrow"
			},
			middle: {
				enabled: false
			},
			from: {
				enabled: false,
			}
		},
		color: {
			color: 'black',
			highlight: 'black',
			hover: 'black',
			inherit: false,
			opacity: 1.0
		},
		dashes: false,
		hoverWidth: 1.5,
		selectionWidth: 2,
		selfReferenceSize: 20,
		width: 1
	},

	// simple directed black link

	edge0: {
		color: {
			color: 'black',
		},
	},

	// simple directed blue link

	edge1: {
		color: {
			color: 'blue',
		},
	},

	// simple directed red link

	edge2: {
		color: {
			color: 'red',
		},
	},

	// simple directed green link

	edge3: {
		color: {
			color: 'green',
		},
	},
	
	// simple directed grey link

	edge4: {
		color: {
			color: 'grey',
		},
	},

	// medium directed yellow link

	edge5: {
		color: {
			color: 'gold',
		},
		width: 4
	},

	//  directed black dashed link

	edge6: {
		color: {
			color: 'black',
		},
		dashes: [10, 10],
		width: 5
	},

	//  directed green dashed link

	edge7: {
		color: {
			color: 'green',
		},
		dashes: [10, 10],
		width: 5
	},


	//  directed black link with middle arrow

	edge8: {
		arrows: {
			middle: {
				enabled: true,
				type: "arrow"
			},
		},
		color: {
			color: 'black',
		},
	}

} // end of edges samples

}



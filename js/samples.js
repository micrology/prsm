export const styles = {
	nodes: {
		base: {
			groupLabel: 'Sample',
			borderWidth: 1,
			borderWidthSelected: 1,
			chosen: true,
			color: {
				border: '#000000',
				background: '#ffffff',
				highlight: {
					border: '#000000',
					background: '#ffffff',
				},
				hover: {
					border: '#000000',
					background: '#ffffff',
				},
			},
			font: {
				color: '#000000',
				size: 14,
			},
			labelHighlightBold: true,
			shape: 'ellipse',
			shapeProperties: {
				borderDashes: false,
			},
			scaling: {
				min: 10,
				max: 100,
				label: {
					enabled: true,
					min: 10,
					max: 100,
				},
			},
		},
		//------------------------------
		// blue bordered white ellipse
		group0: {
			color: {
				border: '#0000ff',
				background: '#ffffff',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		// black bordered white ellipse
		group1: {
			color: {
				border: '#000000',
				background: '#ffffff',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		// black bordered green ellipse
		group2: {
			color: {
				border: '#000000',
				background: '#99e699',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		// black bordered pink ellipse
		group3: {
			color: {
				border: '#000000',
				background: '#ffccdd',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		// black dashed bordered pink ellipse
		group4: {
			color: {
				border: '#000000',
				background: '#ffccdd',
			},
			font: {
				color: '#000000',
			},
			shapeProperties: {
				borderDashes: true,
			},
		},
		//------------------------------
		// black bordered blue ellipse
		group5: {
			color: {
				border: '#000000',
				background: '#b3ccff',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		// black bordered yellow ellipse
		group6: {
			color: {
				border: '#000000',
				background: '#ffff99',
			},
			font: {
				color: '#000000',
			},
		},
		//------------------------------
		//  black large text only
		group7: {
			color: {
				border: '#000000',
				background: '#ffff99',
			},
			font: {
				color: '#000000',
				size: 20,
			},
			labelHighlightBold: true,
			shape: 'text',
		},
		//------------------------------
		//  red text only
		group8: {
			color: {
				border: '#000000',
				background: '#ffff99',
			},
			font: {
				color: '#ff0000',
				size: 20,
			},
			shape: 'text',
		},
	}, // end of node samples
	edges: {
		base: {
			arrows: {
				to: {
					enabled: true,
					type: 'arrow',
				},
				middle: {
					enabled: false,
				},
				from: {
					enabled: false,
				},
			},
			color: {
				color: '#000000',
				highlight: '#000000',
				hover: '#000000',
				inherit: false,
				opacity: 1.0,
			},
			dashes: false,
			font: {
				size: 20,
			},
			hoverWidth: 1,
			label: '',
			selectionWidth: 1,
			width: 1,
			groupLabel: '',
		},
		// simple directed black link
		edge0: {
			color: {
				color: '#000000',
			},
		},
		// simple directed green link
		edge1: {
			color: {
				color: '#00cc00',
			},
		},
		// simple directed red link
		edge2: {
			color: {
				color: '#ff0000',
			},
		},
		// simple directed blue link
		edge3: {
			color: {
				color: '#0000ff',
			},
		},
		// simple directed grey link
		edge4: {
			color: {
				color: '#808080',
			},
		},
		// medium directed dark yellow link
		edge5: {
			color: {
				color: '#e6b800',
			},
			width: 2,
		},
		//  directed black dashed link
		edge6: {
			color: {
				color: '#000000',
			},
			dashes: [10, 10],
			width: 3,
		},
		//  directed green dashed link
		edge7: {
			color: {
				color: '#008000',
			},
			dashes: [10, 10],
			width: 3,
		},
		//  directed black link with middle arrow
		edge8: {
			arrows: {
				middle: {
					enabled: true,
					type: 'arrow',
				},
				to: {
					enabled: true,
					type: 'arrow',
				},
			},
			color: {
				color: '#000000',
			},
		},
	}, // end of edges samples
};

export const styles = {
	nodes: {
		base: {
			groupLabel: 'Sample',
			borderWidth: 4,
			borderWidthSelected: 4,
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
			fixed: false,
			font: {
				face: 'Oxygen',
				color: '#000000',
				size: 14,
			},
			labelHighlightBold: true,
			margin: 20,
			shape: 'ellipse',
			shapeProperties: {
				borderDashes: false,
			},
			scaling: {
				min: 10,
				max: 40,
				label: {
					enabled: false,
					min: 10,
					max: 40,
				},
			},
		},
		group0: {
			borderWidth: 0,
			color: {
				border: '#9ADBB4',
				background: '#9ADBB4',
			},
			shape: 'box',
		},
		group1: {
			borderWidth: 0,
			color: {
				border: '#CADB5C',
				background: '#CADB5C',
			},
			shape: 'box',
		},
		group2: {
			borderWidth: 0,
			color: {
				border: '#DBA542',
				background: '#DBA542',
			},
			shape: 'box',
		},
		group3: {
			borderWidth: 0,
			color: {
				border: '#DB6E67',
				background: '#DB6E67',
			},
			font: {
				color: '#ffffff',
			},
			shape: 'box',
		},
		group4: {
			borderWidth: 0,
			color: {
				border: '#8371B7',
				background: '#8371B7',
			},
			font: {
				color: '#ffffff',
			},
			shape: 'box',
		},
		group5: {
			color: {
				border: '#000000',
				background: '#b3ccff',
			},
			shape: 'ellipse',
		},
		group6: {
			font: {
				color: '#1c5f1b',
			},
			shape: 'text',
		},
		group7: {
			color: {
				border: '#000000',
				background: '#ffff99',
			},
			shape: 'circle',
			shapeProperties: {
				borderDashes: [3, 3],
			},
		},
		group8: {
			borderWidth: 0,
			color: {
				border: '#7A7A7A',
				background: '#7A7A7A',
			},
			font: {
				color: '#ffffff',
			},
			shape: 'circle',
		},
		cluster: {
			borderWidth: 3,
			color: {
				border: '#000000',
				background: '#DD2C00',
			},
			font: {
				color: '#ffffff',
			},
			shape: 'database',
			margin: {top: 40},
		},
	},
	edges: {
		base: {
			arrows: {
				to: {
					enabled: true,
					type: 'vee',
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
				opacity: 1,
			},
			dashes: false,
			font: {
				size: 14,
			},
			groupLabel: 'Sample',
			hoverWidth: 1,
			selectionWidth: 0,
			width: 1,
		},
		edge0: {
			color: {
				color: '#000000',
			},
		},
		edge1: {
			color: {
				color: '#00cc00',
			},
		},
		edge2: {
			color: {
				color: '#ff0000',
			},
		},
		edge3: {
			color: {
				color: '#0000ff',
			},
		},
		edge4: {
			color: {
				color: '#808080',
			},
		},
		edge5: {
			color: {
				color: '#e6b800',
			},
		},
		edge6: {
			color: {
				color: '#000000',
			},
			dashes: [3, 3],
		},
		edge7: {
			color: {
				color: '#008000',
			},
			dashes: [10, 10],
			width: 3,
		},
		edge8: {
			arrows: {
				to: {
					enabled: false,
				},
				middle: {
					enabled: true,
					type: 'arrow',
				},
			},
			color: {
				color: '#000000',
			},
		},
		cluster: {
			color: {
				color: '#8D6E63',
			},
			width: 3,
		},
	},
}

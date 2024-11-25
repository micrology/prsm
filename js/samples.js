/*********************************************************************************************************************  

PRSM Participatory System Mapper 

    Copyright (C) 2022  Nigel Gilbert prsm@prsm.uk

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.


This module provides the standard set of Styles for Factors and Links.  
 ******************************************************************************************************************** */
export const styles = {
	nodes: {
		base: {
			groupLabel: 'Sample',
			borderWidth: 4,
			borderWidthSelected: 4,
			color: {
				border: 'rgb(0, 0, 0)',
				background: 'rgb(255, 255, 255)',
				highlight: {
					border: 'rgb(0, 0, 0)',
					background: 'rgb(255, 255, 255)',
				},
				hover: {
					border: 'rgb(0, 0, 0)',
					background: 'rgb(255, 255, 255)',
				},
			},
			fixed: false,
			font: {
				face: 'Oxygen',
				color: 'rgb(0, 0, 0)',
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
			size: 25,
			heightConstraint: false,
			widthConstraint: false,
		},
		group0: {
			borderWidth: 0,
			color: {
				border: 'rgb(154, 219, 180)',
				background: 'rgb(154, 219, 180)',
			},
			shape: 'box',
		},
		group1: {
			borderWidth: 0,
			color: {
				border: 'rgb(202, 219, 92)',
				background: 'rgb(202, 219, 92)',
			},
			shape: 'box',
		},
		group2: {
			borderWidth: 0,
			color: {
				border: 'rgb(219, 165, 66)',
				background: 'rgb(219, 165, 66)',
			},
			shape: 'box',
		},
		group3: {
			borderWidth: 0,
			color: {
				border: 'rgb(219, 110, 103)',
				background: 'rgb(219, 110, 103)',
			},
			font: {
				color: 'rgb(255, 255, 255)',
			},
			shape: 'box',
		},
		group4: {
			borderWidth: 0,
			color: {
				border: 'rgb(131, 113, 183)',
				background: 'rgb(131, 113, 183)',
			},
			font: {
				color: 'rgb(255, 255, 255)',
			},
			shape: 'box',
		},
		group5: {
			borderWidth: 1,
			color: {
				border: 'rgb(0, 0, 255)',
				background: 'rgb(179, 204, 255)',
			},
			shape: 'ellipse',
		},
		group6: {
			font: {
				color: 'rgb(28, 95, 27)',
			},
			shape: 'text',
		},
		group7: {
			color: {
				border: 'rgb(0, 0, 0)',
				background: 'rgb(255, 255, 153)',
			},
			shape: 'circle',
			shapeProperties: {
				borderDashes: [3, 3],
			},
		},
		group8: {
			borderWidth: 0,
			color: {
				border: 'rgb(122, 122, 122)',
				background: 'rgb(122, 122, 122)',
			},
			font: {
				color: 'rgb(122, 122, 122)',
			},
			shape: 'star',
		},
		cluster: {
			borderWidth: 3,
			color: {
				border: 'rgb(0, 0, 0)',
				background: 'rgb(221, 44, 0)',
			},
			font: {
				color: 'rgb(255, 255, 255)',
			},
			shape: 'database',
			margin: { top: 40, right: 20, bottom: 20, left: 20 },
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
				color: 'rgb(0, 0, 0)',
				highlight: 'rgb(0, 0, 0)',
				hover: 'rgb(0, 0, 0)',
				inherit: false,
				opacity: 1,
			},
			dashes: false,
			font: {
				size: 14,
				align: 'top',
				background: 'rgb(255,255,255)',
				vadjust: -5,
				strokeWidth: 0,
			},
			groupLabel: 'Sample',
			hoverWidth: 1,
			selectionWidth: 0,
			width: 1,
		},
		edge0: {
			color: {
				color: 'rgb(0, 0, 0)',
			},
		},
		edge1: {
			color: {
				color: 'rgb(0, 204, 0)',
			},
		},
		edge2: {
			color: {
				color: 'rgb(255, 0, 0)',
			},
		},
		edge3: {
			color: {
				color: 'rgb(0, 0, 255)',
			},
		},
		edge4: {
			color: {
				color: 'rgb(128, 128, 128)',
			},
		},
		edge5: {
			color: {
				color: 'rgb(230, 184, 0)',
			},
		},
		edge6: {
			color: {
				color: 'rgb(0, 0, 0)',
			},
			dashes: [3, 3],
		},
		edge7: {
			color: {
				color: 'rgb(0, 128, 0)',
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
				color: 'rgb(0, 0, 0)',
			},
		},
		cluster: {
			color: {
				color: 'rgb(141, 110, 99)',
			},
			width: 3,
		},
	},
}

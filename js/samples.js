var groups = {
    //------------------------------
    // blue bordered white ellipse 
	group0:
    {
        borderWidth: 2,
        borderWidthSelected: 1,
        chosen: true,
        color: {
            border: '#0000ff',
            background: "white",
            highlight: {
                border: '#000080',
                background: '#efefff'
            },
            hover: {
                border: '#2B7CE9',
                background: 'white'
            }
        },
        font: {
            color: 'black',
		},
        labelHighlightBold: true,
        shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.5)',
            size: 5,
            x: 5,
            y: 5
        },
        shape: 'ellipse',
        shapeProperties: {
            borderDashes: false, // only for borders
            borderRadius: 6, // only for box shape
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
    // red bordered white ellipse 

    group1: {
        borderWidth: 2,
        borderWidthSelected: 1,
        chosen: true,
        color: {
            border: 'red',
            background: "white",
            highlight: {
                border: '#c0392b',
                background: '#ffe6e6'
            },
            hover: {
                border: '#e74c3c',
                background: 'white'
            }
        },
        font: {
            color: 'black',
		},
        labelHighlightBold: true,
        shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.5)',
            size: 5,
            x: 5,
            y: 5
        },
        shape: 'ellipse',
        shapeProperties: {
            borderDashes: false, // only for borders
            borderRadius: 6, // only for box shape
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
    // purple bordered white ellipse 

	group2:
    {
        borderWidth: 2,
        borderWidthSelected: 1,
        chosen: true,
        color: {
            border: '#9b59b6',
            background: "white",
            highlight: {
                border: '#8e44ad',
                background: '#efefff'
            },
            hover: {
                border: '#8e44ad',
                background: 'white'
            }
        },
        font: {
            color: 'black',
		},
        labelHighlightBold: true,
        shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.5)',
            size: 5,
            x: 5,
            y: 5
        },
        shape: 'ellipse',
        shapeProperties: {
            borderDashes: false, // only for borders
            borderRadius: 6, // only for box shape
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
    //  black text only 

    group3:
    {
        borderWidth: 2,
        borderWidthSelected: 1,
        chosen: true,
        font: {
            color: 'black',
            size: 20, // px
		},
        labelHighlightBold: true,
        shape: 'text',
        size: 50,
        widthConstraint: {
            minimum: 50
        },
        heightConstraint: {
            minimum: 20
        }
    },
    
    //------------------------------
    //  brown text only 

    group4:
    {
        borderWidth: 2,
        borderWidthSelected: 1,
        chosen: true,
        font: {
            color: '#996633',
            size: 20, // px
		},
        labelHighlightBold: true,
        shape: 'text',
        size: 50,
        widthConstraint: {
            minimum: 50
        },
        heightConstraint: {
            minimum: 20
        }
    },

    //------------------------------
    // yellow box

    group5:
    {
        borderWidth: 2,
        borderWidthSelected: 4,
        chosen: true,
        color: {
            border: '#e6e600',
            background: "#ffff80", // yellow
            highlight: {
                border: '#999900',
                background: '#f1c41f'
            },
            hover: {
                border: '#2B7CE9',
                background: '#f1c41f'
            }
        },
        font: {
            color: 'black',
		},
        labelHighlightBold: true,
        shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.5)',
            size: 10,
            x: 5,
            y: 5
        },
        shape: 'box',
        shapeProperties: {
            borderDashes: false, // only for borders
            borderRadius: 6, // only for box shape
        },
        size: 50,
        widthConstraint: {
            minimum: 30
        },
        heightConstraint: {
            minimum: 20
        }    
    },

    
    //------------------------------
    //   blue box with white text

    group6:
    {
        borderWidth: 1,
        borderWidthSelected: 2,
        chosen: true,
        color: {
            border: '#2B7CE9',
            background: "#3498db",
            highlight: {
                border: '#2B7CE9',
                background: '#2980b9'
            },
            hover: {
                border: '#2B7CE9',
                background: '#2980b9'
            }
        },
        font: {
            color: 'white',
		},
        labelHighlightBold: true,
        shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.5)',
            size: 10,
            x: 5,
            y: 5
        },
        shape: 'box',
        shapeProperties: {
            borderDashes: false, // only for borders
            borderRadius: 6, // only for box shape
        },
        size: 30,
        widthConstraint: {
            minimum: 50
        },
        heightConstraint: {
            minimum: 20
        }
    },
    
    //------------------------------
	// red star
	
    group7:
    {
        borderWidth: 0,
        borderWidthSelected: 5,
        chosen: true,
        color: {
            border: '#2B7CE9',
            background: "#e74c3c", 
            highlight: {
                border: '#2B7CE9',
                background: '#c0392b'
            },
            hover: {
                border: '#2B7CE9',
                background: '#c0392c'
            }
        },
        font: {
            color: 'black',
		},
        labelHighlightBold: true,
        shadow: {
            enabled: false,
            color: 'rgba(0,0,0,0.5)',
            size: 10,
            x: 5,
            y: 5
        },
        shape: 'star',
        size: 25
    },
    group8:
    {
    }
};



    
// edges (first is the default)

var groupEdges = {
  
  // simple directed black link
  
  	edge0:
  	{
		arrows: {
		  to: {
			enabled: true,
			type: "arrow"
		  },
		  from: {
			enabled: false,
		  }
		},
		color: {
		  color: 'black',
		  highlight:'black',
		  hover: 'black',
		  inherit: false,
		  opacity:1.0
		},
		hoverWidth: 1.5,
		selectionWidth: 2,
		selfReferenceSize:20,
		smooth: {
		  enabled: true,
		  type: "dynamic",
		  roundness: 0.5
		},
		width: 1,
  },
  
  // simple directed blue link
  
  	edge1:
  	{
		arrows: {
		  to: {
			enabled: true,
			type: "arrow"
		  },
		  from: {
			enabled: false,
		  }
		},
		color: {
		  color: 'blue',
		  highlight:'blue',
		  hover: 'blue',
		  inherit: false,
		  opacity:1.0
		},
		hoverWidth: 3,
		selectionWidth: 4,
		selfReferenceSize:20,
		smooth: {
		  enabled: true,
		  type: "dynamic",
		  roundness: 0.5
		},
		width: 2,
  },
  
  // simple directed red link
  
  	edge2:
  	{
		arrows: {
		  to: {
			enabled: true,
			type: "arrow"
		  },
		  from: {
			enabled: false,
		  }
		},
		color: {
		  color: 'red',
		  highlight:'red',
		  hover: 'red',
		  inherit: false,
		  opacity:1.0
		},
		hoverWidth: 1.5,
		selectionWidth: 2,
		selfReferenceSize:20,
		smooth: {
		  enabled: true,
		  type: "dynamic",
		  roundness: 0.5
		},
		width: 1,
  },
    
  // simple directed grey link
  
  	edge3:
  	{
		arrows: {
		  to: {
			enabled: true,
			type: "arrow"
		  },
		  from: {
			enabled: false,
		  }
		},
		color: {
		  color: 'grey',
		  highlight:'grey',
		  hover: 'grey',
		  inherit: false,
		  opacity:1.0
		},
		hoverWidth: 3,
		selectionWidth: 4,
		selfReferenceSize:20,
		smooth: {
		  enabled: true,
		  type: "dynamic",
		  roundness: 0.5
		},
		width: 2
  },
  
    // medium directed yellow link
  
  	edge4:
  	{
		arrows: {
		  to: {
			enabled: true,
			type: "arrow"
		  },
		  from: {
			enabled: false,
		  }
		},
		color: {
		  color: 'gold',
		  highlight:'gold',
		  hover: 'gold',
		  inherit: false,
		  opacity:1.0
		},
		hoverWidth: 6,
		selectionWidth: 8,
		selfReferenceSize:20,
		smooth: {
		  enabled: true,
		  type: "dynamic",
		  roundness: 0.5
		},
		width: 4
  },

    // thick directed red link
  
  	edge5:
  	{
		arrows: {
		  to: {
			enabled: true,
			type: "arrow"
		  },
		  from: {
			enabled: false,
		  }
		},
		color: {
		  color: 'red',
		  highlight:'red',
		  hover: 'red',
		  inherit: false,
		  opacity:1.0
		},
		hoverWidth: 10,
		selectionWidth: 12,
		selfReferenceSize:20,
		smooth: {
		  enabled: true,
		  type: "dynamic",
		  roundness: 0.5
		},
		width: 8
  },
  
  
    // thick directed green link
  
  	edge6:
  	{
		arrows: {
		  to: {
			enabled: true,
			type: "arrow"
		  },
		  from: {
			enabled: false,
		  }
		},
		color: {
		  color: 'green',
		  highlight:'green',
		  hover: 'green',
		  inherit: false,
		  opacity:1.0
		},
		hoverWidth: 10,
		selectionWidth: 12,
		selfReferenceSize:20,
		smooth: {
		  enabled: true,
		  type: "dynamic",
		  roundness: 0.5
		},
		width: 8
  },
  
  
    //  directed black dashed link
  
    edge7:
    {
		arrows: {
		  to: {
			enabled: true,
			type: "arrow"
		  },
		  from: {
			enabled: false,
		  }
		},
		color: {
		  color: 'black',
		  highlight:'black',
		  hover: 'black',
		  inherit: false,
		  opacity:1.0
		},
		dashes: true,
		hoverWidth: 6,
		selectionWidth: 8,
		selfReferenceSize:20,
		smooth: {
		  enabled: true,
		  type: "dynamic",
		  roundness: 0.5
		},
		width: 3
  },
  
  edge8:
  	{
  	}

};

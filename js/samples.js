let sampleFormats = [{  // the first is the global default
        borderWidth: 1,
        borderWidthSelected: 2,
        chosen: true,
        color: {
            border: '#2B7CE9',
            background: '#97C2FC',
            highlight: {
                border: '#2B7CE9',
                background: '#D2E5FF'
            },
            hover: {
                border: '#2B7CE9',
                background: '#D2E5FF'
            }
        },
        font: {
            color: '#343434',
            size: 14, // px
            face: 'arial',
            background: 'none',
            strokeWidth: 0, // px
            strokeColor: '#ffffff',
            align: 'center',
            multi: true,
            vadjust: 0,
            bold: {
                color: '#343434',
                size: 14, // px
                face: 'arial',
                vadjust: 0,
                mod: 'bold'
            },
            ital: {
                color: '#343434',
                size: 14, // px
                face: 'arial',
                vadjust: 0,
                mod: 'italic',
            },
            boldital: {
                color: '#343434',
                size: 14, // px
                face: 'arial',
                vadjust: 0,
                mod: 'bold italic'
            },
            mono: {
                color: '#343434',
                size: 15, // px
                face: 'courier new',
                vadjust: 2,
                mod: ''
            }
        },
        icon: {
            face: 'FontAwesome',
            size: 50, //50,
            color: '#2B7CE9'
        },
        labelHighlightBold: true,
        mass: 1,
        physics: true,
        scaling: {
            min: 10,
            max: 30,
            label: {
                enabled: false,
                min: 14,
                max: 30,
                maxVisible: 30,
                drawThreshold: 5
            },
            customScalingFunction: function(min, max, total, value) {
                if (max === min) {
                    return 0.5;
                } else {
                    let scale = 1 / (max - min);
                    return Math.max(0, (value - min) * scale);
                }
            }
        },
        shadow: {
            enabled: false,
            color: 'rgba(0,0,0,0.5)',
            size: 10,
            x: 5,
            y: 5
        },
        shape: 'ellipse',
        shapeProperties: {
            borderDashes: false, // only for borders
            borderRadius: 6, // only for box shape
            interpolation: false, // only for image and circularImage shapes
            useImageSize: false, // only for image and circularImage shapes
            useBorderWithImage: false // only for image shape
        },
        size: 25,
        title: undefined,
        value: undefined,
        widthConstraint: false
    },

    //------------------------------
    // blue bordered white ellipse 

    {
        format: "nodeSample1",
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

    {
        format: "nodeSample2",
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

    {
        format: "nodeSample3",
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

    {
        format: "nodeSample4",
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

    {
        format: "nodeSample5",
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

    {
        format: "nodeSample6",
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

    {
        format: "nodeSample7",
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
    {
        format: "nodeSample8",
        borderWidth: 0,
        borderWidthSelected: 2,
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
    }


];

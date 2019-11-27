let sampleFormats = [{
	sample: "default",
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
      code: undefined,
      weight: undefined,
      size: 50,  //50,
      color:'#2B7CE9'
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
      customScalingFunction: function (min,max,total,value) {
        if (max === min) {
          return 0.5;
        }
        else {
          let scale = 1 / (max - min);
          return Math.max(0,(value - min)*scale);
        }
      }
    },
    shadow:{
      enabled: false,
      color: 'rgba(0,0,0,0.5)',
      size:10,
      x:5,
      y:5
    },
    shape: 'ellipse',
    shapeProperties: {
      borderDashes: false, // only for borders
      borderRadius: 6,     // only for box shape
      interpolation: false,  // only for image and circularImage shapes
      useImageSize: false,  // only for image and circularImage shapes
      useBorderWithImage: false  // only for image shape
    },
    size: 25,
    title: undefined,
    value: undefined,
    widthConstraint: false
  },
  
  //------------------------------
  
  {
  	sample: "nodeSample1",
	borderWidth: 1,
    borderWidthSelected: 2,
    chosen: true,
    color: {
      border: '#2B7CE9',
      background: "red", //'#97C2FC',
      highlight: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      },
      hover: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      }
    },
    labelHighlightBold: true,
    shadow:{
      enabled: false,
      color: 'rgba(0,0,0,0.5)',
      size:10,
      x:5,
      y:5
    },
    shape: 'star',
    size: 25
  },
  
  //------------------------------
  
  {
  	sample: "nodeSample2",
	borderWidth: 1,
    borderWidthSelected: 2,
    chosen: true,
    color: {
      border: '#2B7CE9',
      background: "yellow", //'#97C2FC',
      highlight: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      },
      hover: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      }
    },
    labelHighlightBold: true,
    shadow:{
      enabled: false,
      color: 'rgba(0,0,0,0.5)',
      size:10,
      x:5,
      y:5
    },
    shape: 'square',
    shapeProperties: {
      borderDashes: false, // only for borders
      borderRadius: 6,     // only for box shape
      interpolation: false,  // only for image and circularImage shapes
      useImageSize: false,  // only for image and circularImage shapes
      useBorderWithImage: false  // only for image shape
    },
    size: 50
  },
  
    //------------------------------
    // yellow box
  
  {
  	sample: "nodeSample3",
	borderWidth: 2,
    borderWidthSelected: 4,
    chosen: true,
    color: {
      border: '#e6e600',
      background: "#ffff80", // yellow
      highlight: {
        border: '#999900',
        background: '#ffff00'
      },
      hover: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      }
    },
    labelHighlightBold: true,
    shadow:{
      enabled: true,
      color: 'rgba(0,0,0,0.5)',
      size:10,
      x:5,
      y:5
    },
    shape: 'box',
    shapeProperties: {
      borderDashes: false, // only for borders
      borderRadius: 6,     // only for box shape
    },
    size: 50
  },
  
  
    
    //------------------------------
    // blue bordered white ellipse 
  
  {
  	sample: "nodeSample4",
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
        background: '#D2E5FF'
      }
    },
    labelHighlightBold: true,
    shadow:{
      enabled: true,
      color: 'rgba(0,0,0,0.5)',
      size:5,
      x:5,
      y:5
    },
    shape: 'ellipse',
    shapeProperties: {
      borderDashes: false, // only for borders
      borderRadius: 6,     // only for box shape
    },
    size: 50,
    widthConstraint: {
    	minimum: 100
    	},
	heightConstraint: {
		minimum: 50
	}
  }
  
  ];
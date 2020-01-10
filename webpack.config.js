const path = require('path')

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    'prism': './js/prism.js'
  },
  output: {
    globalObject: 'self',
    path: path.resolve(__dirname, './dist/'),
    filename: '[name].bundle.js',
    publicPath: '/prism/dist/'
  },
  module: {
  	rules: [
  		{
  			test: /\.css/,
  			use: [
  				'style-loader',
  				'css-loader',
  				],
  			},
  		],
  	},		
  devServer: {
    contentBase: path.join(__dirname),
    compress: true,
    publicPath: '/dist/'
  }
}

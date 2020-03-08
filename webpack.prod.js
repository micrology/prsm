const path = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  plugins: [new MiniCssExtractPlugin()],
  mode: 'production',
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
  			use: [MiniCssExtractPlugin.loader, 'css-loader'],
  			},
  		],
  	},		
  devServer: {
    contentBase: path.join(__dirname),
    compress: true,
    publicPath: '/dist/'
  }
}

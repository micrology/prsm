const path = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');

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
  			sideEffects: true
  			},
  		],
  	},		
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({}), new OptimizeCSSAssetsPlugin({})],
  },
}

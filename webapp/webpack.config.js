// webapp/webpack.config.js
const path = require('path');

module.exports = {
  mode: 'production',               // optimized output
  entry: './src/index.tsx',         // <-- if your entry file is src/index.tsx change this accordingly
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js',            // Mattermost expects a single bundle
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: 'ts-loader',           // compiles TS → JS
      },
    ],
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    redux: 'Redux',
    'react-redux': 'ReactRedux',
    '@reduxjs/toolkit': 'RTK',
  },
  devtool: 'source-map',
};

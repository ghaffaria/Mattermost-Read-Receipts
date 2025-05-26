// webapp/webpack.config.js


const path = require('path');

module.exports = {
  mode: 'production',               // optimized output
  entry: './plugin.tsx',         // entry point for the plugin
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
    'mattermost-redux': 'window.reduxStore',
    '@mattermost/client': 'window.reduxStore'
  },

  devtool: 'source-map',
};

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
    modules: ['node_modules'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true, // Speed up compilation
            compilerOptions: {
              module: 'CommonJS'
            }
          }
        }
      },
    ],
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    redux: 'Redux',
    'react-redux': 'ReactRedux',
    'prop-types': 'PropTypes',
    'mattermost-redux': 'window.reduxStore',
    '@mattermost/client': 'window.reduxStore'
  },
  optimization: {
    minimize: true
  },
  performance: {
    hints: false
  }
};

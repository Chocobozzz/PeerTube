const helpers = require('./helpers')
const path = require('path')

const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin')
const ProvidePlugin = require('webpack/lib/ProvidePlugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = function () {
  const configuration = {
    entry: {
      'video-embed': './src/standalone/videos/embed.ts',
      'player': './src/standalone/player/player.ts',
      'test-embed': './src/standalone/videos/test-embed.ts'
    },

    resolve: {
      /*
       * An array of extensions that should be used to resolve modules.
       *
       * See: http://webpack.github.io/docs/configuration.html#resolve-extensions
       */
      extensions: [ '.ts', '.js', '.json', '.scss' ],

      modules: [ helpers.root('src'), 'node_modules' ],

      alias: {
        'video.js$': path.resolve('node_modules/video.js/core.js'),
        '@root-helpers': path.resolve('src/root-helpers'),
        '@shared/models': path.resolve('../shared/models'),
        '@shared/core-utils': path.resolve('../shared/core-utils')
      },

      fallback: {
        fs: [ path.resolve('src/shims/noop.ts') ],
        http: [ path.resolve('src/shims/http.ts') ],
        https: [ path.resolve('src/shims/https.ts') ],
        path: [ path.resolve('src/shims/path.ts') ],
        stream: [ path.resolve('src/shims/noop.ts') ],
        crypto: [ path.resolve('src/shims/noop.ts') ]
      }
    },

    output: {
      path: helpers.root('dist/standalone/videos'),

      filename: process.env.ANALYZE_BUNDLE === 'true'
        ? '[name].bundle.js'
        : '[name].[contenthash].bundle.js',

      sourceMapFilename: '[file].map',

      chunkFilename: process.env.ANALYZE_BUNDLE === 'true'
        ? '[name].chunk.js'
        : '[id].[contenthash].chunk.js',

      publicPath: '/client/standalone/videos/'
    },

    devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',

    module: {

      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'tsconfig.base.json'
              }
            }
          ]
        },

        {
          test: /\.(sass|scss)$/,
          use: [
            MiniCssExtractPlugin.loader,

            {
              loader: 'css-loader',
              options: {
                sourceMap: true,
                importLoaders: 1
              }
            },

            {
              loader: 'sass-loader',
              options: {
                sassOptions: {
                  sourceMap: true,
                  includePaths: [
                    helpers.root('src/sass/include')
                  ]
                }
              }
            }
          ]
        },

        {
          test: /\.html$/,
          use: 'raw-loader',
          exclude: [
            helpers.root('src/index.html'),
            helpers.root('src/standalone/videos/embed.html'),
            helpers.root('src/standalone/videos/test-embed.html')
          ]
        },

        {
          test: /\.(jpg|png|gif)$/,
          use: 'url-loader'
        },

        { test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/, use: 'url-loader?limit=10000&minetype=application/font-woff' },
        { test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/, use: 'file-loader' }
      ]

    },

    plugins: [
      new ProvidePlugin({
        process: 'process/browser',
        Buffer: [ 'buffer', 'Buffer' ]
      }),

      new MiniCssExtractPlugin({
        filename: process.env.ANALYZE_BUNDLE === 'true'
          ? '[name].css'
          : '[name].[contenthash].css'
      }),

      new HtmlWebpackPlugin({
        template: 'src/standalone/videos/embed.html',
        filename: 'embed.html',
        title: 'PeerTube',
        chunksSortMode: 'auto',
        inject: 'body',
        chunks: [ 'video-embed' ],
        minify: {
          collapseWhitespace: true,
          removeComments: false,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true
        }
      }),

      new HtmlWebpackPlugin({
        template: '!!html-loader!src/standalone/videos/test-embed.html',
        filename: 'test-embed.html',
        title: 'PeerTube',
        chunksSortMode: 'auto',
        inject: 'body',
        chunks: [ 'test-embed' ]
      }),

      /**
       * Plugin LoaderOptionsPlugin (experimental)
       *
       * See: https://gist.github.com/sokra/27b24881210b56bbaff7
       */
      new LoaderOptionsPlugin({
        options: {
          context: __dirname,
          output: {
            path: helpers.root('dist')
          }
        }
      })
    ],

    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            ecma: 6,
            warnings: false,
            ie8: false,
            mangle: true,
            compress: {
              passes: 3,
              pure_getters: true
            },
            output: {
              ascii_only: true,
              comments: false
            }
          }
        })
      ]
    },

    performance: {
      maxEntrypointSize: 700000, // 600kB
      maxAssetSize: 700000
    },

    node: {
      global: true
    }
  }

  return configuration
}

const helpers = require('./helpers')
const path = require('path')

const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const PurifyCSSPlugin = require('purifycss-webpack')

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

      modules: [ helpers.root('src'), helpers.root('node_modules') ],

      alias: {
        'video.js$': path.resolve('node_modules/video.js/core.js'),
        '@root-helpers': path.resolve('src/root-helpers'),
        '@shared/models': path.resolve('../shared/models'),
        '@shared/core-utils': path.resolve('../shared/core-utils')
      }
    },

    output: {
      path: helpers.root('dist/standalone/videos'),

      filename: process.env.ANALYZE_BUNDLE === 'true'
        ? '[name].bundle.js'
        : '[name].[hash].bundle.js',

      sourceMapFilename: '[file].map',
      chunkFilename: '[id].[hash].chunk.js',
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
          use: ExtractTextPlugin.extract({
            fallback: 'style-loader',
            use: [
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
          })
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
      new ExtractTextPlugin({
        filename: process.env.ANALYZE_BUNDLE === 'true'
          ? '[name].css'
          : '[name].[hash].css'
      }),

      new PurifyCSSPlugin({
        paths: [
          helpers.root('src/standalone/videos/embed.ts'),
          helpers.root('src/standalone/videos/test-embed.html')
        ],
        purifyOptions: {
          minify: true,
          whitelist: [ '*vjs*', '*video-js*' ]
        }
      }),

      new HtmlWebpackPlugin({
        template: 'src/standalone/videos/embed.html',
        filename: 'embed.html',
        title: 'PeerTube',
        chunksSortMode: 'auto',
        inject: 'body',
        chunks: ['video-embed']
      }),

      new HtmlWebpackPlugin({
        template: '!!html-loader!src/standalone/videos/test-embed.html',
        filename: 'test-embed.html',
        title: 'PeerTube',
        chunksSortMode: 'auto',
        inject: 'body',
        chunks: ['test-embed']
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
      global: true,
      crypto: 'empty',
      fs: 'empty',
      process: true,
      module: false,
      clearImmediate: false,
      setImmediate: false
    }
  }

  return configuration
}

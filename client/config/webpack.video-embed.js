const helpers = require('./helpers')

const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin
const HtmlWebpackPlugin = require('html-webpack-plugin')
const UglifyJsPlugin = require('webpack/lib/optimize/UglifyJsPlugin')
const HashedModuleIdsPlugin = require('webpack/lib/HashedModuleIdsPlugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const PurifyCSSPlugin = require('purifycss-webpack')

module.exports = function (options) {
  const isProd = options && options.env === 'production'

  const configuration = {
    entry: {
      'video-embed': './src/standalone/videos/embed.ts'
    },

    resolve: {
      /*
       * An array of extensions that should be used to resolve modules.
       *
       * See: http://webpack.github.io/docs/configuration.html#resolve-extensions
       */
      extensions: [ '.ts', '.js', '.json', '.scss' ],

      modules: [ helpers.root('src'), helpers.root('node_modules') ]
    },

    output: {
      path: helpers.root('dist/standalone/videos'),
      filename: '[name].[hash].bundle.js',
      sourceMapFilename: '[file].map',
      chunkFilename: '[id].chunk.js',
      publicPath: '/client/standalone/videos/'
    },

    module: {

      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'awesome-typescript-loader',
              options: {
                configFileName: 'tsconfig.webpack.json',
                useCache: !isProd
              }
            }
          ],
          exclude: [/\.(spec|e2e)\.ts$/]
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
              'resolve-url-loader',
              {
                loader: 'sass-loader',
                options: {
                  sourceMap: true
                }
              },
              {
                loader: 'sass-resources-loader',
                options: {
                  resources: [
                    helpers.root('src/sass/_variables.scss'),
                    helpers.root('src/sass/_mixins.scss')
                  ]
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
            helpers.root('src/standalone/videos/embed.html')
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
        filename: '[name].[contenthash].css'
      }),

      new PurifyCSSPlugin({
        paths: [ helpers.root('src/standalone/videos/embed.ts') ],
        purifyOptions: {
          minify: true,
          whitelist: [ '*vjs*', '*video-js*' ]
        }
      }),

      new CheckerPlugin(),

      new HtmlWebpackPlugin({
        template: 'src/standalone/videos/embed.html',
        filename: 'embed.html',
        title: 'PeerTube',
        chunksSortMode: 'dependency',
        inject: 'body'
      })
    ],

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

  if (isProd) {
    configuration.module.rules.push(
      {
        test: /junk\/index\.js$/,
        // exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [ 'env' ]
          }
        }
      }
   )

    configuration.plugins.push(
      new UglifyJsPlugin({
        beautify: false,
        output: {
          comments: false
        }, // prod
        mangle: {
          screw_ie8: true
        }, // prod
        compress: {
          screw_ie8: true,
          warnings: false,
          conditionals: true,
          unused: true,
          comparisons: true,
          sequences: true,
          dead_code: true,
          evaluate: true,
          if_return: true,
          join_vars: true,
          negate_iife: false // we need this for lazy v8
        }
      }),

      new HashedModuleIdsPlugin()
    )
  }

  return configuration
}

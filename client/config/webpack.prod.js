/**
 * @author: @AngularClass
 */

const helpers = require('./helpers')
const webpackMerge = require('webpack-merge') // used to merge webpack configs
const commonConfig = require('./webpack.common.js') // the settings that are common to prod and dev
const videoEmbedConfig = require('./webpack.video-embed.js')

/**
 * Webpack Plugins
 */
const DefinePlugin = require('webpack/lib/DefinePlugin')
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin')
const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin')
const OptimizeJsPlugin = require('optimize-js-plugin')
const HashedModuleIdsPlugin = require('webpack/lib/HashedModuleIdsPlugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
/**
 * Webpack Constants
 */
const ENV = process.env.NODE_ENV = process.env.ENV = 'production'
const HOST = process.env.HOST || 'localhost'
const PORT = process.env.PORT || 8080
const AOT = process.env.BUILD_AOT || helpers.hasNpmFlag('aot')
const METADATA = {
  host: HOST,
  port: PORT,
  ENV: ENV,
  HMR: false,
  AOT: AOT,
  API_URL: ''
}

module.exports = function (env) {
  return [
    videoEmbedConfig({ env: ENV }),

    webpackMerge(commonConfig({ env: ENV }), {
      /**
      * Developer tool to enhance debugging
      *
      * See: http://webpack.github.io/docs/configuration.html#devtool
      * See: https://github.com/webpack/docs/wiki/build-performance#sourcemaps
      */
      devtool: 'source-map',

      /**
      * Options affecting the output of the compilation.
      *
      * See: http://webpack.github.io/docs/configuration.html#output
      */
      output: {

        /**
        * The output directory as absolute path (required).
        *
        * See: http://webpack.github.io/docs/configuration.html#output-path
        */
        path: helpers.root('dist'),

        /**
        * Specifies the name of each output file on disk.
        * IMPORTANT: You must not specify an absolute path here!
        *
        * See: http://webpack.github.io/docs/configuration.html#output-filename
        */
        filename: '[name].[chunkhash].bundle.js',

        /**
        * The filename of the SourceMaps for the JavaScript files.
        * They are inside the output.path directory.
        *
        * See: http://webpack.github.io/docs/configuration.html#output-sourcemapfilename
        */
        sourceMapFilename: '[file].map',

        /**
        * The filename of non-entry chunks as relative path
        * inside the output.path directory.
        *
        * See: http://webpack.github.io/docs/configuration.html#output-chunkfilename
        */
        chunkFilename: '[name].[chunkhash].chunk.js',

        publicPath: '/client/'
      },

      module: {
        rules: [
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
        ]
      },

      /**
       * Add additional plugins to the compiler.
       *
       * See: http://webpack.github.io/docs/configuration.html#plugins
       */
      plugins: [

        /**
         * Webpack plugin to optimize a JavaScript file for faster initial load
         * by wrapping eagerly-invoked functions.
         *
         * See: https://github.com/vigneshshanmugam/optimize-js-plugin
         */

        new OptimizeJsPlugin({
          sourceMap: false
        }),

        /**
         * Plugin: DedupePlugin
         * Description: Prevents the inclusion of duplicate code into your bundle
         * and instead applies a copy of the function at runtime.
         *
         * See: https://webpack.github.io/docs/list-of-plugins.html#defineplugin
         * See: https://github.com/webpack/docs/wiki/optimization#deduplication
         */
        // new DedupePlugin(),

        /**
         * Plugin: DefinePlugin
         * Description: Define free variables.
         * Useful for having development builds with debug logging or adding global constants.
         *
         * Environment helpers
         *
         * See: https://webpack.github.io/docs/list-of-plugins.html#defineplugin
         */
        // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
        new DefinePlugin({
          'ENV': JSON.stringify(METADATA.ENV),
          'HMR': METADATA.HMR,
          'API_URL': JSON.stringify(METADATA.API_URL),
          'AOT': METADATA.AOT,
          'process.version': JSON.stringify(process.version),
          'process.env.ENV': JSON.stringify(METADATA.ENV),
          'process.env.NODE_ENV': JSON.stringify(METADATA.ENV),
          'process.env.HMR': METADATA.HMR
        }),

        /**
        * Plugin: UglifyJsPlugin
        * Description: Minimize all JavaScript output of chunks.
        * Loaders are switched into minimizing mode.
        *
        * See: https://webpack.github.io/docs/list-of-plugins.html#uglifyjsplugin
        */
        // NOTE: To debug prod builds uncomment //debug lines and comment //prod lines
        new UglifyJsPlugin({
          parallel: true,
          uglifyOptions: {
            ie8: false,
            ecma: 6,
            warnings: true,
            mangle: true,
            output: {
              comments: false,
              beautify: false
            }
          },
          warnings: true
        }),

        /**
         * Plugin: NormalModuleReplacementPlugin
         * Description: Replace resources that matches resourceRegExp with newResource
         *
         * See: http://webpack.github.io/docs/list-of-plugins.html#normalmodulereplacementplugin
         */
        new NormalModuleReplacementPlugin(
          /(angular2|@angularclass)((\\|\/)|-)hmr/,
          helpers.root('config/empty.js')
        ),

        new NormalModuleReplacementPlugin(
          /zone\.js(\\|\/)dist(\\|\/)long-stack-trace-zone/,
          helpers.root('config/empty.js')
        ),

        new HashedModuleIdsPlugin(),

        /**
        * AoT
        */
        (AOT ? (
          new NormalModuleReplacementPlugin(
            /@angular(\\|\/)compiler/,
            helpers.root('config/empty.js')
          )
        ) : (new LoaderOptionsPlugin({}))),

        /**
        * Plugin LoaderOptionsPlugin (experimental)
        *
        * See: https://gist.github.com/sokra/27b24881210b56bbaff7
        */
        new LoaderOptionsPlugin({
          minimize: true,
          debug: false,
          options: {

            /**
            * Static analysis linter for TypeScript advanced options configuration
            * Description: An extensible linter for the TypeScript language.
            *
            * See: https://github.com/wbuchwalter/tslint-loader
            */
            tslint: {
              emitErrors: true,
              failOnHint: true,
              resourcePath: 'src'
            },

            /**
            * Html loader advanced options
            *
            * See: https://github.com/webpack/html-loader#advanced-options
            */
            // TODO: Need to workaround Angular 2's html syntax => #id [bind] (event) *ngFor
            htmlLoader: {
              minimize: true,
              removeAttributeQuotes: false,
              caseSensitive: true,
              customAttrSurround: [
                [/#/, /(?:)/],
                [/\*/, /(?:)/],
                [/\[?\(?/, /(?:)/]
              ],
              customAttrAssign: [/\)?]?=/]
            },

            // FIXME: Remove
            // https://github.com/bholloway/resolve-url-loader/issues/36
            // https://github.com/jtangelder/sass-loader/issues/289
            context: __dirname,
            output: {
              path: helpers.root('dist')
            }
          }
        })
      ],

      /*
      * Include polyfills or mocks for various node stuff
      * Description: Node configuration
      *
      * See: https://webpack.github.io/docs/configuration.html#node
      */
      node: {
        global: true,
        crypto: 'empty',
        fs: 'empty',
        process: true,
        module: false,
        clearImmediate: false,
        setImmediate: false
      }

    })
  ]
}

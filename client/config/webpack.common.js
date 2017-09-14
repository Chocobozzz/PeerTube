const helpers = require('./helpers')

/*
 * Webpack Plugins
 */

const AssetsPlugin = require('assets-webpack-plugin')
const ContextReplacementPlugin = require('webpack/lib/ContextReplacementPlugin')
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin')
const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin
const HtmlWebpackPlugin = require('html-webpack-plugin')
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin')
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin')
const ngcWebpack = require('ngc-webpack')

const WebpackNotifierPlugin = require('webpack-notifier')

const HMR = helpers.hasProcessFlag('hot')
const AOT = process.env.BUILD_AOT || helpers.hasNpmFlag('aot')
const METADATA = {
  title: 'PeerTube',
  baseUrl: '/',
  isDevServer: helpers.isWebpackDevServer(),
  HMR: HMR,
  AOT: AOT
}

/*
 * Webpack configuration
 *
 * See: http://webpack.github.io/docs/configuration.html#cli
 */
module.exports = function (options) {
  const isProd = options.env === 'production'
  const AOT = isProd

  return {

    /*
     * Cache generated modules and chunks to improve performance for multiple incremental builds.
     * This is enabled by default in watch mode.
     * You can pass false to disable it.
     *
     * See: http://webpack.github.io/docs/configuration.html#cache
     */
    // cache: false,

    /*
     * The entry point for the bundle
     * Our Angular.js app
     *
     * See: http://webpack.github.io/docs/configuration.html#entry
     */
    entry: {
      'polyfills': './src/polyfills.browser.ts',
      'main': AOT
              ? './src/main.browser.aot.ts'
              : './src/main.browser.ts'
    },

    /*
     * Options affecting the resolving of modules.
     *
     * See: http://webpack.github.io/docs/configuration.html#resolve
     */
    resolve: {
      /*
       * An array of extensions that should be used to resolve modules.
       *
       * See: http://webpack.github.io/docs/configuration.html#resolve-extensions
       */
      extensions: [ '.ts', '.js', '.json', '.scss' ],

      modules: [ helpers.root('src'), helpers.root('node_modules') ]
    },

    /*
     * Options affecting the normal modules.
     *
     * See: http://webpack.github.io/docs/configuration.html#module
     */
    module: {

      rules: [

        /*
         * Typescript loader support for .ts and Angular async routes via .async.ts
         *
         * See: https://github.com/s-panferov/awesome-typescript-loader
         */
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ng-router-loader',
              options: {
                loader: 'async-import',
                genDir: 'compiled',
                aot: AOT
              }
            },
            {
              loader: 'awesome-typescript-loader',
              options: {
                configFileName: 'tsconfig.webpack.json',
                useCache: !isProd
              }
            },
            {
              loader: 'angular2-template-loader'
            }
          ],
          exclude: [/\.(spec|e2e)\.ts$/]
        },

        /*
         * Json loader support for *.json files.
         *
         * See: https://github.com/webpack/json-loader
         */
        {
          test: /\.json$/,
          use: 'json-loader'
        },

        {
          test: /\.(sass|scss)$/,
          use: [
            'css-to-string-loader',
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
                  helpers.root('src/sass/_variables.scss')
                ]
              }
            }
          ]
        },
        { test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/, use: 'url-loader?limit=10000&minetype=application/font-woff' },
        { test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/, use: 'file-loader' },

        /* Raw loader support for *.html
         * Returns file content as string
         *
         * See: https://github.com/webpack/raw-loader
         */
        {
          test: /\.html$/,
          use: 'raw-loader',
          exclude: [
            helpers.root('src/index.html'),
            helpers.root('src/standalone/videos/embed.html')
          ]
        },

        /* File loader for supporting images, for example, in CSS files.
         */
        {
          test: /\.(jpg|png|gif)$/,
          use: 'url-loader'
        }

      ]

    },

    /*
     * Add additional plugins to the compiler.
     *
     * See: http://webpack.github.io/docs/configuration.html#plugins
     */
    plugins: [
      new AssetsPlugin({
        path: helpers.root('dist'),
        filename: 'webpack-assets.json',
        prettyPrint: true
      }),

      /*
       * Plugin: ForkCheckerPlugin
       * Description: Do type checking in a separate process, so webpack don't need to wait.
       *
       * See: https://github.com/s-panferov/awesome-typescript-loader#forkchecker-boolean-defaultfalse
       */
      new CheckerPlugin(),

      /*
       * Plugin: CommonsChunkPlugin
       * Description: Shares common code between the pages.
       * It identifies common modules and put them into a commons chunk.
       *
       * See: https://webpack.github.io/docs/list-of-plugins.html#commonschunkplugin
       * See: https://github.com/webpack/docs/wiki/optimization#multi-page-app
       */
      new CommonsChunkPlugin({
        name: 'polyfills',
        chunks: ['polyfills']
      }),

      // This enables tree shaking of the vendor modules
      new CommonsChunkPlugin({
        name: 'vendor',
        chunks: ['main'],
        minChunks: module => /node_modules\//.test(module.resource)
      }),

      // Specify the correct order the scripts will be injected in
      new CommonsChunkPlugin({
        name: ['polyfills', 'vendor'].reverse()
      }),

      /**
       * Plugin: ContextReplacementPlugin
       * Description: Provides context to Angular's use of System.import
       *
       * See: https://webpack.github.io/docs/list-of-plugins.html#contextreplacementplugin
       * See: https://github.com/angular/angular/issues/11580
       */
      new ContextReplacementPlugin(
        /**
         * The (\\|\/) piece accounts for path separators in *nix and Windows
         */
        /(.+)?angular(\\|\/)core(.+)?/,
        helpers.root('src'), // location of your src
        {
          /**
           * Your Angular Async Route paths relative to this root directory
           */
        }
      ),

      /*
       * Plugin: ScriptExtHtmlWebpackPlugin
       * Description: Enhances html-webpack-plugin functionality
       * with different deployment options for your scripts including:
       *
       * See: https://github.com/numical/script-ext-html-webpack-plugin
       */
      new ScriptExtHtmlWebpackPlugin({
        sync: [ /polyfill|vendor/ ],
        defaultAttribute: 'async',
        preload: [/polyfill|vendor|main/],
        prefetch: [/chunk/]
      }),

      /*
       * Plugin: HtmlWebpackPlugin
       * Description: Simplifies creation of HTML files to serve your webpack bundles.
       * This is especially useful for webpack bundles that include a hash in the filename
       * which changes every compilation.
       *
       * See: https://github.com/ampedandwired/html-webpack-plugin
       */
      new HtmlWebpackPlugin({
        template: 'src/index.html',
        title: METADATA.title,
        chunksSortMode: function (a, b) {
          const entryPoints = [ 'inline', 'polyfills', 'sw-register', 'styles', 'vendor', 'main' ]
          return entryPoints.indexOf(a.names[0]) - entryPoints.indexOf(b.names[0])
        },
        metadata: METADATA,
        inject: 'body'
      }),

      new WebpackNotifierPlugin({ alwaysNotify: true }),

      /**
      * Plugin LoaderOptionsPlugin (experimental)
      *
      * See: https://gist.github.com/sokra/27b24881210b56bbaff7
      */
      new LoaderOptionsPlugin({
        options: {
          sassLoader: {
            precision: 10,
            includePaths: [ helpers.root('src/sass') ]
          }
        }
      }),

      new ngcWebpack.NgcWebpackPlugin({
        disabled: !AOT,
        tsConfig: helpers.root('tsconfig.webpack.json')
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
      process: true,
      module: false,
      clearImmediate: false,
      setImmediate: false,
      setInterval: false,
      setTimeout: false
    }
  }
}

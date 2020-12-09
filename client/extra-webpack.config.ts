import { existsSync } from 'fs-extra';
const path = require('path')
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')
process.env['NODE_CONFIG_DIR'] = path.resolve(__dirname, '..', 'config')
const config = require('config')

const fileName = 'icon-512x512.png'
const logo = [
  path.resolve('..', config.get('storage.client_overrides'), 'icons', fileName),
  path.resolve('src/assets/images/icons', fileName)
]
.find(p => existsSync(p))

console.log(`Creating manifest assets with ${logo} as source image.`)

export default {
  plugins: [
    new FaviconsWebpackPlugin({
      cache: true,
      devMode: 'webapp',
      logo,
      inject: false,
      publicPath: '/client',
      favicons: {
        appName: config.instance.name,
        appDescription: config.instance.short_description,
        developerName: '',
        developerURL: null,
        background: '#ddd',
        theme_color: '#333',
        path: '/client/',
        icons: {
          coast: false,
          yandex: false
        }
      }
    })
  ]
}

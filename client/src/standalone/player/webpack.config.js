const path = require('path')

module.exports = [
  {
    mode: 'production',
    entry: './dist/player.js',
    output: {
      filename: 'player.min.js',
      path: path.resolve(__dirname, 'build')
    }
  }
]

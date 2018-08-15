const path = require('path')

// Helper functions
const ROOT = path.resolve(__dirname, '..')
const EVENT = process.env.npm_lifecycle_event || ''

function hasProcessFlag (flag) {
  return process.argv.join('').indexOf(flag) > -1
}

function hasNpmFlag (flag) {
  return EVENT.includes(flag)
}

function isWebpackDevServer () {
  return process.argv[1] && !!(/webpack-dev-server$/.exec(process.argv[1]))
}

function root (args) {
  args = Array.prototype.slice.call(arguments, 0)
  return path.join.apply(path, [ROOT].concat(args))
}

exports.hasProcessFlag = hasProcessFlag
exports.hasNpmFlag = hasNpmFlag
exports.isWebpackDevServer = isWebpackDevServer
exports.root = root

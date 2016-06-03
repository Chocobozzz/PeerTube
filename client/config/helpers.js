const path = require('path')

const ROOT = path.resolve(__dirname, '..')

console.log('root directory:', root() + '\n')

function hasProcessFlag (flag) {
  return process.argv.join('').indexOf(flag) > -1
}

function root (args) {
  args = Array.prototype.slice.call(arguments, 0)
  return path.join.apply(path, [ROOT].concat(args))
}

exports.hasProcessFlag = hasProcessFlag
exports.root = root

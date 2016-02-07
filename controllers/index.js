'use strict'

var constants = require('../initializers/constants')

module.exports = {
  api: require('./api/' + constants.API_VERSION),
  views: require('./views')
}

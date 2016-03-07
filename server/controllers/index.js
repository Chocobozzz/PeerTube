'use strict'

var constants = require('../initializers/constants')

var apiController = require('./api/' + constants.API_VERSION)

module.exports = {
  api: apiController
}

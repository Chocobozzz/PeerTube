'use strict'

const constants = require('../initializers/constants')

const apiController = require('./api/' + constants.API_VERSION)

module.exports = {
  api: apiController
}

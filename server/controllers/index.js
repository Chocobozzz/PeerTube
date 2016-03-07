'use strict'

var constants = require('../initializers/constants')

var apiController = require('./api/' + constants.API_VERSION)
var viewsController = require('./views')

module.exports = {
  api: apiController,
  views: viewsController
}

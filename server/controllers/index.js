'use strict'

const apiController = require('./api/')
const clientController = require('./client')
const staticController = require('./static')

module.exports = {
  api: apiController,
  client: clientController,
  static: staticController
}

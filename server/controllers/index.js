'use strict'

const apiController = require('./api/')
const clientController = require('./client')

module.exports = {
  api: apiController,
  client: clientController
}

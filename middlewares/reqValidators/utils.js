;(function () {
  'use strict'

  var util = require('util')
  var logger = require('../../src/logger')

  var utils = {}

  utils.checkErrors = function (req, res, next, status_code) {
    if (status_code === undefined) status_code = 400
    var errors = req.validationErrors()

    if (errors) {
      logger.warn('Incorrect request parameters', { path: req.originalUrl, err: errors })
      return res.status(status_code).send('There have been validation errors: ' + util.inspect(errors))
    }

    return next()
  }

  module.exports = utils
})()

;(function () {
  'use strict'

  var express = require('express')

  var middleware = require('../middlewares').misc

  var router = express.Router()

  router.get(/^\/(index)?$/, middleware.cache(), getIndex)
  router.get('/partials/:directory/:name', middleware.cache(), getPartial)

  // ---------------------------------------------------------------------------

  module.exports = router

  // ---------------------------------------------------------------------------

  function getIndex (req, res) {
    res.render('index')
  }

  function getPartial (req, res) {
    var directory = req.params.directory
    var name = req.params.name

    res.render('partials/' + directory + '/' + name)
  }
})()

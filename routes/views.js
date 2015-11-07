;(function () {
  'use strict'

  function getPartial (req, res) {
    var directory = req.params.directory
    var name = req.params.name

    res.render('partials/' + directory + '/' + name)
  }

  function getIndex (req, res) {
    res.render('index')
  }

  var express = require('express')
  var middleware = require('../middlewares')

  var router = express.Router()

  router.get('/partials/:directory/:name', middleware.cache(), getPartial)
  router.get(/^\/(index)?$/, middleware.cache(), getIndex)

  module.exports = router
})()

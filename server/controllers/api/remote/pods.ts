import express = require('express')
import * as waterfall from 'async/waterfall'

import { database as db } from '../../../initializers/database'
import { checkSignature, signatureValidator } from '../../../middlewares'

const remotePodsRouter = express.Router()

// Post because this is a secured request
remotePodsRouter.post('/remove',
  signatureValidator,
  checkSignature,
  removePods
)

// ---------------------------------------------------------------------------

export {
  remotePodsRouter
}

// ---------------------------------------------------------------------------

function removePods (req, res, next) {
  const host = req.body.signature.host

  waterfall([
    function loadPod (callback) {
      db.Pod.loadByHost(host, callback)
    },

    function deletePod (pod, callback) {
      pod.destroy().asCallback(callback)
    }
  ], function (err) {
    if (err) return next(err)

    return res.type('json').status(204).end()
  })
}

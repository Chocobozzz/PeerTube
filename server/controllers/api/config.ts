import * as express from 'express'

import { CONFIG } from '../../initializers'

const configRouter = express.Router()

configRouter.get('/', getConfig)

// Get the client credentials for the PeerTube front end
function getConfig (req, res, next) {
  res.json({
    signup: {
      enabled: CONFIG.SIGNUP.ENABLED
    }
  })
}

// ---------------------------------------------------------------------------

export {
  configRouter
}

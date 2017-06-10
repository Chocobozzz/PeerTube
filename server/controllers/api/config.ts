import * as express from 'express'

import { CONFIG } from '../../initializers'

const configRouter = express.Router()

configRouter.get('/', getConfig)

// Get the client credentials for the PeerTube front end
function getConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
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

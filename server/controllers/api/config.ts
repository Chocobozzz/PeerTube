import * as express from 'express'

import { CONFIG } from '../../initializers'
import { ServerConfig } from '../../../shared'

const configRouter = express.Router()

configRouter.get('/', getConfig)

// Get the client credentials for the PeerTube front end
function getConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
  const json: ServerConfig = {
    signup: {
      enabled: CONFIG.SIGNUP.ENABLED
    }
  }
  res.json(json)
}

// ---------------------------------------------------------------------------

export {
  configRouter
}

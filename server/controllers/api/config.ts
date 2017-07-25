import * as express from 'express'

import { isSignupAllowed } from '../../helpers'
import { ServerConfig } from '../../../shared'

const configRouter = express.Router()

configRouter.get('/', getConfig)

// Get the client credentials for the PeerTube front end
function getConfig (req: express.Request, res: express.Response, next: express.NextFunction) {

  isSignupAllowed().then(allowed => {
    const json: ServerConfig = {
      signup: {
        allowed
      }
    }
    res.json(json)
  })
}

// ---------------------------------------------------------------------------

export {
  configRouter
}

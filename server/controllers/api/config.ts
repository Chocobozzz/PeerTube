import * as express from 'express'
import { isSignupAllowed } from '../../helpers/utils'

import { CONFIG } from '../../initializers'
import { asyncMiddleware } from '../../middlewares'
import { ServerConfig } from '../../../shared'

const configRouter = express.Router()

configRouter.get('/',
  asyncMiddleware(getConfig)
)

async function getConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
  const allowed = await isSignupAllowed()

  const enabledResolutions = Object.keys(CONFIG.TRANSCODING.RESOLUTIONS)
   .filter(key => CONFIG.TRANSCODING.RESOLUTIONS[key] === true)
   .map(r => parseInt(r, 10))

  const json: ServerConfig = {
    signup: {
      allowed
    },
    transcoding: {
      enabledResolutions
    }
  }

  return res.json(json)
}

// ---------------------------------------------------------------------------

export {
  configRouter
}

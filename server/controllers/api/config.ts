import * as express from 'express'

import { isSignupAllowed } from '../../helpers'
import { CONFIG } from '../../initializers'
import { ServerConfig } from '../../../shared'

const configRouter = express.Router()

configRouter.get('/', getConfig)

function getConfig (req: express.Request, res: express.Response, next: express.NextFunction) {

  isSignupAllowed().then(allowed => {
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

    res.json(json)
  })
}

// ---------------------------------------------------------------------------

export {
  configRouter
}

import * as express from 'express'
import { omit } from 'lodash'
import { ServerConfig, UserRight } from '../../../shared'
import { About } from '../../../shared/models/server/about.model'
import { CustomConfig } from '../../../shared/models/server/custom-config.model'
import { unlinkPromise, writeFilePromise } from '../../helpers/core-utils'
import { isSignupAllowed } from '../../helpers/utils'
import { CONFIG, CONSTRAINTS_FIELDS, reloadConfig } from '../../initializers'
import { asyncMiddleware, authenticate, ensureUserHasRight } from '../../middlewares'
import { customConfigUpdateValidator } from '../../middlewares/validators/config'

const packageJSON = require('../../../../package.json')
const configRouter = express.Router()

configRouter.get('/about', getAbout)
configRouter.get('/',
  asyncMiddleware(getConfig)
)

configRouter.get('/custom',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  asyncMiddleware(getCustomConfig)
)
configRouter.put('/custom',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  asyncMiddleware(customConfigUpdateValidator),
  asyncMiddleware(updateCustomConfig)
)
configRouter.delete('/custom',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  asyncMiddleware(deleteCustomConfig)
)

async function getConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
  const allowed = await isSignupAllowed()

  const enabledResolutions = Object.keys(CONFIG.TRANSCODING.RESOLUTIONS)
   .filter(key => CONFIG.TRANSCODING.RESOLUTIONS[key] === true)
   .map(r => parseInt(r, 10))

  const json: ServerConfig = {
    instance: {
      name: CONFIG.INSTANCE.NAME,
      shortDescription: CONFIG.INSTANCE.SHORT_DESCRIPTION,
      defaultClientRoute: CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,
      customizations: {
        javascript: CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT,
        css: CONFIG.INSTANCE.CUSTOMIZATIONS.CSS
      }
    },
    serverVersion: packageJSON.version,
    signup: {
      allowed
    },
    transcoding: {
      enabledResolutions
    },
    avatar: {
      file: {
        size: {
          max: CONSTRAINTS_FIELDS.ACTORS.AVATAR.FILE_SIZE.max
        },
        extensions: CONSTRAINTS_FIELDS.ACTORS.AVATAR.EXTNAME
      }
    },
    video: {
      image: {
        extensions: CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME,
        size: {
          max: CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max
        }
      },
      file: {
        extensions: CONSTRAINTS_FIELDS.VIDEOS.EXTNAME
      }
    },
    user: {
      videoQuota: CONFIG.USER.VIDEO_QUOTA
    }
  }

  return res.json(json)
}

function getAbout (req: express.Request, res: express.Response, next: express.NextFunction) {
  const about: About = {
    instance: {
      name: CONFIG.INSTANCE.NAME,
      shortDescription: CONFIG.INSTANCE.SHORT_DESCRIPTION,
      description: CONFIG.INSTANCE.DESCRIPTION,
      terms: CONFIG.INSTANCE.TERMS
    }
  }

  return res.json(about).end()
}

async function getCustomConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
  const data = customConfig()

  return res.json(data).end()
}

async function deleteCustomConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
  await unlinkPromise(CONFIG.CUSTOM_FILE)

  reloadConfig()

  const data = customConfig()

  return res.json(data).end()
}

async function updateCustomConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
  const toUpdate: CustomConfig = req.body

  // Force number conversion
  toUpdate.cache.previews.size = parseInt('' + toUpdate.cache.previews.size, 10)
  toUpdate.signup.limit = parseInt('' + toUpdate.signup.limit, 10)
  toUpdate.user.videoQuota = parseInt('' + toUpdate.user.videoQuota, 10)
  toUpdate.transcoding.threads = parseInt('' + toUpdate.transcoding.threads, 10)

  // camelCase to snake_case key
  const toUpdateJSON = omit(toUpdate, 'user.videoQuota', 'instance.defaultClientRoute', 'instance.shortDescription')
  toUpdateJSON.user['video_quota'] = toUpdate.user.videoQuota
  toUpdateJSON.instance['default_client_route'] = toUpdate.instance.defaultClientRoute
  toUpdateJSON.instance['short_description'] = toUpdate.instance.shortDescription

  await writeFilePromise(CONFIG.CUSTOM_FILE, JSON.stringify(toUpdateJSON, undefined, 2))

  reloadConfig()

  const data = customConfig()
  return res.json(data).end()
}

// ---------------------------------------------------------------------------

export {
  configRouter
}

// ---------------------------------------------------------------------------

function customConfig (): CustomConfig {
  return {
    instance: {
      name: CONFIG.INSTANCE.NAME,
      shortDescription: CONFIG.INSTANCE.SHORT_DESCRIPTION,
      description: CONFIG.INSTANCE.DESCRIPTION,
      terms: CONFIG.INSTANCE.TERMS,
      defaultClientRoute: CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,
      customizations: {
        css: CONFIG.INSTANCE.CUSTOMIZATIONS.CSS,
        javascript: CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT
      }
    },
    cache: {
      previews: {
        size: CONFIG.CACHE.PREVIEWS.SIZE
      }
    },
    signup: {
      enabled: CONFIG.SIGNUP.ENABLED,
      limit: CONFIG.SIGNUP.LIMIT
    },
    admin: {
      email: CONFIG.ADMIN.EMAIL
    },
    user: {
      videoQuota: CONFIG.USER.VIDEO_QUOTA
    },
    transcoding: {
      enabled: CONFIG.TRANSCODING.ENABLED,
      threads: CONFIG.TRANSCODING.THREADS,
      resolutions: {
        '240p': CONFIG.TRANSCODING.RESOLUTIONS[ '240p' ],
        '360p': CONFIG.TRANSCODING.RESOLUTIONS[ '360p' ],
        '480p': CONFIG.TRANSCODING.RESOLUTIONS[ '480p' ],
        '720p': CONFIG.TRANSCODING.RESOLUTIONS[ '720p' ],
        '1080p': CONFIG.TRANSCODING.RESOLUTIONS[ '1080p' ]
      }
    }
  }
}

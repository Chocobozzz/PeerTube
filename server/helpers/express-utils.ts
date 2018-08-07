import * as express from 'express'
import * as multer from 'multer'
import { CONFIG, REMOTE_SCHEME } from '../initializers'
import { logger } from './logger'
import { User } from '../../shared/models/users'
import { generateRandomString } from './utils'
import { extname } from 'path'

function buildNSFWFilter (res: express.Response, paramNSFW?: string) {
  if (paramNSFW === 'true') return true
  if (paramNSFW === 'false') return false
  if (paramNSFW === 'both') return undefined

  if (res.locals.oauth) {
    const user: User = res.locals.oauth.token.User
    // User does not want NSFW videos
    if (user && user.nsfwPolicy === 'do_not_list') return false
  }

  if (CONFIG.INSTANCE.DEFAULT_NSFW_POLICY === 'do_not_list') return false

  // Display all
  return null
}

function getHostWithPort (host: string) {
  const splitted = host.split(':')

  // The port was not specified
  if (splitted.length === 1) {
    if (REMOTE_SCHEME.HTTP === 'https') return host + ':443'

    return host + ':80'
  }

  return host
}

function badRequest (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.type('json').status(400).end()
}

function createReqFiles (
  fieldNames: string[],
  mimeTypes: { [ id: string ]: string },
  destinations: { [ fieldName: string ]: string }
) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destinations[ file.fieldname ])
    },

    filename: async (req, file, cb) => {
      const extension = mimeTypes[ file.mimetype ] || extname(file.originalname)
      let randomString = ''

      try {
        randomString = await generateRandomString(16)
      } catch (err) {
        logger.error('Cannot generate random string for file name.', { err })
        randomString = 'fake-random-string'
      }

      cb(null, randomString + extension)
    }
  })

  let fields: { name: string, maxCount: number }[] = []
  for (const fieldName of fieldNames) {
    fields.push({
      name: fieldName,
      maxCount: 1
    })
  }

  return multer({ storage }).fields(fields)
}

// ---------------------------------------------------------------------------

export {
  buildNSFWFilter,
  getHostWithPort,
  badRequest,
  createReqFiles
}

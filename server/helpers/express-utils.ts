import * as express from 'express'
import * as multer from 'multer'
import { CONFIG, REMOTE_SCHEME } from '../initializers'
import { logger } from './logger'
import { User } from '../../shared/models/users'
import { deleteFileAsync, generateRandomString } from './utils'
import { extname } from 'path'
import { isArray } from './custom-validators/misc'

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

function cleanUpReqFiles (req: { files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[] }) {
  const files = req.files

  if (!files) return

  if (isArray(files)) {
    (files as Express.Multer.File[]).forEach(f => deleteFileAsync(f.path))
    return
  }

  for (const key of Object.keys(files)) {
    const file = files[ key ]

    if (isArray(file)) file.forEach(f => deleteFileAsync(f.path))
    else deleteFileAsync(file.path)
  }
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

function isUserAbleToSearchRemoteURI (res: express.Response) {
  const user: User = res.locals.oauth ? res.locals.oauth.token.User : undefined

  return CONFIG.SEARCH.REMOTE_URI.ANONYMOUS === true ||
    (CONFIG.SEARCH.REMOTE_URI.USERS === true && user !== undefined)
}

// ---------------------------------------------------------------------------

export {
  buildNSFWFilter,
  getHostWithPort,
  isUserAbleToSearchRemoteURI,
  badRequest,
  createReqFiles,
  cleanUpReqFiles
}

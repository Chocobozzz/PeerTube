import * as express from 'express'
import * as multer from 'multer'
import { REMOTE_SCHEME } from '../initializers/constants'
import { logger } from './logger'
import { deleteFileAsync, generateRandomString } from './utils'
import { extname } from 'path'
import { isArray } from './custom-validators/misc'
import { CONFIG } from '../initializers/config'

function buildNSFWFilter (res?: express.Response, paramNSFW?: string) {
  if (paramNSFW === 'true') return true
  if (paramNSFW === 'false') return false
  if (paramNSFW === 'both') return undefined

  if (res?.locals.oauth) {
    const user = res.locals.oauth.token.User

    // User does not want NSFW videos
    if (user.nsfwPolicy === 'do_not_list') return false

    // Both
    return undefined
  }

  if (CONFIG.INSTANCE.DEFAULT_NSFW_POLICY === 'do_not_list') return false

  // Display all
  return null
}

function cleanUpReqFiles (req: { files: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] }) {
  const files = req.files

  if (!files) return

  if (isArray(files)) {
    (files as Express.Multer.File[]).forEach(f => deleteFileAsync(f.path))
    return
  }

  for (const key of Object.keys(files)) {
    const file = files[key]

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

function badRequest (req: express.Request, res: express.Response) {
  return res.type('json').status(400).end()
}

function createReqFiles (
  fieldNames: string[],
  mimeTypes: { [id: string]: string },
  destinations: { [fieldName: string]: string }
) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destinations[file.fieldname])
    },

    filename: async (req, file, cb) => {
      let extension: string
      const fileExtension = extname(file.originalname)
      const extensionFromMimetype = mimeTypes[file.mimetype]

      // Take the file extension if we don't understand the mime type
      // We have the OGG/OGV exception too because firefox sends a bad mime type when sending an OGG file
      if (fileExtension === '.ogg' || fileExtension === '.ogv' || !extensionFromMimetype) {
        extension = fileExtension
      } else {
        extension = extensionFromMimetype
      }

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

  const fields: { name: string, maxCount: number }[] = []
  for (const fieldName of fieldNames) {
    fields.push({
      name: fieldName,
      maxCount: 1
    })
  }

  return multer({ storage }).fields(fields)
}

function isUserAbleToSearchRemoteURI (res: express.Response) {
  const user = res.locals.oauth ? res.locals.oauth.token.User : undefined

  return CONFIG.SEARCH.REMOTE_URI.ANONYMOUS === true ||
    (CONFIG.SEARCH.REMOTE_URI.USERS === true && user !== undefined)
}

function getCountVideos (req: express.Request) {
  return req.query.skipCount !== true
}

// ---------------------------------------------------------------------------

export {
  buildNSFWFilter,
  getHostWithPort,
  isUserAbleToSearchRemoteURI,
  badRequest,
  createReqFiles,
  cleanUpReqFiles,
  getCountVideos
}

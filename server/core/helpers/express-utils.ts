import express, { RequestHandler } from 'express'
import multer, { diskStorage } from 'multer'
import { getLowercaseExtension } from '@peertube/peertube-node-utils'
import { CONFIG } from '../initializers/config.js'
import { REMOTE_SCHEME } from '../initializers/constants.js'
import { isArray } from './custom-validators/misc.js'
import { logger } from './logger.js'
import { deleteFileAndCatch, generateRandomString } from './utils.js'
import { getExtFromMimetype } from './video.js'

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

function cleanUpReqFiles (req: express.Request) {
  const filesObject = req.files
  if (!filesObject) return

  if (isArray(filesObject)) {
    filesObject.forEach(f => deleteFileAndCatch(f.path))
    return
  }

  for (const key of Object.keys(filesObject)) {
    const files = filesObject[key]

    files.forEach(f => deleteFileAndCatch(f.path))
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

function createReqFiles (
  fieldNames: string[],
  mimeTypes: { [id: string]: string | string[] },
  destination = CONFIG.STORAGE.TMP_DIR
): RequestHandler {
  const storage = diskStorage({
    destination: (req, file, cb) => {
      cb(null, destination)
    },

    filename: (req, file, cb) => {
      return generateReqFilename(file, mimeTypes, cb)
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

function createAnyReqFiles (
  mimeTypes: { [id: string]: string | string[] },
  fileFilter: (req: express.Request, file: Express.Multer.File, cb: (err: Error, result: boolean) => void) => void
): RequestHandler {
  const storage = diskStorage({
    destination: (req, file, cb) => {
      cb(null, CONFIG.STORAGE.TMP_DIR)
    },

    filename: (req, file, cb) => {
      return generateReqFilename(file, mimeTypes, cb)
    }
  })

  return multer({ storage, fileFilter }).any()
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
  createAnyReqFiles,
  isUserAbleToSearchRemoteURI,
  createReqFiles,
  cleanUpReqFiles,
  getCountVideos
}

// ---------------------------------------------------------------------------

async function generateReqFilename (
  file: Express.Multer.File,
  mimeTypes: { [id: string]: string | string[] },
  cb: (err: Error, name: string) => void
) {
  let extension: string
  const fileExtension = getLowercaseExtension(file.originalname)
  const extensionFromMimetype = getExtFromMimetype(mimeTypes, file.mimetype)

  // Take the file extension if we don't understand the mime type
  if (!extensionFromMimetype) {
    extension = fileExtension
  } else {
    // Take the first available extension for this mimetype
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

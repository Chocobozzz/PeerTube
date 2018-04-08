import * as express from 'express'
import * as multer from 'multer'
import { Model } from 'sequelize-typescript'
import { ResultList } from '../../shared'
import { VideoResolution } from '../../shared/models/videos'
import { CONFIG, REMOTE_SCHEME } from '../initializers'
import { UserModel } from '../models/account/user'
import { ActorModel } from '../models/activitypub/actor'
import { ApplicationModel } from '../models/application/application'
import { pseudoRandomBytesPromise } from './core-utils'
import { logger } from './logger'

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
      cb(null, destinations[file.fieldname])
    },

    filename: async (req, file, cb) => {
      const extension = mimeTypes[file.mimetype]
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

  const fields = []
  for (const fieldName of fieldNames) {
    fields.push({
      name: fieldName,
      maxCount: 1
    })
  }

  return multer({ storage }).fields(fields)
}

async function generateRandomString (size: number) {
  const raw = await pseudoRandomBytesPromise(size)

  return raw.toString('hex')
}

interface FormattableToJSON {
  toFormattedJSON ()
}

function getFormattedObjects<U, T extends FormattableToJSON> (objects: T[], objectsTotal: number) {
  const formattedObjects: U[] = []

  objects.forEach(object => {
    formattedObjects.push(object.toFormattedJSON())
  })

  const res: ResultList<U> = {
    total: objectsTotal,
    data: formattedObjects
  }

  return res
}

async function isSignupAllowed () {
  if (CONFIG.SIGNUP.ENABLED === false) {
    return false
  }

  // No limit and signup is enabled
  if (CONFIG.SIGNUP.LIMIT === -1) {
    return true
  }

  const totalUsers = await UserModel.countTotal()

  return totalUsers < CONFIG.SIGNUP.LIMIT
}

function computeResolutionsToTranscode (videoFileHeight: number) {
  const resolutionsEnabled: number[] = []
  const configResolutions = CONFIG.TRANSCODING.RESOLUTIONS

  const resolutions = [
    VideoResolution.H_240P,
    VideoResolution.H_360P,
    VideoResolution.H_480P,
    VideoResolution.H_720P,
    VideoResolution.H_1080P
  ]

  for (const resolution of resolutions) {
    if (configResolutions[resolution + 'p'] === true && videoFileHeight > resolution) {
      resolutionsEnabled.push(resolution)
    }
  }

  return resolutionsEnabled
}

function resetSequelizeInstance (instance: Model<any>, savedFields: object) {
  Object.keys(savedFields).forEach(key => {
    const value = savedFields[key]
    instance.set(key, value)
  })
}

let serverActor: ActorModel
async function getServerActor () {
  if (serverActor === undefined) {
    const application = await ApplicationModel.load()
    serverActor = application.Account.Actor
  }

  if (!serverActor) {
    logger.error('Cannot load server actor.')
    process.exit(0)
  }

  return Promise.resolve(serverActor)
}

type SortType = { sortModel: any, sortValue: string }

// ---------------------------------------------------------------------------

export {
  badRequest,
  generateRandomString,
  getFormattedObjects,
  isSignupAllowed,
  computeResolutionsToTranscode,
  resetSequelizeInstance,
  getServerActor,
  SortType,
  getHostWithPort,
  createReqFiles
}

import * as express from 'express'
import { Model } from 'sequelize-typescript'
import { ResultList } from '../../shared'
import { VideoResolution } from '../../shared/models/videos'
import { CONFIG } from '../initializers'
import { UserModel } from '../models/account/user'
import { ActorModel } from '../models/activitypub/actor'
import { ApplicationModel } from '../models/application/application'
import { pseudoRandomBytesPromise } from './core-utils'
import { logger } from './logger'

function badRequest (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.type('json').status(400).end()
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
    if (configResolutions[resolution.toString()] === true && videoFileHeight > resolution) {
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
  SortType
}

import * as express from 'express'
import * as Sequelize from 'sequelize'

import { pseudoRandomBytesPromise } from './core-utils'
import { CONFIG, database as db } from '../initializers'
import { ResultList } from '../../shared'
import { VideoResolution } from '../../shared/models/videos/video-resolution.enum'

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

  const totalUsers = await db.User.countTotal()

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

function resetSequelizeInstance (instance: Sequelize.Instance<any>, savedFields: object) {
  Object.keys(savedFields).forEach(key => {
    const value = savedFields[key]
    instance.set(key, value)
  })
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
  SortType
}

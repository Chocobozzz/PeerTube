import { Model } from 'sequelize-typescript'
import * as ipaddr from 'ipaddr.js'
import { ResultList } from '../../shared'
import { VideoResolution } from '../../shared/models/videos'
import { CONFIG } from '../initializers'
import { UserModel } from '../models/account/user'
import { ActorModel } from '../models/activitypub/actor'
import { ApplicationModel } from '../models/application/application'
import { pseudoRandomBytesPromise, unlinkPromise } from './core-utils'
import { logger } from './logger'
import { isArray } from './custom-validators/misc'
import * as crypto from "crypto"
import { join } from "path"

const isCidr = require('is-cidr')

function cleanUpReqFiles (req: { files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[] }) {
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

function deleteFileAsync (path: string) {
  unlinkPromise(path)
    .catch(err => logger.error('Cannot delete the file %s asynchronously.', path, { err }))
}

async function generateRandomString (size: number) {
  const raw = await pseudoRandomBytesPromise(size)

  return raw.toString('hex')
}

interface FormattableToJSON {
  toFormattedJSON (args?: any)
}

function getFormattedObjects<U, T extends FormattableToJSON> (objects: T[], objectsTotal: number, formattedArg?: any) {
  const formattedObjects: U[] = []

  objects.forEach(object => {
    formattedObjects.push(object.toFormattedJSON(formattedArg))
  })

  return {
    total: objectsTotal,
    data: formattedObjects
  } as ResultList<U>
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

function isSignupAllowedForCurrentIP (ip: string) {
  const addr = ipaddr.parse(ip)
  let excludeList = [ 'blacklist' ]
  let matched = ''

  // if there is a valid, non-empty whitelist, we exclude all unknown adresses too
  if (CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr(cidr)).length > 0) {
    excludeList.push('unknown')
  }

  if (addr.kind() === 'ipv4') {
    const addrV4 = ipaddr.IPv4.parse(ip)
    const rangeList = {
      whitelist: CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr.v4(cidr))
                                                .map(cidr => ipaddr.IPv4.parseCIDR(cidr)),
      blacklist: CONFIG.SIGNUP.FILTERS.CIDR.BLACKLIST.filter(cidr => isCidr.v4(cidr))
                                                .map(cidr => ipaddr.IPv4.parseCIDR(cidr))
    }
    matched = ipaddr.subnetMatch(addrV4, rangeList, 'unknown')
  } else if (addr.kind() === 'ipv6') {
    const addrV6 = ipaddr.IPv6.parse(ip)
    const rangeList = {
      whitelist: CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr.v6(cidr))
                                                .map(cidr => ipaddr.IPv6.parseCIDR(cidr)),
      blacklist: CONFIG.SIGNUP.FILTERS.CIDR.BLACKLIST.filter(cidr => isCidr.v6(cidr))
                                                .map(cidr => ipaddr.IPv6.parseCIDR(cidr))
    }
    matched = ipaddr.subnetMatch(addrV6, rangeList, 'unknown')
  }

  return !excludeList.includes(matched)
}

function computeResolutionsToTranscode (videoFileHeight: number) {
  const resolutionsEnabled: number[] = []
  const configResolutions = CONFIG.TRANSCODING.RESOLUTIONS

  // Put in the order we want to proceed jobs
  const resolutions = [
    VideoResolution.H_480P,
    VideoResolution.H_360P,
    VideoResolution.H_720P,
    VideoResolution.H_240P,
    VideoResolution.H_1080P
  ]

  for (const resolution of resolutions) {
    if (configResolutions[ resolution + 'p' ] === true && videoFileHeight > resolution) {
      resolutionsEnabled.push(resolution)
    }
  }

  return resolutionsEnabled
}

const timeTable = {
  ms:           1,
  second:       1000,
  minute:       60000,
  hour:         3600000,
  day:          3600000 * 24,
  week:         3600000 * 24 * 7,
  month:        3600000 * 24 * 30
}
export function parseDuration (duration: number | string): number {
  if (typeof duration === 'number') return duration

  if (typeof duration === 'string') {
    const split = duration.match(/^([\d\.,]+)\s?(\w+)$/)

    if (split.length === 3) {
      const len = parseFloat(split[1])
      let unit = split[2].replace(/s$/i,'').toLowerCase()
      if (unit === 'm') {
        unit = 'ms'
      }

      return (len || 1) * (timeTable[unit] || 0)
    }
  }

  throw new Error('Duration could not be properly parsed')
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
    if (!application) throw Error('Could not load Application from database.')

    serverActor = application.Account.Actor
  }

  if (!serverActor) {
    logger.error('Cannot load server actor.')
    process.exit(0)
  }

  return Promise.resolve(serverActor)
}

function generateVideoTmpPath (id: string) {
  const hash = crypto.createHash('sha256').update(id).digest('hex')
  return join(CONFIG.STORAGE.VIDEOS_DIR, hash + '-import.mp4')
}

type SortType = { sortModel: any, sortValue: string }


// ---------------------------------------------------------------------------

export {
  cleanUpReqFiles,
  deleteFileAsync,
  generateRandomString,
  getFormattedObjects,
  isSignupAllowed,
  isSignupAllowedForCurrentIP,
  computeResolutionsToTranscode,
  resetSequelizeInstance,
  getServerActor,
  SortType,
  generateVideoTmpPath
}

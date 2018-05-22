import { Model } from 'sequelize-typescript'
import * as ipaddr from 'ipaddr.js'
const isCidr = require('is-cidr')
import { ResultList } from '../../shared'
import { VideoResolution } from '../../shared/models/videos'
import { CONFIG } from '../initializers'
import { UserModel } from '../models/account/user'
import { ActorModel } from '../models/activitypub/actor'
import { ApplicationModel } from '../models/application/application'
import { pseudoRandomBytesPromise } from './core-utils'
import { logger } from './logger'

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

function isSignupAllowedForCurrentIP (ip: string) {
  const addr = ipaddr.parse(ip)
  let excludeList = [ 'blacklist' ]
  let matched: string

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
  generateRandomString,
  getFormattedObjects,
  isSignupAllowed,
  isSignupAllowedForCurrentIP,
  computeResolutionsToTranscode,
  resetSequelizeInstance,
  getServerActor,
  SortType
}

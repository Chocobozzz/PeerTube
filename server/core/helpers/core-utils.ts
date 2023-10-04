/* eslint-disable no-useless-call */

/*
  Different from 'utils' because we don't import other PeerTube modules.
  Useful to avoid circular dependencies.
*/

import { promisify1, promisify2, promisify3 } from '@peertube/peertube-core-utils'
import { exec, ExecOptions } from 'child_process'
import { ED25519KeyPairOptions, generateKeyPair, randomBytes, RSAKeyPairOptions, scrypt } from 'crypto'
import truncate from 'lodash-es/truncate.js'
import { pipeline } from 'stream'
import { URL } from 'url'
import { promisify } from 'util'

const objectConverter = (oldObject: any, keyConverter: (e: string) => string, valueConverter: (e: any) => any) => {
  if (!oldObject || typeof oldObject !== 'object') {
    return valueConverter(oldObject)
  }

  if (Array.isArray(oldObject)) {
    return oldObject.map(e => objectConverter(e, keyConverter, valueConverter))
  }

  const newObject = {}
  Object.keys(oldObject).forEach(oldKey => {
    const newKey = keyConverter(oldKey)
    newObject[newKey] = objectConverter(oldObject[oldKey], keyConverter, valueConverter)
  })

  return newObject
}

function mapToJSON (map: Map<any, any>) {
  const obj: any = {}

  for (const [ k, v ] of map) {
    obj[k] = v
  }

  return obj
}

// ---------------------------------------------------------------------------

const timeTable = {
  ms: 1,
  second: 1000,
  minute: 60000,
  hour: 3600000,
  day: 3600000 * 24,
  week: 3600000 * 24 * 7,
  month: 3600000 * 24 * 30
}

export function parseDurationToMs (duration: number | string): number {
  if (duration === null) return null
  if (typeof duration === 'number') return duration
  if (!isNaN(+duration)) return +duration

  if (typeof duration === 'string') {
    const split = duration.match(/^([\d.,]+)\s?(\w+)$/)

    if (split.length === 3) {
      const len = parseFloat(split[1])
      let unit = split[2].replace(/s$/i, '').toLowerCase()
      if (unit === 'm') {
        unit = 'ms'
      }

      return (len || 1) * (timeTable[unit] || 0)
    }
  }

  throw new Error(`Duration ${duration} could not be properly parsed`)
}

export function parseBytes (value: string | number): number {
  if (typeof value === 'number') return value
  if (!isNaN(+value)) return +value

  const tgm = /^(\d+)\s*TB\s*(\d+)\s*GB\s*(\d+)\s*MB$/
  const tg = /^(\d+)\s*TB\s*(\d+)\s*GB$/
  const tm = /^(\d+)\s*TB\s*(\d+)\s*MB$/
  const gm = /^(\d+)\s*GB\s*(\d+)\s*MB$/
  const t = /^(\d+)\s*TB$/
  const g = /^(\d+)\s*GB$/
  const m = /^(\d+)\s*MB$/
  const b = /^(\d+)\s*B$/

  let match: RegExpMatchArray

  if (value.match(tgm)) {
    match = value.match(tgm)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024 * 1024 +
      parseInt(match[3], 10) * 1024 * 1024
  }

  if (value.match(tg)) {
    match = value.match(tg)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024 * 1024
  }

  if (value.match(tm)) {
    match = value.match(tm)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024
  }

  if (value.match(gm)) {
    match = value.match(gm)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024
  }

  if (value.match(t)) {
    match = value.match(t)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024
  }

  if (value.match(g)) {
    match = value.match(g)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024
  }

  if (value.match(m)) {
    match = value.match(m)
    return parseInt(match[1], 10) * 1024 * 1024
  }

  if (value.match(b)) {
    match = value.match(b)
    return parseInt(match[1], 10) * 1024
  }

  return parseInt(value, 10)
}

// ---------------------------------------------------------------------------

function sanitizeUrl (url: string) {
  const urlObject = new URL(url)

  if (urlObject.protocol === 'https:' && urlObject.port === '443') {
    urlObject.port = ''
  } else if (urlObject.protocol === 'http:' && urlObject.port === '80') {
    urlObject.port = ''
  }

  return urlObject.href.replace(/\/$/, '')
}

// Don't import remote scheme from constants because we are in core utils
function sanitizeHost (host: string, remoteScheme: string) {
  const toRemove = remoteScheme === 'https' ? 443 : 80

  return host.replace(new RegExp(`:${toRemove}$`), '')
}

// ---------------------------------------------------------------------------

// Consistent with .length, lodash truncate function is not
function peertubeTruncate (str: string, options: { length: number, separator?: RegExp, omission?: string }) {
  const truncatedStr = truncate(str, options)

  // The truncated string is okay, we can return it
  if (truncatedStr.length <= options.length) return truncatedStr

  // Lodash takes into account all UTF characters, whereas String.prototype.length does not: some characters have a length of 2
  // We always use the .length so we need to truncate more if needed
  options.length -= truncatedStr.length - options.length
  return truncate(str, options)
}

function pageToStartAndCount (page: number, itemsPerPage: number) {
  const start = (page - 1) * itemsPerPage

  return { start, count: itemsPerPage }
}

// ---------------------------------------------------------------------------

type SemVersion = { major: number, minor: number, patch: number }

/**
 * Parses a semantic version string into its separate components.
 * Fairly lax, and allows for missing or additional segments in the string.
 *
 * @param s String to parse semantic version from.
 * @returns Major, minor, and patch version, or null if string does not follow semantic version conventions.
 */
function parseSemVersion (s: string) {
  const parsed = s.match(/v?(\d+)\.(\d+)(?:\.(\d+))?/i)

  if (!parsed) return null

  return {
    major: parseInt(parsed[1]),
    minor: parseInt(parsed[2]),
    patch: parsed[3] ? parseInt(parsed[3]) : 0
  } as SemVersion
}

// ---------------------------------------------------------------------------

function execShell (command: string, options?: ExecOptions) {
  return new Promise<{ err?: Error, stdout: string, stderr: string }>((res, rej) => {
    exec(command, options, (err, stdout, stderr) => {
      // eslint-disable-next-line prefer-promise-reject-errors
      if (err) return rej({ err, stdout, stderr })

      return res({ stdout, stderr })
    })
  })
}

// ---------------------------------------------------------------------------

function generateRSAKeyPairPromise (size: number) {
  return new Promise<{ publicKey: string, privateKey: string }>((res, rej) => {
    const options: RSAKeyPairOptions<'pem', 'pem'> = {
      modulusLength: size,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      }
    }

    generateKeyPair('rsa', options, (err, publicKey, privateKey) => {
      if (err) return rej(err)

      return res({ publicKey, privateKey })
    })
  })
}

function generateED25519KeyPairPromise () {
  return new Promise<{ publicKey: string, privateKey: string }>((res, rej) => {
    const options: ED25519KeyPairOptions<'pem', 'pem'> = {
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    }

    generateKeyPair('ed25519', options, (err, publicKey, privateKey) => {
      if (err) return rej(err)

      return res({ publicKey, privateKey })
    })
  })
}

// ---------------------------------------------------------------------------

const randomBytesPromise = promisify1<number, Buffer>(randomBytes)
const scryptPromise = promisify3<string, string, number, Buffer>(scrypt)
const execPromise2 = promisify2<string, any, string>(exec)
const execPromise = promisify1<string, string>(exec)
const pipelinePromise = promisify(pipeline)

// ---------------------------------------------------------------------------

export {
  objectConverter,
  mapToJSON,

  sanitizeUrl,
  sanitizeHost,

  execShell,

  pageToStartAndCount,
  peertubeTruncate,

  scryptPromise,

  randomBytesPromise,

  generateRSAKeyPairPromise,
  generateED25519KeyPairPromise,

  execPromise2,
  execPromise,
  pipelinePromise,

  parseSemVersion
}

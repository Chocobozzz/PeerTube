/* eslint-disable no-useless-call */

/*
  Different from 'utils' because we don't import other PeerTube modules.
  Useful to avoid circular dependencies.
*/

import { exec, ExecOptions } from 'child_process'
import { BinaryToTextEncoding, createHash, randomBytes } from 'crypto'
import { truncate } from 'lodash'
import { basename, extname, isAbsolute, join, resolve } from 'path'
import * as pem from 'pem'
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

  const tgm = /^(\d+)\s*TB\s*(\d+)\s*GB\s*(\d+)\s*MB$/
  const tg = /^(\d+)\s*TB\s*(\d+)\s*GB$/
  const tm = /^(\d+)\s*TB\s*(\d+)\s*MB$/
  const gm = /^(\d+)\s*GB\s*(\d+)\s*MB$/
  const t = /^(\d+)\s*TB$/
  const g = /^(\d+)\s*GB$/
  const m = /^(\d+)\s*MB$/
  const b = /^(\d+)\s*B$/
  let match

  if (value.match(tgm)) {
    match = value.match(tgm)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024 * 1024 +
      parseInt(match[3], 10) * 1024 * 1024
  } else if (value.match(tg)) {
    match = value.match(tg)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024 * 1024
  } else if (value.match(tm)) {
    match = value.match(tm)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024
  } else if (value.match(gm)) {
    match = value.match(gm)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024
  } else if (value.match(t)) {
    match = value.match(t)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024
  } else if (value.match(g)) {
    match = value.match(g)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024
  } else if (value.match(m)) {
    match = value.match(m)
    return parseInt(match[1], 10) * 1024 * 1024
  } else if (value.match(b)) {
    match = value.match(b)
    return parseInt(match[1], 10) * 1024
  } else {
    return parseInt(value, 10)
  }
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

function isTestInstance () {
  return process.env.NODE_ENV === 'test'
}

function isProdInstance () {
  return process.env.NODE_ENV === 'production'
}

function getAppNumber () {
  return process.env.NODE_APP_INSTANCE
}

// ---------------------------------------------------------------------------

let rootPath: string

function root () {
  if (rootPath) return rootPath

  // We are in /helpers/utils.js
  rootPath = join(__dirname, '..', '..')

  if (basename(rootPath) === 'dist') rootPath = resolve(rootPath, '..')

  return rootPath
}

function buildPath (path: string) {
  if (isAbsolute(path)) return path

  return join(root(), path)
}

function getLowercaseExtension (filename: string) {
  const ext = extname(filename) || ''

  return ext.toLowerCase()
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
function parseSemVersion (s: string) {
  const parsed = s.match(/^v?(\d+)\.(\d+)\.(\d+)$/i)

  return {
    major: parseInt(parsed[1]),
    minor: parseInt(parsed[2]),
    patch: parseInt(parsed[3])
  } as SemVersion
}

// ---------------------------------------------------------------------------

function sha256 (str: string | Buffer, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha256').update(str).digest(encoding)
}

function sha1 (str: string | Buffer, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha1').update(str).digest(encoding)
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

function isOdd (num: number) {
  return (num % 2) !== 0
}

function toEven (num: number) {
  if (isOdd(num)) return num + 1

  return num
}

// ---------------------------------------------------------------------------

function promisify0<A> (func: (cb: (err: any, result: A) => void) => void): () => Promise<A> {
  return function promisified (): Promise<A> {
    return new Promise<A>((resolve: (arg: A) => void, reject: (err: any) => void) => {
      func.apply(null, [ (err: any, res: A) => err ? reject(err) : resolve(res) ])
    })
  }
}

// Thanks to https://gist.github.com/kumasento/617daa7e46f13ecdd9b2
function promisify1<T, A> (func: (arg: T, cb: (err: any, result: A) => void) => void): (arg: T) => Promise<A> {
  return function promisified (arg: T): Promise<A> {
    return new Promise<A>((resolve: (arg: A) => void, reject: (err: any) => void) => {
      func.apply(null, [ arg, (err: any, res: A) => err ? reject(err) : resolve(res) ])
    })
  }
}

function promisify2<T, U, A> (func: (arg1: T, arg2: U, cb: (err: any, result: A) => void) => void): (arg1: T, arg2: U) => Promise<A> {
  return function promisified (arg1: T, arg2: U): Promise<A> {
    return new Promise<A>((resolve: (arg: A) => void, reject: (err: any) => void) => {
      func.apply(null, [ arg1, arg2, (err: any, res: A) => err ? reject(err) : resolve(res) ])
    })
  }
}

const randomBytesPromise = promisify1<number, Buffer>(randomBytes)
const createPrivateKey = promisify1<number, { key: string }>(pem.createPrivateKey)
const getPublicKey = promisify1<string, { publicKey: string }>(pem.getPublicKey)
const execPromise2 = promisify2<string, any, string>(exec)
const execPromise = promisify1<string, string>(exec)
const pipelinePromise = promisify(pipeline)

// ---------------------------------------------------------------------------

export {
  isTestInstance,
  isProdInstance,
  getAppNumber,

  objectConverter,
  mapToJSON,

  root,
  buildPath,
  getLowercaseExtension,
  sanitizeUrl,
  sanitizeHost,

  execShell,

  pageToStartAndCount,
  peertubeTruncate,

  sha256,
  sha1,

  promisify0,
  promisify1,
  promisify2,

  randomBytesPromise,
  createPrivateKey,
  getPublicKey,
  execPromise2,
  execPromise,
  pipelinePromise,

  parseSemVersion,

  isOdd,
  toEven
}

/*
  Different from 'utils' because we don't not import other PeerTube modules.
  Useful to avoid circular dependencies.
*/

import * as bcrypt from 'bcrypt'
import * as createTorrent from 'create-torrent'
import { createHash, pseudoRandomBytes } from 'crypto'
import { copyFile, readdir, readFile, rename, stat, Stats, unlink, writeFile } from 'fs'
import * as mkdirp from 'mkdirp'
import { isAbsolute, join } from 'path'
import * as pem from 'pem'
import * as rimraf from 'rimraf'
import { URL } from 'url'
import { truncate } from 'lodash'

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

function isTestInstance () {
  return process.env.NODE_ENV === 'test'
}

function root () {
  // We are in /helpers/utils.js
  const paths = [ __dirname, '..', '..' ]

  // We are under /dist directory
  if (process.mainModule && process.mainModule.filename.endsWith('.ts') === false) {
    paths.push('..')
  }

  return join.apply(null, paths)
}

// Thanks: https://stackoverflow.com/a/12034334
function escapeHTML (stringParam) {
  if (!stringParam) return ''

  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  }

  return String(stringParam).replace(/[&<>"'`=\/]/g, s => entityMap[s])
}

function pageToStartAndCount (page: number, itemsPerPage: number) {
  const start = (page - 1) * itemsPerPage

  return { start, count: itemsPerPage }
}

function buildPath (path: string) {
  if (isAbsolute(path)) return path

  return join(root(), path)
}

// Consistent with .length, lodash truncate function is not
function peertubeTruncate (str: string, maxLength: number) {
  const options = {
    length: maxLength
  }
  const truncatedStr = truncate(str, options)

  // The truncated string is okay, we can return it
  if (truncatedStr.length <= maxLength) return truncatedStr

  // Lodash takes into account all UTF characters, whereas String.prototype.length does not: some characters have a length of 2
  // We always use the .length so we need to truncate more if needed
  options.length -= truncatedStr.length - maxLength
  return truncate(str, options)
}

function sha256 (str: string) {
  return createHash('sha256').update(str).digest('hex')
}

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

function promisify1WithVoid<T> (func: (arg: T, cb: (err: any) => void) => void): (arg: T) => Promise<void> {
  return function promisified (arg: T): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (err: any) => void) => {
      func.apply(null, [ arg, (err: any) => err ? reject(err) : resolve() ])
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

function promisify2WithVoid<T, U> (func: (arg1: T, arg2: U, cb: (err: any) => void) => void): (arg1: T, arg2: U) => Promise<void> {
  return function promisified (arg1: T, arg2: U): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (err: any) => void) => {
      func.apply(null, [ arg1, arg2, (err: any) => err ? reject(err) : resolve() ])
    })
  }
}

const copyFilePromise = promisify2WithVoid<string, string>(copyFile)
const readFileBufferPromise = promisify1<string, Buffer>(readFile)
const unlinkPromise = promisify1WithVoid<string>(unlink)
const renamePromise = promisify2WithVoid<string, string>(rename)
const writeFilePromise = promisify2WithVoid<string, any>(writeFile)
const readdirPromise = promisify1<string, string[]>(readdir)
const mkdirpPromise = promisify1<string, string>(mkdirp)
// we cannot modify the Promise types, so we should make the promisify instance check mkdirp
const pseudoRandomBytesPromise = promisify1<number, Buffer>(pseudoRandomBytes)
const createPrivateKey = promisify1<number, { key: string }>(pem.createPrivateKey)
const getPublicKey = promisify1<string, { publicKey: string }>(pem.getPublicKey)
const bcryptComparePromise = promisify2<any, string, boolean>(bcrypt.compare)
const bcryptGenSaltPromise = promisify1<number, string>(bcrypt.genSalt)
const bcryptHashPromise = promisify2<any, string | number, string>(bcrypt.hash)
const createTorrentPromise = promisify2<string, any, any>(createTorrent)
const rimrafPromise = promisify1WithVoid<string>(rimraf)
const statPromise = promisify1<string, Stats>(stat)

// ---------------------------------------------------------------------------

export {
  isTestInstance,
  root,
  escapeHTML,
  pageToStartAndCount,
  sanitizeUrl,
  sanitizeHost,
  buildPath,
  peertubeTruncate,
  sha256,

  promisify0,
  promisify1,

  copyFilePromise,
  readdirPromise,
  readFileBufferPromise,
  unlinkPromise,
  renamePromise,
  writeFilePromise,
  mkdirpPromise,
  pseudoRandomBytesPromise,
  createPrivateKey,
  getPublicKey,
  bcryptComparePromise,
  bcryptGenSaltPromise,
  bcryptHashPromise,
  createTorrentPromise,
  rimrafPromise,
  statPromise
}

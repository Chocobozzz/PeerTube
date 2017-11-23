/*
  Different from 'utils' because we don't not import other PeerTube modules.
  Useful to avoid circular dependencies.
*/

import * as bcrypt from 'bcrypt'
import * as createTorrent from 'create-torrent'
import { pseudoRandomBytes } from 'crypto'
import { readdir, readFile, rename, stat, Stats, unlink, writeFile } from 'fs'
import * as mkdirp from 'mkdirp'
import { join } from 'path'
import * as pem from 'pem'
import * as rimraf from 'rimraf'

function isTestInstance () {
  return process.env.NODE_ENV === 'test'
}

function root () {
  // We are in /helpers/utils.js
  const paths = [ __dirname, '..', '..' ]

  // We are under /dist directory
  if (process.mainModule.filename.endsWith('.ts') === false) {
    paths.push('..')
  }

  return join.apply(null, paths)
}

// Thanks: https://stackoverflow.com/a/12034334
function escapeHTML (stringParam) {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
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

const readFileBufferPromise = promisify1<string, Buffer>(readFile)
const unlinkPromise = promisify1WithVoid<string>(unlink)
const renamePromise = promisify2WithVoid<string, string>(rename)
const writeFilePromise = promisify2WithVoid<string, any>(writeFile)
const readdirPromise = promisify1<string, string[]>(readdir)
const mkdirpPromise = promisify1<string, string>(mkdirp)
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

  promisify0,
  promisify1,

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

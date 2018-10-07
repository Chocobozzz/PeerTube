import { ResultList } from '../../shared'
import { CONFIG } from '../initializers'
import { ApplicationModel } from '../models/application/application'
import { execPromise, execPromise2, pseudoRandomBytesPromise, sha256 } from './core-utils'
import { logger } from './logger'
import { join } from 'path'
import { Instance as ParseTorrent } from 'parse-torrent'
import { remove } from 'fs-extra'
import * as memoizee from 'memoizee'

function deleteFileAsync (path: string) {
  remove(path)
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

const getServerActor = memoizee(async function () {
  const application = await ApplicationModel.load()
  if (!application) throw Error('Could not load Application from database.')

  return application.Account.Actor
})

function generateVideoTmpPath (target: string | ParseTorrent) {
  const id = typeof target === 'string' ? target : target.infoHash

  const hash = sha256(id)
  return join(CONFIG.STORAGE.VIDEOS_DIR, hash + '-import.mp4')
}

function getSecureTorrentName (originalName: string) {
  return sha256(originalName) + '.torrent'
}

async function getVersion () {
  try {
    const tag = await execPromise2(
      '[ ! -d .git ] || git name-rev --name-only --tags --no-undefined HEAD 2>/dev/null || true',
      { stdio: [ 0, 1, 2 ] }
    )

    if (tag) return tag.replace(/^v/, '')
  } catch (err) {
    logger.debug('Cannot get version from git tags.', { err })
  }

  try {
    const version = await execPromise('[ ! -d .git ] || git rev-parse --short HEAD')

    if (version) return version.toString().trim()
  } catch (err) {
    logger.debug('Cannot get version from git HEAD.', { err })
  }

  return require('../../../package.json').version
}

// ---------------------------------------------------------------------------

export {
  deleteFileAsync,
  generateRandomString,
  getFormattedObjects,
  getSecureTorrentName,
  getServerActor,
  getVersion,
  generateVideoTmpPath
}

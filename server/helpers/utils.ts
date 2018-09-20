import { ResultList } from '../../shared'
import { CONFIG } from '../initializers'
import { ApplicationModel } from '../models/application/application'
import { pseudoRandomBytesPromise, sha256 } from './core-utils'
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

// ---------------------------------------------------------------------------

export {
  deleteFileAsync,
  generateRandomString,
  getFormattedObjects,
  getSecureTorrentName,
  getServerActor,
  generateVideoTmpPath
}

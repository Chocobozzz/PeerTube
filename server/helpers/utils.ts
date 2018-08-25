import { ResultList } from '../../shared'
import { CONFIG } from '../initializers'
import { ActorModel } from '../models/activitypub/actor'
import { ApplicationModel } from '../models/application/application'
import { pseudoRandomBytesPromise, sha256, unlinkPromise } from './core-utils'
import { logger } from './logger'
import { join } from 'path'
import { Instance as ParseTorrent } from 'parse-torrent'

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

async function getServerActor () {
  if (getServerActor.serverActor === undefined) {
    const application = await ApplicationModel.load()
    if (!application) throw Error('Could not load Application from database.')

    getServerActor.serverActor = application.Account.Actor
  }

  if (!getServerActor.serverActor) {
    logger.error('Cannot load server actor.')
    process.exit(0)
  }

  return Promise.resolve(getServerActor.serverActor)
}
namespace getServerActor {
  export let serverActor: ActorModel
}

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

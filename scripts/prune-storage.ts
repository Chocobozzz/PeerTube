import * as prompt from 'prompt'
import { join } from 'path'
import { readdirPromise, unlinkPromise } from '../server/helpers/core-utils'
import { CONFIG } from '../server/initializers/constants'
import { VideoModel } from '../server/models/video/video'
import { initDatabaseModels } from '../server/initializers'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  const storageToPrune = [
    CONFIG.STORAGE.VIDEOS_DIR,
    CONFIG.STORAGE.PREVIEWS_DIR,
    CONFIG.STORAGE.THUMBNAILS_DIR,
    CONFIG.STORAGE.TORRENTS_DIR
  ]

  let toDelete: string[] = []
  for (const directory of storageToPrune) {
    toDelete = toDelete.concat(await pruneDirectory(directory))
  }

  if (toDelete.length === 0) {
    console.log('No files to delete.')
    return
  }

  console.log('Will delete %d files:\n\n%s\n\n', toDelete.length, toDelete.join('\n'))

  const res = await askConfirmation()
  if (res === true) {
    console.log('Processing delete...\n')

    for (const path of toDelete) {
      await unlinkPromise(path)
    }

    console.log('Done!')
  } else {
    console.log('Exiting without deleting files.')
  }
}

async function pruneDirectory (directory: string) {
  const files = await readdirPromise(directory)

  const toDelete: string[] = []
  for (const file of files) {
    const uuid = getUUIDFromFilename(file)
    let video: VideoModel

    if (uuid) video = await VideoModel.loadByUUID(uuid)

    if (!uuid || !video) toDelete.push(join(directory, file))
  }

  return toDelete
}

function getUUIDFromFilename (filename: string) {
  const regex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
  const result = filename.match(regex)

  if (!result || Array.isArray(result) === false) return null

  return result[0]
}

async function askConfirmation () {
  return new Promise((res, rej) => {
    prompt.start()
    const schema = {
      properties: {
        confirm: {
          type: 'string',
          description: 'Are you sure you want to delete these files? Please check carefully',
          default: 'n',
          required: true
        }
      }
    }
    prompt.get(schema, function (err, result) {
      if (err) return rej(err)
      return res(result.confirm && result.confirm.match(/y/) !== null)
    })
  })
}

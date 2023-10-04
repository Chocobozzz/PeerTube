import { program } from 'commander'
import { resolve } from 'path'
import { isUUIDValid, toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { initDatabaseModels } from '../core/initializers/database.js'
import { JobQueue } from '../core/lib/job-queue/index.js'
import { VideoModel } from '../core/models/video/video.js'

program
  .option('-v, --video [videoUUID]', 'Video UUID')
  .option('-i, --import [videoFile]', 'Video file')
  .description('Import a video file to replace an already uploaded file or to add a new resolution')
  .parse(process.argv)

const options = program.opts()

if (options.video === undefined || options.import === undefined) {
  console.error('All parameters are mandatory.')
  process.exit(-1)
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  const uuid = toCompleteUUID(options.video)

  if (isUUIDValid(uuid) === false) {
    console.error('%s is not a valid video UUID.', options.video)
    return
  }

  const video = await VideoModel.load(uuid)
  if (!video) throw new Error('Video not found.')
  if (video.isOwned() === false) throw new Error('Cannot import files of a non owned video.')

  const dataInput = {
    videoUUID: video.uuid,
    filePath: resolve(options.import)
  }

  JobQueue.Instance.init()
  await JobQueue.Instance.createJob({ type: 'video-file-import', payload: dataInput })
  console.log('Import job for video %s created.', video.uuid)
}

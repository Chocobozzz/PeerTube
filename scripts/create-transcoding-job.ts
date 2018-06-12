import * as program from 'commander'
import { createReadStream } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'
import { VideoModel } from '../server/models/video/video'
import { initDatabaseModels } from '../server/initializers'
import { JobQueue } from '../server/lib/job-queue'

program
  .option('-v, --video [videoUUID]', 'Video UUID')
  .parse(process.argv)

if (program['video'] === undefined) {
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

  const video = await VideoModel.loadByUUID(program['video'])
  if (!video) throw new Error('Video not found.')

  const dataInput = {
    videoUUID: video.uuid,
    isNewVideo: false
  }

  await JobQueue.Instance.init()
  await JobQueue.Instance.createJob({ type: 'video-file', payload: dataInput })
  console.log('Transcoding job for video %s created.', video.uuid)
}

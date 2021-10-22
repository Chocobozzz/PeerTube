import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import { program } from 'commander'
import { VideoModel } from '@server/models/video/video'
import { initDatabaseModels } from '@server/initializers/database'
import { VideoState, VideoStorage } from '@shared/models'
import { moveToNextState } from '@server/lib/video-state'
import { JobQueue } from '@server/lib/job-queue'

program
  .description('Migrate videos to object storage.')
  .parse(process.argv)

run()
  .then(() => process.exit(0))
  .catch(err => console.error(err))

async function run () {
  await initDatabaseModels(true)
  JobQueue.Instance.init()

  const videos = await VideoModel.listLocal()
  const withFiles = (await Promise.all(videos.map(video => VideoModel.loadWithFiles(video.id))))
    .filter(video =>
      video.VideoFiles.find(vf => vf.storage === VideoStorage.FILE_SYSTEM) ||
      video.VideoStreamingPlaylists.find(sp => sp.storage === VideoStorage.FILE_SYSTEM)
    )

  for (const video of withFiles) {
    video.state = VideoState.TO_MIGRATE_TO_EXTERNAL_STORAGE
    await video.save()
    await moveToNextState(video, false)
    console.log(`Created move-to-object-storage job for ${video.name}.`)
  }
}

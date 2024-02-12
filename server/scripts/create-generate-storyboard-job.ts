import { program } from 'commander'
import { toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { initDatabaseModels } from '@server/initializers/database.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoModel } from '@server/models/video/video.js'
import { buildStoryboardJobIfNeeded } from '@server/lib/video-jobs.js'

program
  .description('Generate videos storyboard')
  .option('-v, --video [videoUUID]', 'Generate the storyboard of a specific video')
  .option('-a, --all-videos', 'Generate missing storyboards of local videos')
  .parse(process.argv)

const options = program.opts()

if (!options['video'] && !options['allVideos']) {
  console.error('You need to choose videos for storyboard generation.')
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

  JobQueue.Instance.init()

  let ids: number[] = []

  if (options['video']) {
    const video = await VideoModel.load(toCompleteUUID(options['video']))

    if (!video) {
      console.error('Unknown video ' + options['video'])
      process.exit(-1)
    }

    if (video.remote === true) {
      console.error('Cannot process a remote video')
      process.exit(-1)
    }

    if (video.isLive) {
      console.error('Cannot process live video')
      process.exit(-1)
    }

    ids.push(video.id)
  } else {
    ids = await listLocalMissingStoryboards()
  }

  for (const id of ids) {
    const videoFull = await VideoModel.load(id)

    if (videoFull.isLive) continue

    await JobQueue.Instance.createJob(buildStoryboardJobIfNeeded({ video: videoFull, federate: true }))

    console.log(`Created generate-storyboard job for ${videoFull.name}.`)
  }
}

async function listLocalMissingStoryboards () {
  const ids = await VideoModel.listLocalIds()
  const results: number[] = []

  for (const id of ids) {
    const storyboard = await StoryboardModel.loadByVideo(id)
    if (!storyboard) results.push(id)
  }

  return results
}

import { toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { initDatabaseModels } from '@server/initializers/database.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { createTranscriptionTaskIfNeeded } from '@server/lib/video-captions.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoModel } from '@server/models/video/video.js'
import { program } from 'commander'

program
  .description('Generate videos transcription')
  .option('-v, --video [videoUUID]', 'Generate the transcription of a specific video')
  .option('-a, --all-videos', 'Generate missing transcriptions of local videos')
  .parse(process.argv)

const options = program.opts()

if (!options['video'] && !options['allVideos']) {
  console.error('You need to choose videos for transcription generation.')
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
    ids = await listLocalMissingTranscriptions()
  }

  for (const id of ids) {
    const videoFull = await VideoModel.load(id)
    if (!videoFull || videoFull.isLive) continue

    try {
      await createTranscriptionTaskIfNeeded(videoFull)

      console.log(`Created generate-transcription job for ${videoFull.name}.`)
    } catch (err) {
      console.error(`Error while creating generate-transcription job for video ${videoFull.name}:`, err)
    }
  }
}

async function listLocalMissingTranscriptions () {
  const ids = await VideoModel.listLocalIds()
  const results: number[] = []

  for (const id of ids) {
    const captions = await VideoCaptionModel.listVideoCaptions(id)
    if (captions.length === 0) results.push(id)
  }

  return results
}

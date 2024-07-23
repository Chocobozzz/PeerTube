import { ffprobePromise, getVideoStreamFPS } from '@peertube/peertube-ffmpeg'
import { VideoFileStream } from '@peertube/peertube-models'
import { initDatabaseModels } from '@server/initializers/database.js'
import { buildFileMetadata } from '@server/lib/video-file.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoModel } from '@server/models/video/video.js'
import Bluebird from 'bluebird'
import { pathExists } from 'fs-extra/esm'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  console.log('## Assigning metadata information to local video files ##\n')

  await initDatabaseModels(true)

  const ids = await VideoModel.listLocalIds()

  await Bluebird.map(ids, async id => {
    try {
      await processVideo(id)
    } catch (err) {
      console.error('Cannot process video ' + id, err)
    }
  }, { concurrency: 5 })

  console.log('\n## Migration finished! ##')
}

async function processVideo (videoId: number) {
  const video = await VideoModel.loadWithFiles(videoId)
  if (video.isLive) return

  const files = await Promise.all(video.getAllFiles().map(f => VideoFileModel.loadWithMetadata(f.id)))

  if (!files.some(f => f.fps === -1 || !f.metadata || !f.streams || f.width === null || f.height === null)) return

  console.log('Processing video "' + video.name + '"')

  for (const file of files) {
    if (!file.metadata || file.fps === -1) {
      const fileWithVideoOrPlaylist = file.videoStreamingPlaylistId
        ? file.withVideoOrPlaylist(video.getHLSPlaylist())
        : file.withVideoOrPlaylist(video)

      await VideoPathManager.Instance.makeAvailableVideoFile(fileWithVideoOrPlaylist, async path => {
        if (!await pathExists(path)) {
          console.error(
            `Skipping processing file ${file.id} because ${path} does not exist on disk for video "${video.name}" (uuid: ${video.uuid})`
          )
          return
        }

        console.log(`Filling metadata field of video "${video.name}" - file ${file.id} because it is missing in database`)

        const probe = await ffprobePromise(path)

        file.metadata = await buildFileMetadata(path, probe)
        file.fps = await getVideoStreamFPS(path, probe)

        await file.save()
      })
    }

    if (!file.metadata) continue

    file.streams = VideoFileStream.NONE

    const videoStream = file.metadata.streams.find(s => s.codec_type === 'video')

    if (videoStream) {
      file.streams |= VideoFileStream.VIDEO

      file.width = videoStream.width
      file.height = videoStream.height
    } else {
      file.width = 0
      file.height = 0
    }

    if (file.metadata.streams.some(s => s.codec_type === 'audio')) {
      file.streams |= VideoFileStream.AUDIO
    }

    await file.save()
  }

  console.log('Successfully processed video "' + video.name + '"')
}

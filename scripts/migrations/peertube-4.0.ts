import { registerTSPaths } from '../../server/helpers/register-ts-paths'
registerTSPaths()

import { join } from 'path'
import { JobQueue } from '@server/lib/job-queue'
import { initDatabaseModels } from '../../server/initializers/database'
import { generateHLSMasterPlaylistFilename, generateHlsSha256SegmentsFilename, getHlsResolutionPlaylistFilename } from '@server/lib/paths'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { VideoModel } from '@server/models/video/video'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { move, readFile, writeFile } from 'fs-extra'
import Bluebird from 'bluebird'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  console.log('Migrate old HLS paths to new format.')

  await initDatabaseModels(true)

  JobQueue.Instance.init(true)

  const ids = await VideoModel.listLocalIds()

  await Bluebird.map(ids, async id => {
    try {
      await processVideo(id)
    } catch (err) {
      console.error('Cannot process video %s.', { err })
    }
  }, { concurrency: 5 })

  console.log('Migration finished!')
}

async function processVideo (videoId: number) {
  const video = await VideoModel.loadWithFiles(videoId)

  const hls = video.getHLSPlaylist()
  if (video.isLive || !hls || hls.playlistFilename !== 'master.m3u8' || hls.VideoFiles.length === 0) {
    return
  }

  console.log(`Renaming HLS playlist files of video ${video.name}.`)

  const playlist = await VideoStreamingPlaylistModel.loadHLSPlaylistByVideo(video.id)
  const hlsDirPath = VideoPathManager.Instance.getFSHLSOutputPath(video)

  const masterPlaylistPath = join(hlsDirPath, playlist.playlistFilename)
  let masterPlaylistContent = await readFile(masterPlaylistPath, 'utf8')

  for (const videoFile of hls.VideoFiles) {
    const srcName = `${videoFile.resolution}.m3u8`
    const dstName = getHlsResolutionPlaylistFilename(videoFile.filename)

    const src = join(hlsDirPath, srcName)
    const dst = join(hlsDirPath, dstName)

    try {
      await move(src, dst)

      masterPlaylistContent = masterPlaylistContent.replace(new RegExp('^' + srcName + '$', 'm'), dstName)
    } catch (err) {
      console.error('Cannot move video file %s to %s.', src, dst, err)
    }
  }

  await writeFile(masterPlaylistPath, masterPlaylistContent)

  if (playlist.segmentsSha256Filename === 'segments-sha256.json') {
    try {
      const newName = generateHlsSha256SegmentsFilename(video.isLive)

      const dst = join(hlsDirPath, newName)
      await move(join(hlsDirPath, playlist.segmentsSha256Filename), dst)
      playlist.segmentsSha256Filename = newName
    } catch (err) {
      console.error(`Cannot rename ${video.name} segments-sha256.json file to a new name`, err)
    }
  }

  if (playlist.playlistFilename === 'master.m3u8') {
    try {
      const newName = generateHLSMasterPlaylistFilename(video.isLive)

      const dst = join(hlsDirPath, newName)
      await move(join(hlsDirPath, playlist.playlistFilename), dst)
      playlist.playlistFilename = newName
    } catch (err) {
      console.error(`Cannot rename ${video.name} master.m3u8 file to a new name`, err)
    }
  }

  // Everything worked, we can save the playlist now
  await playlist.save()

  const allVideo = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.id)
  await federateVideoIfNeeded(allVideo, false)

  console.log(`Successfully moved HLS files of ${video.name}.`)
}

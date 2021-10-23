import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import { program } from 'commander'
import { VideoModel } from '@server/models/video/video'
import { initDatabaseModels } from '@server/initializers/database'
import { JobQueue } from '@server/lib/job-queue'
import { VideoStreamingPlaylistModel } from '../server/models/video/video-streaming-playlist'
import { generateHLSMasterPlaylistFilename, generateHlsSha256SegmentsFilename, getHlsResolutionPlaylistFilename } from '@server/lib/paths'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { move } from 'fs-extra'
import { join } from 'path'

program
  .description('Migrate HLS videos to get unique playlist filenames.')
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
      video.VideoStreamingPlaylists.find(sp => sp.playlistFilename === 'master.m3u8')
    )

  console.log(`Found ${withFiles.length} videos with old naming convention.`)

  for (const video of withFiles) {
    const playlist = await VideoStreamingPlaylistModel.loadHLSPlaylistByVideo(video.id)
    const hlsOutputPath = VideoPathManager.Instance.getFSHLSOutputPath(video)

    playlist.playlistFilename = generateHLSMasterPlaylistFilename(video.isLive)
    playlist.segmentsSha256Filename = generateHlsSha256SegmentsFilename(video.isLive)

    const moveMap = video.VideoStreamingPlaylists.map(sp =>
      sp.VideoFiles.map(vf => ({
        [join(hlsOutputPath, `${vf.resolution}.m3u8`)]: join(hlsOutputPath, getHlsResolutionPlaylistFilename(vf.filename))
      }))
    )
    .flat()
    .reduce((acc, val) => ({
      ...acc,
      ...val
    }), {
      [join(hlsOutputPath, 'segments-sha256.json')]: join(hlsOutputPath, playlist.segmentsSha256Filename),
      [join(hlsOutputPath, 'master.m3u8')]: join(hlsOutputPath, playlist.playlistFilename)
    })

    const moved = []
    try {
      for (const from of Object.keys(moveMap)) {
        await move(from, moveMap[from])
        moved.push(from)
      }
      await playlist.save()
      console.log(`Successfully migrated ${video.id} with ${moved.length} files.`)
    } catch (error) {
      console.error(error)
      console.error(`Failed to migrate video ${video.id}.`)

      if (moved.length > 0) {
        continue
      }

      console.log(`Trying to restore ${moved.length} files.`)

      moved.forEach(async from => {
        try {
          await move(moveMap[from], from)
          console.log(`Successfully restored ${from}.`)
        } catch (err) {
          console.error(err)
          console.error(`Failed to restore ${from}.`)
        }
      })

    }
    continue
  }
}

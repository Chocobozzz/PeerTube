import { ensureDir } from 'fs-extra/esm'
import { Op } from 'sequelize'
import { updateTorrentMetadata } from '@server/helpers/webtorrent.js'
import { DIRECTORIES } from '@server/initializers/constants.js'
import { moveFilesIfPrivacyChanged } from '@server/lib/video-privacy.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFullLight } from '@server/types/models/index.js'
import { VideoPrivacy } from '@peertube/peertube-models'
import { initDatabaseModels } from '@server/initializers/database.js'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  console.log('Moving private video files in dedicated folders.')

  await ensureDir(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE)
  await ensureDir(DIRECTORIES.WEB_VIDEOS.PRIVATE)

  await initDatabaseModels(true)

  const videos = await VideoModel.unscoped().findAll({
    attributes: [ 'uuid' ],
    where: {
      privacy: {
        [Op.in]: [ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL ]
      }
    }
  })

  for (const { uuid } of videos) {
    try {
      console.log('Moving files of video %s.', uuid)

      const video = await VideoModel.loadFull(uuid)

      try {
        await moveFilesIfPrivacyChanged(video, VideoPrivacy.PUBLIC)
      } catch (err) {
        console.error('Cannot move files of video %s.', uuid, err)
      }

      try {
        await updateTorrents(video)
      } catch (err) {
        console.error('Cannot regenerate torrents of video %s.', uuid, err)
      }
    } catch (err) {
      console.error('Cannot process video %s.', uuid, err)
    }
  }
}

async function updateTorrents (video: MVideoFullLight) {
  for (const file of video.VideoFiles) {
    await updateTorrentMetadata(video, file)

    await file.save()
  }

  const playlist = video.getHLSPlaylist()
  for (const file of (playlist?.VideoFiles || [])) {
    await updateTorrentMetadata(playlist, file)

    await file.save()
  }
}

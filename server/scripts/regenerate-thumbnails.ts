import { FileStorage } from '@peertube/peertube-models'
import { generateImageFilename, processImage } from '@server/helpers/image-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { initDatabaseModels } from '@server/initializers/database.js'
import { sendUpdateVideoPlaylist } from '@server/lib/activitypub/send/send-update.js'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos/index.js'
import { JobQueue } from '@server/lib/job-queue/job-queue.js'
import { storeCommonFile, withLocalCommonFile } from '@server/lib/object-storage/common-files.js'
import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoAP, MVideoPlaylistFull } from '@server/types/models/index.js'
import Bluebird from 'bluebird'
import { program } from 'commander'
import { pathExists, remove } from 'fs-extra/esm'
import { join } from 'path'

program
  .description('Regenerate local video and playlist thumbnails using existing images')
  .parse(process.argv)

run()
  .then(() => process.exit(0))
  .catch(err => console.error(err))

async function run () {
  await initDatabaseModels(true)

  JobQueue.Instance.init()

  const videoIds = await VideoModel.listLocalIds()

  await Bluebird.map(videoIds, id => {
    return processVideo(id)
      .catch(err => console.error('Cannot process video %d.', id, err))
  }, { concurrency: 20 })

  const playlistIds = await VideoPlaylistModel.listLocalIds()

  await Bluebird.map(playlistIds, id => {
    return processPlaylist(id)
      .catch(err => console.error('Cannot process playlist %d.', id, err))
  }, { concurrency: 20 })
}

async function processVideo (id: number) {
  const video = await VideoModel.loadAP(id)

  console.log('Processing video %s.', video.name)

  await processThumbnails({ entity: video, generateFilename: () => generateImageFilename() })

  await federateVideoIfNeeded({ video })
}

async function processPlaylist (id: number) {
  const playlist = await VideoPlaylistModel.loadWithAccountAndChannel(id, undefined)

  console.log('Processing playlist %s.', playlist.name)

  await processThumbnails({
    entity: playlist,
    generateFilename: () => generateImageFilename()
  })

  await sendUpdateVideoPlaylist(playlist, undefined)
}

async function processThumbnails (options: {
  entity: MVideoAP | MVideoPlaylistFull
  generateFilename: () => string
}) {
  const { entity, generateFilename } = options

  const bestImage = entity.getBestThumbnail('16:9')
  if (!bestImage) return

  const onObjectStorage = CONFIG.OBJECT_STORAGE.THUMBNAILS.ENABLED

  if (bestImage.storage === FileStorage.FILE_SYSTEM && !await pathExists(bestImage.getFSPath())) {
    throw new Error(`Thumbnail ${bestImage.getFSPath()} does not exist on disk`)
  }

  const oldThumbnails = [ ...entity.Thumbnails ]

  const generateThumbnails = (inputPath: string) => {
    return Bluebird.mapSeries(CONFIG.THUMBNAILS.SIZES, async size => {
      const thumbnail = new ThumbnailModel({
        filename: generateFilename(),
        height: size.height,
        width: size.width,
        aspectRatio: size.aspectRatio,
        fileUrl: null,
        automaticallyGenerated: bestImage.automaticallyGenerated,
        cached: false,
        storage: onObjectStorage
          ? FileStorage.OBJECT_STORAGE
          : FileStorage.FILE_SYSTEM
      })

      const destination = onObjectStorage
        ? join(CONFIG.STORAGE.TMP_DIR, thumbnail.filename)
        : thumbnail.getFSPath()

      await processImage({ path: inputPath, destination, newSize: size, keepOriginal: true })

      if (onObjectStorage) {
        await storeCommonFile('thumbnails', destination, thumbnail.filename)
        await remove(destination)
      }

      return thumbnail
    })
  }

  const thumbnails = await withLocalCommonFile('thumbnails', bestImage, generateThumbnails)

  await entity.replaceAndSaveThumbnails(thumbnails)

  for (const oldThumbnail of oldThumbnails) {
    // Explicitly remove the file
    // We have a destroy hook but it's async, so ensure we wait for it to be done before ending the script
    await oldThumbnail.removeFile()
  }
}

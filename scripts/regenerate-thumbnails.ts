import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import * as Bluebird from 'bluebird'
import { program } from 'commander'
import { pathExists, remove } from 'fs-extra'
import { generateImageFilename, processImage } from '@server/helpers/image-utils'
import { THUMBNAILS_SIZE } from '@server/initializers/constants'
import { VideoModel } from '@server/models/video/video'
import { MVideo } from '@server/types/models'
import { initDatabaseModels } from '@server/initializers/database'

program
  .description('Regenerate local thumbnails using preview files')
  .parse(process.argv)

run()
  .then(() => process.exit(0))
  .catch(err => console.error(err))

async function run () {
  await initDatabaseModels(true)

  const videos = await VideoModel.listLocal()

  await Bluebird.map(videos, v => {
    return processVideo(v)
      .catch(err => console.error('Cannot process video %s.', v.url, err))
  }, { concurrency: 20 })
}

async function processVideo (videoArg: MVideo) {
  const video = await VideoModel.loadWithFiles(videoArg.id)

  console.log('Processing video %s.', video.name)

  const thumbnail = video.getMiniature()
  const preview = video.getPreview()

  const previewPath = preview.getPath()

  if (!await pathExists(previewPath)) {
    throw new Error(`Preview ${previewPath} does not exist on disk`)
  }

  const size = {
    width: THUMBNAILS_SIZE.width,
    height: THUMBNAILS_SIZE.height
  }

  const oldPath = thumbnail.getPath()

  // Update thumbnail
  thumbnail.filename = generateImageFilename()
  thumbnail.width = size.width
  thumbnail.height = size.height

  const thumbnailPath = thumbnail.getPath()
  await processImage(previewPath, thumbnailPath, size, true)

  // Save new attributes
  await thumbnail.save()

  // Remove old thumbnail
  await remove(oldPath)

  // Don't federate, remote instances will refresh the thumbnails after a while
}

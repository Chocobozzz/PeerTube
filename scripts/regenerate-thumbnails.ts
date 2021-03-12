import { registerTSPaths } from '../server/helpers/register-ts-paths'
registerTSPaths()

import * as Bluebird from 'bluebird'
import * as program from 'commander'
import { pathExists } from 'fs-extra'
import { processImage } from '@server/helpers/image-utils'
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

  const thumbnail = video.getMiniature()
  const preview = video.getPreview()

  const thumbnailPath = thumbnail.getPath()
  const previewPath = preview.getPath()

  if (!await pathExists(thumbnailPath)) {
    throw new Error(`Thumbnail ${thumbnailPath} does not exist on disk`)
  }

  if (!await pathExists(previewPath)) {
    throw new Error(`Preview ${previewPath} does not exist on disk`)
  }

  const size = {
    width: THUMBNAILS_SIZE.width,
    height: THUMBNAILS_SIZE.height
  }
  await processImage(previewPath, thumbnailPath, size, true)
}

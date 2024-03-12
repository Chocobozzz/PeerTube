import express from 'express'
import { VideoModel } from '@server/models/video/video.js'
import { generateLocalVideoMiniature } from '../../../lib/thumbnail.js'
import { MThumbnail, MVideoWithAllFiles } from '@server/types/models/index.js'
import { ThumbnailType } from '@peertube/peertube-models'

const thumbnailRouter = express.Router()

thumbnailRouter.put('/:id/thumbnail/:timecode',
  setThumbnailAtTimecode
)

export {
  thumbnailRouter
}

async function setThumbnailAtTimecode (req: express.Request, res: express.Response) {

  const videoId = req.params.id

  const timecode: number = Number.parseFloat(req.params.timecode)

  const video: MVideoWithAllFiles = await VideoModel.loadWithFiles(videoId)

  const videoFile = video.getMaxQualityFile()

  const thumbnails: MThumbnail[] =
    await generateLocalVideoMiniature({
      video,
      videoFile,
      types: [ ThumbnailType.MINIATURE, ThumbnailType.PREVIEW ],
      timecode
    })

  let url: string

  thumbnails.forEach((thumbnail) => {

    thumbnail.save()

    if (thumbnail.type === ThumbnailType.PREVIEW) {
      url = thumbnail.getOriginFileUrl(video)
    }

  })

  return res.json(url)
}

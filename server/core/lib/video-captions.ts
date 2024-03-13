import { moveAndProcessCaptionFile } from '@server/helpers/captions-utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { MVideo, MVideoCaption } from '@server/types/models/index.js'

export async function createLocalCaption (options: {
  video: MVideo
  path: string
  language: string
}) {
  const { language, path, video } = options

  const videoCaption = new VideoCaptionModel({
    videoId: video.id,
    filename: VideoCaptionModel.generateCaptionName(language),
    language
  }) as MVideoCaption

  await moveAndProcessCaptionFile({ path }, videoCaption)

  await sequelizeTypescript.transaction(async t => {
    await VideoCaptionModel.insertOrReplaceLanguage(videoCaption, t)
  })

  return videoCaption
}

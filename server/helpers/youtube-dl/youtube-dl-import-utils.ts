import { isVTTFileValid } from "../custom-validators/video-captions"
import { logger } from "../logger"
import { moveAndProcessCaptionFile } from "../captions-utils"
import {
  MChannelAccountDefault,
  MThumbnail,
  MUser,
  MVideoAccountDefault,
  MVideoCaption,
  MVideoImportFormattable,
  MVideoTag,
  MVideoThumbnail,
  MVideoWithBlacklistLight
} from "@server/types/models"
import { remove } from "fs-extra"
import { sequelizeTypescript } from "@server/initializers/database"
import { VideoCaptionModel } from "@server/models/video/video-caption"
import { YoutubeDLWrapper } from "./youtube-dl-wrapper"
import { isResolvingToUnicastOnly } from "../dns"
import { YoutubeDLInfo } from "./youtube-dl-info-builder"
import { FilteredModelAttributes } from "@server/types"
import { VideoImportModel } from "@server/models/video/video-import"
import { autoBlacklistVideoIfNeeded } from "@server/lib/video-blacklist"
import { setVideoTags } from "@server/lib/video"

export async function insertIntoDB (parameters: {
  video: MVideoThumbnail
  thumbnailModel: MThumbnail
  previewModel: MThumbnail
  videoChannel: MChannelAccountDefault
  tags: string[]
  videoImportAttributes: FilteredModelAttributes<VideoImportModel>
  user: MUser
}): Promise<MVideoImportFormattable> {
  const { video, thumbnailModel, previewModel, videoChannel, tags, videoImportAttributes, user } = parameters

  const videoImport = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    // Save video object in database
    const videoCreated = await video.save(sequelizeOptions) as (MVideoAccountDefault & MVideoWithBlacklistLight & MVideoTag)
    videoCreated.VideoChannel = videoChannel

    if (thumbnailModel) await videoCreated.addAndSaveThumbnail(thumbnailModel, t)
    if (previewModel) await videoCreated.addAndSaveThumbnail(previewModel, t)

    await autoBlacklistVideoIfNeeded({
      video: videoCreated,
      user,
      notify: false,
      isRemote: false,
      isNew: true,
      transaction: t
    })

    await setVideoTags({ video: videoCreated, tags, transaction: t })

    // Create video import object in database
    const videoImport = await VideoImportModel.create(
      Object.assign({ videoId: videoCreated.id }, videoImportAttributes),
      sequelizeOptions
    ) as MVideoImportFormattable
    videoImport.Video = videoCreated

    return videoImport
  })

  return videoImport
}

export async function processYoutubeSubtitles (youtubeDL: YoutubeDLWrapper, targetUrl: string, videoId: number) {
  try {
    const subtitles = await youtubeDL.getSubtitles()

    logger.info('Will create %s subtitles from youtube import %s.', subtitles.length, targetUrl)

    for (const subtitle of subtitles) {
      if (!await isVTTFileValid(subtitle.path)) {
        await remove(subtitle.path)
        continue
      }

      const videoCaption = new VideoCaptionModel({
        videoId,
        language: subtitle.language,
        filename: VideoCaptionModel.generateCaptionName(subtitle.language)
      }) as MVideoCaption

      // Move physical file
      await moveAndProcessCaptionFile(subtitle, videoCaption)

      await sequelizeTypescript.transaction(async t => {
        await VideoCaptionModel.insertOrReplaceLanguage(videoCaption, t)
      })
    }
  } catch (err) {
    logger.warn('Cannot get video subtitles.', { err })
  }
}

export async function hasUnicastURLsOnly (youtubeDLInfo: YoutubeDLInfo) {
  const hosts = youtubeDLInfo.urls.map(u => new URL(u).hostname)
  const uniqHosts = new Set(hosts)

  for (const h of uniqHosts) {
    if (await isResolvingToUnicastOnly(h) !== true) {
      return false
    }
  }

  return true
}

import { LiveVideoLatencyMode, ThumbnailType, VideoExportJSON, VideoPrivacy } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { buildNextVideoState } from '@server/lib/video-state.js'
import { VideoModel } from '@server/models/video/video.js'
import { pick } from '@peertube/peertube-core-utils'
import { buildUUID, getFileSize } from '@peertube/peertube-node-utils'
import { MChannelId, MThumbnail, MVideoCaption, MVideoFullLight } from '@server/types/models/index.js'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url.js'
import { buildNewFile } from '@server/lib/video-file.js'
import { ffprobePromise, getVideoStreamDuration } from '@peertube/peertube-ffmpeg'
import { updateLocalVideoMiniatureFromExisting } from '@server/lib/thumbnail.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { setVideoTags } from '@server/lib/video.js'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { addVideoJobsAfterCreation } from '@server/lib/video-jobs.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { moveAndProcessCaptionFile } from '@server/helpers/captions-utils.js'
import { VideoLiveModel } from '@server/models/video/video-live.js'
import { VideoLiveReplaySettingModel } from '@server/models/video/video-live-replay-setting.js'
import { AbstractUserImporter } from './abstract-user-importer.js'
import { isUserQuotaValid } from '@server/lib/user.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { move } from 'fs-extra'
import {
  isPasswordValid,
  isVideoCategoryValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoLanguageValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoOriginallyPublishedAtValid,
  isVideoPrivacyValid,
  isVideoReplayPrivacyValid,
  isVideoSourceFilenameValid,
  isVideoSupportValid,
  isVideoTagValid
} from '@server/helpers/custom-validators/videos.js'
import { isVideoChannelUsernameValid } from '@server/helpers/custom-validators/video-channels.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { isArray, isBooleanValid, isUUIDValid } from '@server/helpers/custom-validators/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import { isVideoCaptionLanguageValid } from '@server/helpers/custom-validators/video-captions.js'
import { isLiveLatencyModeValid } from '@server/helpers/custom-validators/video-lives.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { parse } from 'path'
import { isLocalVideoFileAccepted } from '@server/lib/moderation.js'

const lTags = loggerTagsFactory('user-import')

type ImportObject = VideoExportJSON['videos'][0]
type SanitizedObject = Pick<ImportObject, 'name' | 'duration' | 'channel' | 'privacy' | 'archiveFiles' | 'captions' | 'category' |
'licence' | 'language' | 'description' | 'support' | 'nsfw' | 'isLive' | 'commentsEnabled' | 'downloadEnabled' | 'waitTranscoding' |
'originallyPublishedAt' | 'tags' | 'live' | 'passwords' | 'source'>

export class VideosImporter extends AbstractUserImporter <VideoExportJSON, ImportObject, SanitizedObject> {

  protected getImportObjects (json: VideoExportJSON) {
    return json.videos
  }

  protected sanitize (o: ImportObject) {
    if (!isVideoNameValid(o.name)) return undefined
    if (!isVideoDurationValid(o.duration + '')) return undefined
    if (!isVideoChannelUsernameValid(o.channel?.name)) return undefined
    if (!isVideoPrivacyValid(o.privacy)) return undefined
    if (!o.archiveFiles?.videoFile) return undefined

    if (!isVideoCategoryValid(o.category)) o.category = null
    if (!isVideoLicenceValid(o.licence)) o.licence = CONFIG.DEFAULTS.PUBLISH.LICENCE
    if (!isVideoLanguageValid(o.language)) o.language = null
    if (!isVideoDescriptionValid(o.description)) o.description = null
    if (!isVideoSupportValid(o.support)) o.support = null

    if (!isBooleanValid(o.nsfw)) o.nsfw = false
    if (!isBooleanValid(o.isLive)) o.isLive = false
    if (!isBooleanValid(o.commentsEnabled)) o.commentsEnabled = CONFIG.DEFAULTS.PUBLISH.COMMENTS_ENABLED
    if (!isBooleanValid(o.downloadEnabled)) o.downloadEnabled = CONFIG.DEFAULTS.PUBLISH.DOWNLOAD_ENABLED
    if (!isBooleanValid(o.waitTranscoding)) o.waitTranscoding = true

    if (!isVideoSourceFilenameValid(o.source?.filename)) o.source = undefined

    if (!isVideoOriginallyPublishedAtValid(o.originallyPublishedAt)) o.originallyPublishedAt = null

    if (!isArray(o.tags)) o.tags = []
    if (!isArray(o.captions)) o.captions = []

    o.tags = o.tags.filter(t => isVideoTagValid(t))
    o.captions = o.captions.filter(c => isVideoCaptionLanguageValid(c.language))

    if (o.isLive) {
      if (!o.live) return undefined
      if (!isBooleanValid(o.live.permanentLive)) return undefined

      if (!isBooleanValid(o.live.saveReplay)) o.live.saveReplay = false
      if (o.live.saveReplay && !isVideoReplayPrivacyValid(o.live.replaySettings.privacy)) return undefined

      if (!isLiveLatencyModeValid(o.live.latencyMode)) o.live.latencyMode = LiveVideoLatencyMode.DEFAULT

      if (!o.live.streamKey) o.live.streamKey = buildUUID()
      else if (!isUUIDValid(o.live.streamKey)) return undefined
    }

    if (o.privacy === VideoPrivacy.PASSWORD_PROTECTED) {
      if (!isArray(o.passwords)) return undefined
      // Refuse the import rather than handle only a portion of the passwords, which can be difficult for video owners to debug
      if (o.passwords.some(p => !isPasswordValid(p))) return undefined
    }

    return pick(o, [
      'name',
      'duration',
      'channel',
      'privacy',
      'archiveFiles',
      'category',
      'licence',
      'language',
      'description',
      'support',
      'nsfw',
      'isLive',
      'commentsEnabled',
      'downloadEnabled',
      'waitTranscoding',
      'originallyPublishedAt',
      'tags',
      'captions',
      'live',
      'passwords',
      'source'
    ])
  }

  protected async importObject (videoImportData: SanitizedObject) {
    const videoFilePath = this.getSafeArchivePathOrThrow(videoImportData.archiveFiles.videoFile)
    const videoSize = await getFileSize(videoFilePath)

    if (await isUserQuotaValid({ userId: this.user.id, uploadSize: videoSize, checkDaily: false }) === false) {
      throw new Error(`Cannot import video ${videoImportData.name} for user ${this.user.username} because of exceeded quota`)
    }

    const videoChannel = await VideoChannelModel.loadLocalByNameAndPopulateAccount(videoImportData.channel.name)
    if (!videoChannel) throw new Error(`Channel ${videoImportData} not found`)
    if (videoChannel.accountId !== this.user.Account.id) {
      throw new Error(`Channel ${videoChannel.name} is not owned by user ${this.user.username}`)
    }

    const existingVideo = await VideoModel.loadByNameAndChannel(videoChannel, videoImportData.name)
    if (existingVideo && Math.abs(existingVideo.duration - videoImportData.duration) <= 1) {
      logger.info(`Do not import video ${videoImportData.name} that already exists in the account`, lTags())
      return { duplicate: true }
    }

    const ffprobe = await ffprobePromise(videoFilePath)
    const duration = await getVideoStreamDuration(videoFilePath, ffprobe)
    const videoFile = await buildNewFile({ path: videoFilePath, mode: 'web-video', ffprobe })

    await this.checkVideoFileIsAcceptedOrThrow({ videoFilePath, size: videoFile.size, channel: videoChannel, videoImportData })

    let videoData = {
      ...pick(videoImportData, [
        'name',
        'category',
        'licence',
        'language',
        'privacy',
        'description',
        'support',
        'isLive',
        'nsfw',
        'commentsEnabled',
        'downloadEnabled',
        'waitTranscoding'
      ]),

      uuid: buildUUID(),
      duration,
      remote: false,
      state: buildNextVideoState(),
      channelId: videoChannel.id,
      originallyPublishedAt: videoImportData.originallyPublishedAt
        ? new Date(videoImportData.originallyPublishedAt)
        : undefined
    }

    videoData = await Hooks.wrapObject(videoData, 'filter:api.video.user-import.video-attribute.result')

    const video = new VideoModel(videoData) as MVideoFullLight
    video.VideoChannel = videoChannel
    video.url = getLocalVideoActivityPubUrl(video)

    const destination = VideoPathManager.Instance.getFSVideoFileOutputPath(video, videoFile)
    await move(videoFilePath, destination)

    const thumbnailPath = this.getSafeArchivePathOrThrow(videoImportData.archiveFiles.thumbnail)

    const thumbnails: MThumbnail[] = []
    for (const type of [ ThumbnailType.MINIATURE, ThumbnailType.PREVIEW ]) {
      if (!await this.isFileValidOrLog(thumbnailPath, CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max)) continue

      thumbnails.push(
        await updateLocalVideoMiniatureFromExisting({
          inputPath: thumbnailPath,
          video,
          type,
          automaticallyGenerated: false,
          keepOriginal: true
        })
      )
    }

    const { videoCreated } = await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = { transaction: t }

      const videoCreated = await video.save(sequelizeOptions) as MVideoFullLight

      for (const thumbnail of thumbnails) {
        await videoCreated.addAndSaveThumbnail(thumbnail, t)
      }

      videoFile.videoId = video.id
      await videoFile.save(sequelizeOptions)

      video.VideoFiles = [ videoFile ]

      await setVideoTags({ video, tags: videoImportData.tags, transaction: t })

      await autoBlacklistVideoIfNeeded({
        video,
        user: this.user,
        isRemote: false,
        isNew: true,
        isNewFile: true,
        transaction: t
      })

      if (videoImportData.source?.filename) {
        await VideoSourceModel.create({
          filename: videoImportData.source.filename,
          videoId: video.id
        }, { transaction: t })
      }

      if (videoImportData.privacy === VideoPrivacy.PASSWORD_PROTECTED) {
        await VideoPasswordModel.addPasswords(videoImportData.passwords, video.id, t)
      }

      if (videoImportData.isLive) {
        const videoLive = new VideoLiveModel(pick(videoImportData.live, [ 'saveReplay', 'permanentLive', 'latencyMode', 'streamKey' ]))

        if (videoLive.saveReplay) {
          const replaySettings = new VideoLiveReplaySettingModel({
            privacy: videoImportData.live.replaySettings.privacy
          })
          await replaySettings.save(sequelizeOptions)

          videoLive.replaySettingId = replaySettings.id
        }

        videoLive.videoId = videoCreated.id
        videoCreated.VideoLive = await videoLive.save(sequelizeOptions)
      }

      return { videoCreated }
    })

    await this.importCaptions(videoCreated, videoImportData)

    await addVideoJobsAfterCreation({ video: videoCreated, videoFile })

    logger.info('Video %s imported.', video.name, lTags(videoCreated.uuid))

    return { duplicate: false }
  }

  private async importCaptions (video: MVideoFullLight, videoImportData: SanitizedObject) {
    const captionPaths: string[] = []

    for (const captionImport of videoImportData.captions) {
      const relativeFilePath = videoImportData.archiveFiles?.captions?.[captionImport.language]

      if (!relativeFilePath) {
        logger.warn('Cannot import caption ' + captionImport.language + ': file does not exist in the archive', lTags(video.uuid))
        continue
      }

      const absoluteFilePath = this.getSafeArchivePathOrThrow(relativeFilePath)

      if (!await this.isFileValidOrLog(absoluteFilePath, CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max)) continue

      const videoCaption = new VideoCaptionModel({
        videoId: video.id,
        filename: VideoCaptionModel.generateCaptionName(captionImport.language),
        language: captionImport.language
      }) as MVideoCaption

      await moveAndProcessCaptionFile({ path: absoluteFilePath }, videoCaption)

      await sequelizeTypescript.transaction(async (t) => {
        await VideoCaptionModel.insertOrReplaceLanguage(videoCaption, t)
      })

      captionPaths.push(absoluteFilePath)
    }

    return captionPaths
  }

  private async checkVideoFileIsAcceptedOrThrow (options: {
    videoFilePath: string
    size: number
    channel: MChannelId
    videoImportData: SanitizedObject
  }) {
    const { videoFilePath, size, videoImportData, channel } = options

    // Check we accept this video
    const acceptParameters = {
      videoBody: {
        ...videoImportData,

        channelId: channel.id
      },
      videoFile: {
        path: videoFilePath,
        filename: parse(videoFilePath).name,
        size,
        originalname: null
      },
      user: this.user
    }
    const acceptedResult = await Hooks.wrapFun(isLocalVideoFileAccepted, acceptParameters, 'filter:api.video.user-import.accept.result')

    if (!acceptedResult || acceptedResult.accepted !== true) {
      logger.info('Refused local video file to import.', { acceptedResult, acceptParameters, ...lTags() })

      throw new Error('Video file is not accepted: ' + acceptedResult.errorMessage || 'unknown reason')
    }
  }
}

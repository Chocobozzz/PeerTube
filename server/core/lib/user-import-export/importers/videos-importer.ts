import { pick } from '@peertube/peertube-core-utils'
import { ffprobePromise, getVideoStreamDuration } from '@peertube/peertube-ffmpeg'
import {
  LiveVideoLatencyMode,
  ThumbnailType,
  VideoCommentPolicy,
  VideoExportJSON,
  VideoPrivacy,
  VideoState
} from '@peertube/peertube-models'
import { buildUUID, getFileSize } from '@peertube/peertube-node-utils'
import { isArray, isBooleanValid, isUUIDValid } from '@server/helpers/custom-validators/misc.js'
import { isVideoCaptionLanguageValid } from '@server/helpers/custom-validators/video-captions.js'
import { isVideoChannelUsernameValid } from '@server/helpers/custom-validators/video-channels.js'
import { isVideoChapterTimecodeValid, isVideoChapterTitleValid } from '@server/helpers/custom-validators/video-chapters.js'
import { isLiveLatencyModeValid } from '@server/helpers/custom-validators/video-lives.js'
import {
  isPasswordValid,
  isVideoCategoryValid,
  isVideoCommentsPolicyValid,
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
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { LocalVideoCreator, ThumbnailOptions } from '@server/lib/local-video-creator.js'
import { isLocalVideoFileAccepted } from '@server/lib/moderation.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { isUserQuotaValid } from '@server/lib/user.js'
import { createLocalCaption } from '@server/lib/video-captions.js'
import { buildNextVideoState } from '@server/lib/video-state.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoModel } from '@server/models/video/video.js'
import { MChannelId, MVideoFullLight } from '@server/types/models/index.js'
import { FfprobeData } from 'fluent-ffmpeg'
import { parse } from 'path'
import { AbstractUserImporter } from './abstract-user-importer.js'

const lTags = loggerTagsFactory('user-import')

type ImportObject = VideoExportJSON['videos'][0]
type SanitizedObject = Pick<ImportObject, 'name' | 'duration' | 'channel' | 'privacy' | 'archiveFiles' | 'captions' | 'category' |
'licence' | 'language' | 'description' | 'support' | 'nsfw' | 'isLive' | 'commentsPolicy' | 'downloadEnabled' | 'waitTranscoding' |
'originallyPublishedAt' | 'tags' | 'live' | 'passwords' | 'source' | 'chapters'>

export class VideosImporter extends AbstractUserImporter <VideoExportJSON, ImportObject, SanitizedObject> {

  protected getImportObjects (json: VideoExportJSON) {
    return json.videos
  }

  protected sanitize (o: ImportObject) {
    if (!isVideoNameValid(o.name)) return undefined
    if (!isVideoDurationValid(o.duration + '')) return undefined
    if (!isVideoChannelUsernameValid(o.channel?.name)) return undefined
    if (!isVideoPrivacyValid(o.privacy)) return undefined
    if (o.isLive !== true && !o.archiveFiles?.videoFile) return undefined

    if (!isVideoCategoryValid(o.category)) o.category = null
    if (!o.licence || !isVideoLicenceValid(o.licence)) o.licence = CONFIG.DEFAULTS.PUBLISH.LICENCE
    if (!isVideoLanguageValid(o.language)) o.language = null
    if (!isVideoDescriptionValid(o.description)) o.description = null
    if (!isVideoSupportValid(o.support)) o.support = null

    if (!isBooleanValid(o.nsfw)) o.nsfw = false
    if (!isBooleanValid(o.isLive)) o.isLive = false
    if (!isBooleanValid(o.downloadEnabled)) o.downloadEnabled = CONFIG.DEFAULTS.PUBLISH.DOWNLOAD_ENABLED
    if (!isBooleanValid(o.waitTranscoding)) o.waitTranscoding = true

    if (!o.commentsPolicy || !isVideoCommentsPolicyValid(o.commentsPolicy)) {
      // Fallback to deprecated property
      if (isBooleanValid(o.commentsEnabled)) {
        o.commentsPolicy = o.commentsEnabled === true
          ? VideoCommentPolicy.ENABLED
          : VideoCommentPolicy.DISABLED
      } else {
        o.commentsPolicy = CONFIG.DEFAULTS.PUBLISH.COMMENTS_POLICY
      }
    }

    if (!isVideoSourceFilenameValid(o.source?.inputFilename)) o.source = undefined

    if (!isVideoOriginallyPublishedAtValid(o.originallyPublishedAt)) o.originallyPublishedAt = null

    if (!isArray(o.tags)) o.tags = []
    if (!isArray(o.captions)) o.captions = []
    if (!isArray(o.chapters)) o.chapters = []

    o.tags = o.tags.filter(t => isVideoTagValid(t))
    o.captions = o.captions.filter(c => isVideoCaptionLanguageValid(c.language))
    o.chapters = o.chapters.filter(c => isVideoChapterTimecodeValid(c.timecode) && isVideoChapterTitleValid(c.title))

    if (o.isLive) {
      if (!o.live) return undefined
      if (!isBooleanValid(o.live.permanentLive)) return undefined

      if (!isBooleanValid(o.live.saveReplay)) o.live.saveReplay = false
      if (o.live.saveReplay && !isVideoReplayPrivacyValid(o.live.replaySettings.privacy)) return undefined

      if (!o.live.latencyMode || !isLiveLatencyModeValid(o.live.latencyMode)) o.live.latencyMode = LiveVideoLatencyMode.DEFAULT

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
      'commentsPolicy',
      'downloadEnabled',
      'waitTranscoding',
      'originallyPublishedAt',
      'tags',
      'captions',
      'live',
      'passwords',
      'source',
      'chapters'
    ])
  }

  protected async importObject (videoImportData: SanitizedObject) {
    const videoFilePath = !videoImportData.isLive
      ? this.getSafeArchivePathOrThrow(videoImportData.archiveFiles.videoFile)
      : null

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

    const videoSize = videoFilePath
      ? await getFileSize(videoFilePath)
      : undefined

    let duration = 0

    let ffprobe: FfprobeData
    if (videoFilePath) {
      if (await isUserQuotaValid({ userId: this.user.id, uploadSize: videoSize, checkDaily: false }) === false) {
        throw new Error(`Cannot import video ${videoImportData.name} for user ${this.user.username} because of exceeded quota`)
      }

      await this.checkVideoFileIsAcceptedOrThrow({ videoFilePath, size: videoSize, channel: videoChannel, videoImportData })

      ffprobe = await ffprobePromise(videoFilePath)
      duration = await getVideoStreamDuration(videoFilePath, ffprobe)
    }

    const thumbnailPath = this.getSafeArchivePathOrThrow(videoImportData.archiveFiles.thumbnail)

    const thumbnails: ThumbnailOptions = []
    for (const type of [ ThumbnailType.MINIATURE, ThumbnailType.PREVIEW ]) {
      if (!await this.isFileValidOrLog(thumbnailPath, CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max)) continue

      thumbnails.push({
        path: thumbnailPath,
        automaticallyGenerated: false,
        keepOriginal: true,
        type
      })
    }

    const localVideoCreator = new LocalVideoCreator({
      lTags,

      videoFile: videoFilePath
        ? { path: videoFilePath, probe: ffprobe }
        : undefined,

      user: this.user,
      channel: videoChannel,

      chapters: videoImportData.chapters,
      fallbackChapters: {
        fromDescription: false,
        finalFallback: undefined
      },

      videoAttributes: {
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
          'tags',
          'commentsPolicy',
          'downloadEnabled',
          'waitTranscoding',
          'originallyPublishedAt'
        ]),

        videoPasswords: videoImportData.passwords,
        duration,

        inputFilename: videoImportData.source?.inputFilename,

        state: videoImportData.isLive
          ? VideoState.WAITING_FOR_LIVE
          : buildNextVideoState()
      },

      liveAttributes: videoImportData.live,

      videoAttributeResultHook: 'filter:api.video.user-import.video-attribute.result',

      thumbnails
    })

    const { video } = await localVideoCreator.create()

    await this.importCaptions(video, videoImportData)

    logger.info('Video %s imported.', video.name, lTags(video.uuid))

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

      await createLocalCaption({ video, language: captionImport.language, path: absoluteFilePath })

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

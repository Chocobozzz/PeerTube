import { buildAspectRatio } from '@peertube/peertube-core-utils'
import {
  LiveVideoCreate,
  LiveVideoLatencyMode,
  ThumbnailType,
  ThumbnailType_Type,
  VideoCreate,
  VideoPrivacy,
  VideoStateType
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { LoggerTagsFn, logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { ScheduleVideoUpdateModel } from '@server/models/video/schedule-video-update.js'
import { VideoLiveReplaySettingModel } from '@server/models/video/video-live-replay-setting.js'
import { VideoLiveModel } from '@server/models/video/video-live.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { VideoModel } from '@server/models/video/video.js'
import { MChannel, MChannelAccountLight, MThumbnail, MUser, MVideoFile, MVideoFullLight } from '@server/types/models/index.js'
import { FilteredModelAttributes } from '@server/types/sequelize.js'
import { FfprobeData } from 'fluent-ffmpeg'
import { move } from 'fs-extra/esm'
import { getLocalVideoActivityPubUrl } from './activitypub/url.js'
import { federateVideoIfNeeded } from './activitypub/videos/federate.js'
import { Hooks } from './plugins/hooks.js'
import { generateLocalVideoMiniature, updateLocalVideoMiniatureFromExisting } from './thumbnail.js'
import { autoBlacklistVideoIfNeeded } from './video-blacklist.js'
import { replaceChapters, replaceChaptersFromDescriptionIfNeeded } from './video-chapters.js'
import { buildNewFile, createVideoSource } from './video-file.js'
import { addVideoJobsAfterCreation } from './video-jobs.js'
import { VideoPathManager } from './video-path-manager.js'
import { setVideoTags } from './video.js'

type VideoAttributes = Omit<VideoCreate, 'channelId'> & {
  duration: number
  isLive: boolean
  state: VideoStateType
  inputFilename: string
}

type LiveAttributes = Pick<LiveVideoCreate, 'permanentLive' | 'latencyMode' | 'saveReplay' | 'replaySettings'> & {
  streamKey?: string
}

export type ThumbnailOptions = {
  path: string
  type: ThumbnailType_Type
  automaticallyGenerated: boolean
  keepOriginal: boolean
}[]

type ChaptersOption = { timecode: number, title: string }[]

type VideoAttributeHookFilter =
  'filter:api.video.user-import.video-attribute.result' |
  'filter:api.video.upload.video-attribute.result' |
  'filter:api.video.live.video-attribute.result'

export class LocalVideoCreator {
  private readonly lTags: LoggerTagsFn

  private readonly videoFilePath: string | undefined
  private readonly videoFileProbe: FfprobeData

  private readonly videoAttributes: VideoAttributes
  private readonly liveAttributes: LiveAttributes | undefined

  private readonly channel: MChannelAccountLight
  private readonly videoAttributeResultHook: VideoAttributeHookFilter

  private video: MVideoFullLight
  private videoFile: MVideoFile
  private videoPath: string

  constructor (private readonly options: {
    lTags: LoggerTagsFn

    videoFile: {
      path: string
      probe: FfprobeData
    }

    videoAttributes: VideoAttributes
    liveAttributes: LiveAttributes

    channel: MChannelAccountLight
    user: MUser
    videoAttributeResultHook: VideoAttributeHookFilter
    thumbnails: ThumbnailOptions

    chapters: ChaptersOption | undefined
    fallbackChapters: {
      fromDescription: boolean
      finalFallback: ChaptersOption | undefined
    }
  }) {
    this.videoFilePath = options.videoFile?.path
    this.videoFileProbe = options.videoFile?.probe

    this.videoAttributes = options.videoAttributes
    this.liveAttributes = options.liveAttributes

    this.channel = options.channel

    this.videoAttributeResultHook = options.videoAttributeResultHook
  }

  async create () {
    this.video = new VideoModel(
      await Hooks.wrapObject(this.buildVideo(this.videoAttributes, this.channel), this.videoAttributeResultHook)
    ) as MVideoFullLight

    this.video.VideoChannel = this.channel
    this.video.url = getLocalVideoActivityPubUrl(this.video)

    if (this.videoFilePath) {
      this.videoFile = await buildNewFile({ path: this.videoFilePath, mode: 'web-video', ffprobe: this.videoFileProbe })

      this.videoPath = VideoPathManager.Instance.getFSVideoFileOutputPath(this.video, this.videoFile)
      await move(this.videoFilePath, this.videoPath)

      this.video.aspectRatio = buildAspectRatio({ width: this.videoFile.width, height: this.videoFile.height })
    }

    const thumbnails = await this.createThumbnails()

    await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async transaction => {
        await this.video.save({ transaction })

        for (const thumbnail of thumbnails) {
          await this.video.addAndSaveThumbnail(thumbnail, transaction)
        }

        if (this.videoFile) {
          this.videoFile.videoId = this.video.id
          await this.videoFile.save({ transaction })

          this.video.VideoFiles = [ this.videoFile ]
        }

        await setVideoTags({ video: this.video, tags: this.videoAttributes.tags, transaction })

        // Schedule an update in the future?
        if (this.videoAttributes.scheduleUpdate) {
          await ScheduleVideoUpdateModel.create({
            videoId: this.video.id,
            updateAt: new Date(this.videoAttributes.scheduleUpdate.updateAt),
            privacy: this.videoAttributes.scheduleUpdate.privacy || null
          }, { transaction })
        }

        if (this.options.chapters) {
          await replaceChapters({ video: this.video, chapters: this.options.chapters, transaction })
        } else if (this.options.fallbackChapters.fromDescription) {
          if (!await replaceChaptersFromDescriptionIfNeeded({ newDescription: this.video.description, video: this.video, transaction })) {
            await replaceChapters({ video: this.video, chapters: this.options.fallbackChapters.finalFallback, transaction })
          }
        }

        await autoBlacklistVideoIfNeeded({
          video: this.video,
          user: this.options.user,
          isRemote: false,
          isNew: true,
          isNewFile: true,
          transaction
        })

        if (this.videoAttributes.privacy === VideoPrivacy.PASSWORD_PROTECTED) {
          await VideoPasswordModel.addPasswords(this.videoAttributes.videoPasswords, this.video.id, transaction)
        }

        if (this.videoAttributes.isLive) {
          const videoLive = new VideoLiveModel({
            saveReplay: this.liveAttributes.saveReplay || false,
            permanentLive: this.liveAttributes.permanentLive || false,
            latencyMode: this.liveAttributes.latencyMode || LiveVideoLatencyMode.DEFAULT,
            streamKey: this.liveAttributes.streamKey || buildUUID()
          })

          if (videoLive.saveReplay) {
            const replaySettings = new VideoLiveReplaySettingModel({
              privacy: this.liveAttributes.replaySettings?.privacy ?? this.video.privacy
            })
            await replaySettings.save({ transaction })

            videoLive.replaySettingId = replaySettings.id
          }

          videoLive.videoId = this.video.id
          this.video.VideoLive = await videoLive.save({ transaction })
        }

        if (this.videoFile) {
          transaction.afterCommit(() => {
            addVideoJobsAfterCreation({ video: this.video, videoFile: this.videoFile })
              .catch(err => logger.error('Cannot build new video jobs of %s.', this.video.uuid, { err, ...this.lTags(this.video.uuid) }))
          })
        } else {
          await federateVideoIfNeeded(this.video, true, transaction)
        }
      }).catch(err => {
        // Reset elements to reinsert them in the database
        this.video.isNewRecord = true
        if (this.videoFile) this.videoFile.isNewRecord = true

        for (const t of thumbnails) {
          t.isNewRecord = true
        }

        throw err
      })
    })

    if (this.videoAttributes.inputFilename) {
      await createVideoSource({
        inputFilename: this.videoAttributes.inputFilename,
        inputPath: this.videoPath,
        inputProbe: this.videoFileProbe,
        video: this.video
      })
    }

    // Channel has a new content, set as updated
    await this.channel.setAsUpdated()

    return { video: this.video, videoFile: this.videoFile }
  }

  private async createThumbnails () {
    const promises: Promise<MThumbnail>[] = []
    let toGenerate = [ ThumbnailType.MINIATURE, ThumbnailType.PREVIEW ]

    for (const type of [ ThumbnailType.MINIATURE, ThumbnailType.PREVIEW ]) {
      const thumbnail = this.options.thumbnails.find(t => t.type === type)
      if (!thumbnail) continue

      promises.push(
        updateLocalVideoMiniatureFromExisting({
          inputPath: thumbnail.path,
          video: this.video,
          type,
          automaticallyGenerated: thumbnail.automaticallyGenerated || false,
          keepOriginal: thumbnail.keepOriginal
        })
      )

      toGenerate = toGenerate.filter(t => t !== thumbnail.type)
    }

    return [
      ...await Promise.all(promises),

      ...await generateLocalVideoMiniature({
        video: this.video,
        videoFile: this.videoFile,
        types: toGenerate,
        ffprobe: this.videoFileProbe
      })
    ]
  }

  private buildVideo (videoInfo: VideoAttributes, channel: MChannel): FilteredModelAttributes<VideoModel> {
    return {
      name: videoInfo.name,
      state: videoInfo.state,
      remote: false,
      category: videoInfo.category,
      licence: videoInfo.licence ?? CONFIG.DEFAULTS.PUBLISH.LICENCE,
      language: videoInfo.language,
      commentsEnabled: videoInfo.commentsEnabled ?? CONFIG.DEFAULTS.PUBLISH.COMMENTS_ENABLED,
      downloadEnabled: videoInfo.downloadEnabled ?? CONFIG.DEFAULTS.PUBLISH.DOWNLOAD_ENABLED,
      waitTranscoding: videoInfo.waitTranscoding || false,
      nsfw: videoInfo.nsfw || false,
      description: videoInfo.description,
      support: videoInfo.support,
      privacy: videoInfo.privacy || VideoPrivacy.PRIVATE,
      isLive: videoInfo.isLive,
      channelId: channel.id,
      originallyPublishedAt: videoInfo.originallyPublishedAt
        ? new Date(videoInfo.originallyPublishedAt)
        : null,

      uuid: buildUUID(),
      duration: videoInfo.duration
    }
  }
}

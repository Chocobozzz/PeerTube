import { exists, forceNumber } from '@peertube/peertube-core-utils'
import {
  ManageVideoTorrentPayload,
  NSFWFlag,
  VideoChannelActivityAction,
  VideoPrivacy,
  VideoPrivacyType,
  VideoUpdate
} from '@peertube/peertube-models'
import { auditLoggerFactory, getAuditIdFromUser, VideoAuditView } from '@server/helpers/audit-logger.js'
import { logger, loggerTagsFactory, LoggerTagsFn } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { getServerAccount } from '@server/models/application/application.js'
import { ScheduleVideoUpdateModel } from '@server/models/video/schedule-video-update.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { VideoModel } from '@server/models/video/video.js'
import { MChannelBannerAccountDefault, MThumbnail, MUserAccountUrl, MVideo, MVideoFull, MVideoUUID } from '@server/types/models/index.js'
import { FilteredModelAttributes } from '@server/types/sequelize.js'
import { Transaction } from 'sequelize'
import { sendDeleteVideo } from './activitypub/send/send-delete.js'
import { changeVideoChannelShare } from './activitypub/share.js'
import { isPrivacyForFederation } from './activitypub/videos/index.js'
import { AutomaticTagger } from './automatic-tags/automatic-tagger.js'
import { setAndSaveVideoAutomaticTags } from './automatic-tags/automatic-tags.js'
import { CreateJobTypeAndPayload, JobQueue } from './job-queue/job-queue.js'
import { autoBlacklistVideoIfNeeded } from './video-blacklist.js'
import { replaceChaptersFromDescriptionIfNeeded } from './video-chapters.js'
import { VideoPathManager } from './video-path-manager.js'
import { isNewVideoForSubscription, moveFilesIfPrivacyChanged } from './video-privacy.js'
import { setVideoTags } from './video.js'

const auditLogger = auditLoggerFactory('videos')

export class LocalVideoUpdater {
  private readonly lTags: LoggerTagsFn
  private readonly oldVideo: MVideoFull
  private readonly user: MUserAccountUrl | null

  private readonly oldPrivacy: VideoPrivacyType
  private readonly hadPrivacyForFederation: boolean

  private readonly oldVideoAuditView: VideoAuditView

  constructor (options: {
    tags: (string | number)[]

    video: MVideoFull
    user: MUserAccountUrl | null
  }) {
    this.user = options.user
    this.oldVideo = options.video
    this.lTags = loggerTagsFactory(...options.tags, options.video.uuid)

    this.hadPrivacyForFederation = isPrivacyForFederation(this.oldVideo.privacy)
    this.oldPrivacy = this.oldVideo.privacy

    this.oldVideoAuditView = new VideoAuditView(this.oldVideo.toFormattedDetailsJSON())
  }

  async update (options: Omit<VideoUpdate, 'thumbnailfile' | 'previewfile'> & {
    thumbnails?: MThumbnail[]
    channel?: MChannelBannerAccountDefault
  }) {
    const videoFileLockReleaser = await VideoPathManager.Instance.lockFiles(this.oldVideo.uuid)

    try {
      const { video, newVideoForSubscription } = await sequelizeTypescript.transaction(async t => {
        // Refresh video to prevent concurrent updates
        const video = await VideoModel.loadFull(this.oldVideo.id, t)

        const oldName = video.name
        const oldDescription = video.description
        const oldVideoChannel = video.VideoChannel

        const keysToUpdate: (keyof VideoUpdate & FilteredModelAttributes<VideoModel>)[] = [
          'name',
          'category',
          'licence',
          'language',
          'nsfw',
          'nsfwFlags',
          'nsfwSummary',
          'waitTranscoding',
          'support',
          'description',
          'downloadEnabled',
          'commentsPolicy'
        ]

        for (const key of keysToUpdate) {
          if (options[key] !== undefined) video.set(key, options[key])
        }

        if (video.nsfw !== true) {
          video.nsfwFlags = NSFWFlag.NONE
          video.nsfwSummary = null
        }

        if (options.originallyPublishedAt !== undefined) {
          video.originallyPublishedAt = options.originallyPublishedAt
            ? new Date(options.originallyPublishedAt)
            : null
        }

        // Privacy update?
        let newVideoForSubscription = false

        if (options.privacy !== undefined) {
          newVideoForSubscription = isNewVideoForSubscription({
            currentPrivacy: video.privacy,
            newPrivacy: options.privacy,
            firstPublishedAt: video.firstPublishedAt
          })

          await this.updateVideoPrivacy({
            video,
            privacy: options.privacy,
            passwords: options.videoPasswords,
            hadPrivacyForFederation: this.hadPrivacyForFederation,
            transaction: t
          })
        }

        // Force updatedAt attribute change
        if (!video.changed()) {
          await video.setAsRefreshed(t)
        }

        await video.save({ transaction: t })

        if (options.thumbnails && options.thumbnails.length !== 0) {
          await video.replaceAndSaveThumbnails(options.thumbnails, t)
        }

        if (options.tags !== undefined) {
          await setVideoTags({ video, tags: options.tags, transaction: t })
        }

        // Channel update
        if (options.channel && video.channelId !== options.channel.id) {
          const oldChannel = video.VideoChannel
          const newChannel = options.channel

          if (this.user) {
            await VideoChannelActivityModel.addVideoActivity({
              action: VideoChannelActivityAction.REMOVE_CHANNEL_OWNERSHIP,
              user: this.user,
              channel: oldChannel,
              video,
              transaction: t
            })

            await VideoChannelActivityModel.addVideoActivity({
              action: VideoChannelActivityAction.CREATE_CHANNEL_OWNERSHIP,
              user: this.user,
              channel: newChannel,
              video,
              transaction: t
            })
          }

          await video.$set('VideoChannel', newChannel, { transaction: t })
          video.VideoChannel = newChannel

          if (this.hadPrivacyForFederation === true) {
            await changeVideoChannelShare(video, oldVideoChannel, t)
          }
        } else if (this.user) {
          await VideoChannelActivityModel.addVideoActivity({
            action: VideoChannelActivityAction.UPDATE,
            user: this.user,
            channel: video.VideoChannel,
            video,
            transaction: t
          })
        }

        // Schedule an update?
        await this.updateScheduleIfNeeded({
          video,
          scheduleUpdate: options.scheduleUpdate,
          transaction: t
        })

        if (oldDescription !== video.description) {
          await replaceChaptersFromDescriptionIfNeeded({
            video,
            newDescription: video.description,
            transaction: t,
            oldDescription
          })
        }

        let automaticTagsByAccount: Record<number, string[]>
        if (oldName !== video.name || oldDescription !== video.description) {
          automaticTagsByAccount = await new AutomaticTagger().buildVideoAutomaticTags({
            serverAccount: await getServerAccount(),
            video,
            transaction: t
          })
          await setAndSaveVideoAutomaticTags({ video, automaticTagsByAccount, transaction: t })
        }

        await autoBlacklistVideoIfNeeded({
          video,
          user: this.user,
          isRemote: false,
          isNew: false,
          isNewFile: false,
          automaticTagsByAccount,
          transaction: t
        })

        if (this.user) {
          auditLogger.update(
            getAuditIdFromUser(this.user),
            new VideoAuditView(video.toFormattedDetailsJSON()),
            this.oldVideoAuditView
          )
        }

        logger.info('Video with name %s and uuid %s updated.', video.name, video.uuid, this.lTags())

        return { video, newVideoForSubscription }
      })

      const nameChanged = exists(options.name)

      const filePathChanged = exists(this.oldPrivacy)
        ? await moveFilesIfPrivacyChanged(video, this.oldPrivacy)
        : false

      await this.rebuildHLSInfoHashesIfNeeded({ video, filePathChanged })

      const jobs: CreateJobTypeAndPayload[] = []

      jobs.push(...this.buildUpdateTorrentJobIfNeeded({ video, nameChanged, filePathChanged }))
      jobs.push(...this.buildFederationJob({ video }))
      jobs.push(...this.buildNotifyJobIfNeeded({ video, newVideoForSubscription }))

      await JobQueue.Instance.createSequentialJobFlow(...jobs)

      return video
    } finally {
      videoFileLockReleaser()
    }
  }

  // Return a boolean indicating if the video is considered as "new" for remote instances in the federation
  private async updateVideoPrivacy (options: {
    video: MVideoFull
    privacy: VideoUpdate['privacy']
    passwords: VideoUpdate['videoPasswords']
    hadPrivacyForFederation: boolean
    transaction: Transaction
  }) {
    const { video, privacy, passwords, hadPrivacyForFederation, transaction } = options

    const newPrivacy = forceNumber(privacy) as VideoPrivacyType
    this.setVideoPrivacy(video, newPrivacy)

    // Delete passwords if video is not anymore password protected
    if (video.privacy === VideoPrivacy.PASSWORD_PROTECTED && newPrivacy !== VideoPrivacy.PASSWORD_PROTECTED) {
      await VideoPasswordModel.deleteAllPasswords(video.id, transaction)
    }

    if (newPrivacy === VideoPrivacy.PASSWORD_PROTECTED && exists(passwords)) {
      await VideoPasswordModel.deleteAllPasswords(video.id, transaction)
      await VideoPasswordModel.addPasswords(passwords, video.id, transaction)
    }

    // Unfederate the video if the new privacy is not compatible with federation
    if (hadPrivacyForFederation && !isPrivacyForFederation(video.privacy)) {
      await sendDeleteVideo({ video, deleteForPrivacyChange: true, transaction })
    }
  }

  private async updateScheduleIfNeeded (options: {
    video: MVideoFull
    scheduleUpdate: VideoUpdate['scheduleUpdate']
    transaction: Transaction
  }) {
    const { video, scheduleUpdate, transaction } = options

    if (scheduleUpdate) {
      const updateAt = new Date(scheduleUpdate.updateAt)

      video.publishedAt = updateAt
      await video.save({ transaction })

      await ScheduleVideoUpdateModel.upsert({
        videoId: video.id,
        updateAt,
        privacy: scheduleUpdate.privacy || null
      }, { transaction })

      return
    }

    if (scheduleUpdate === null) {
      const deleted = await ScheduleVideoUpdateModel.deleteByVideoId(video.id, transaction)

      if (deleted) {
        video.publishedAt = new Date()
        await video.save({ transaction })
      }
    }
  }

  private setVideoPrivacy (video: MVideo, newPrivacy: VideoPrivacyType) {
    if (video.privacy === VideoPrivacy.PRIVATE && newPrivacy !== VideoPrivacy.PRIVATE) {
      video.publishedAt = new Date()

      if (!video.firstPublishedAt) {
        video.firstPublishedAt = video.publishedAt
      }
    }

    video.privacy = newPrivacy
  }

  private async rebuildHLSInfoHashesIfNeeded (options: {
    video: MVideoFull
    filePathChanged: boolean
  }) {
    const { video, filePathChanged } = options

    const hls = video.getHLSPlaylist()

    if (filePathChanged && hls) {
      logger.debug('Updating HLS playlist file paths after privacy change', this.lTags())

      await hls.buildAndSetInfoHashes(video, hls.VideoFiles)
      await hls.save()
    }
  }

  private buildUpdateTorrentJobIfNeeded (options: {
    video: MVideoFull
    nameChanged: boolean
    filePathChanged: boolean
  }) {
    const { video, nameChanged, filePathChanged } = options

    const jobs: CreateJobTypeAndPayload[] = []

    if (!video.isLive && (nameChanged || filePathChanged)) {
      logger.debug('Updating video torrent metadata after name or file path change', this.lTags())

      for (const file of (video.VideoFiles || [])) {
        const payload: ManageVideoTorrentPayload = { action: 'update-metadata', videoId: video.id, videoFileId: file.id }

        jobs.push({ type: 'manage-video-torrent', payload })
      }

      const hls = video.getHLSPlaylist()

      for (const file of (hls?.VideoFiles || [])) {
        const payload: ManageVideoTorrentPayload = { action: 'update-metadata', streamingPlaylistId: hls.id, videoFileId: file.id }

        jobs.push({ type: 'manage-video-torrent', payload })
      }
    }

    return jobs
  }

  private buildFederationJob (options: {
    video: MVideoUUID
  }): CreateJobTypeAndPayload[] {
    const { video } = options

    return [
      {
        type: 'federate-video',
        payload: { videoUUID: video.uuid }
      }
    ]
  }

  private buildNotifyJobIfNeeded (options: {
    video: MVideoUUID
    newVideoForSubscription: boolean
  }): CreateJobTypeAndPayload[] {
    const { video, newVideoForSubscription } = options
    if (!newVideoForSubscription) return []

    logger.debug('Video is considered new for subscriptions: create the notification job', this.lTags())

    return [
      {
        type: 'notify',
        payload: {
          action: 'new-video',
          videoUUID: video.uuid
        }
      }
    ]
  }
}

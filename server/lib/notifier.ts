import { UserNotificationSettingValue, UserNotificationType, UserRight } from '../../shared/models/users'
import { logger } from '../helpers/logger'
import { VideoModel } from '../models/video/video'
import { Emailer } from './emailer'
import { UserNotificationModel } from '../models/account/user-notification'
import { VideoCommentModel } from '../models/video/video-comment'
import { UserModel } from '../models/account/user'
import { PeerTubeSocket } from './peertube-socket'
import { CONFIG } from '../initializers/constants'
import { VideoPrivacy, VideoState } from '../../shared/models/videos'
import { VideoAbuseModel } from '../models/video/video-abuse'
import { VideoBlacklistModel } from '../models/video/video-blacklist'
import * as Bluebird from 'bluebird'

class Notifier {

  private static instance: Notifier

  private constructor () {}

  notifyOnNewVideo (video: VideoModel): void {
    // Only notify on public and published videos
    if (video.privacy !== VideoPrivacy.PUBLIC || video.state !== VideoState.PUBLISHED) return

    this.notifySubscribersOfNewVideo(video)
      .catch(err => logger.error('Cannot notify subscribers of new video %s.', video.url, { err }))
  }

  notifyOnNewComment (comment: VideoCommentModel): void {
    this.notifyVideoOwnerOfNewComment(comment)
        .catch(err => logger.error('Cannot notify of new comment %s.', comment.url, { err }))
  }

  notifyOnNewVideoAbuse (videoAbuse: VideoAbuseModel): void {
    this.notifyModeratorsOfNewVideoAbuse(videoAbuse)
      .catch(err => logger.error('Cannot notify of new video abuse of video %s.', videoAbuse.Video.url, { err }))
  }

  notifyOnVideoBlacklist (videoBlacklist: VideoBlacklistModel): void {
    this.notifyVideoOwnerOfBlacklist(videoBlacklist)
      .catch(err => logger.error('Cannot notify video owner of new video blacklist of %s.', videoBlacklist.Video.url, { err }))
  }

  notifyOnVideoUnblacklist (video: VideoModel): void {
    this.notifyVideoOwnerOfUnblacklist(video)
        .catch(err => logger.error('Cannot notify video owner of new video blacklist of %s.', video.url, { err }))
  }

  private async notifySubscribersOfNewVideo (video: VideoModel) {
    // List all followers that are users
    const users = await UserModel.listUserSubscribersOf(video.VideoChannel.actorId)

    logger.info('Notifying %d users of new video %s.', users.length, video.url)

    function settingGetter (user: UserModel) {
      return user.NotificationSetting.newVideoFromSubscription
    }

    async function notificationCreator (user: UserModel) {
      const notification = await UserNotificationModel.create({
        type: UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION,
        userId: user.id,
        videoId: video.id
      })
      notification.Video = video

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addNewVideoFromSubscriberNotification(emails, video)
    }

    return this.notify({ users, settingGetter, notificationCreator, emailSender })
  }

  private async notifyVideoOwnerOfNewComment (comment: VideoCommentModel) {
    const user = await UserModel.loadByVideoId(comment.videoId)

    // Not our user or user comments its own video
    if (!user || comment.Account.userId === user.id) return

    logger.info('Notifying user %s of new comment %s.', user.username, comment.url)

    function settingGetter (user: UserModel) {
      return user.NotificationSetting.newCommentOnMyVideo
    }

    async function notificationCreator (user: UserModel) {
      const notification = await UserNotificationModel.create({
        type: UserNotificationType.NEW_COMMENT_ON_MY_VIDEO,
        userId: user.id,
        commentId: comment.id
      })
      notification.Comment = comment

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addNewCommentOnMyVideoNotification(emails, comment)
    }

    return this.notify({ users: [ user ], settingGetter, notificationCreator, emailSender })
  }

  private async notifyModeratorsOfNewVideoAbuse (videoAbuse: VideoAbuseModel) {
    const users = await UserModel.listWithRight(UserRight.MANAGE_VIDEO_ABUSES)
    if (users.length === 0) return

    logger.info('Notifying %s user/moderators of new video abuse %s.', users.length, videoAbuse.Video.url)

    function settingGetter (user: UserModel) {
      return user.NotificationSetting.videoAbuseAsModerator
    }

    async function notificationCreator (user: UserModel) {
      const notification = await UserNotificationModel.create({
        type: UserNotificationType.NEW_VIDEO_ABUSE_FOR_MODERATORS,
        userId: user.id,
        videoAbuseId: videoAbuse.id
      })
      notification.VideoAbuse = videoAbuse

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addVideoAbuseModeratorsNotification(emails, videoAbuse)
    }

    return this.notify({ users, settingGetter, notificationCreator, emailSender })
  }

  private async notifyVideoOwnerOfBlacklist (videoBlacklist: VideoBlacklistModel) {
    const user = await UserModel.loadByVideoId(videoBlacklist.videoId)
    if (!user) return

    logger.info('Notifying user %s that its video %s has been blacklisted.', user.username, videoBlacklist.Video.url)

    function settingGetter (user: UserModel) {
      return user.NotificationSetting.blacklistOnMyVideo
    }

    async function notificationCreator (user: UserModel) {
      const notification = await UserNotificationModel.create({
        type: UserNotificationType.BLACKLIST_ON_MY_VIDEO,
        userId: user.id,
        videoBlacklistId: videoBlacklist.id
      })
      notification.VideoBlacklist = videoBlacklist

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addVideoBlacklistNotification(emails, videoBlacklist)
    }

    return this.notify({ users: [ user ], settingGetter, notificationCreator, emailSender })
  }

  private async notifyVideoOwnerOfUnblacklist (video: VideoModel) {
    const user = await UserModel.loadByVideoId(video.id)
    if (!user) return

    logger.info('Notifying user %s that its video %s has been unblacklisted.', user.username, video.url)

    function settingGetter (user: UserModel) {
      return user.NotificationSetting.blacklistOnMyVideo
    }

    async function notificationCreator (user: UserModel) {
      const notification = await UserNotificationModel.create({
        type: UserNotificationType.UNBLACKLIST_ON_MY_VIDEO,
        userId: user.id,
        videoId: video.id
      })
      notification.Video = video

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addVideoUnblacklistNotification(emails, video)
    }

    return this.notify({ users: [ user ], settingGetter, notificationCreator, emailSender })
  }

  private async notify (options: {
    users: UserModel[],
    notificationCreator: (user: UserModel) => Promise<UserNotificationModel>,
    emailSender: (emails: string[]) => Promise<any> | Bluebird<any>,
    settingGetter: (user: UserModel) => UserNotificationSettingValue
  }) {
    const emails: string[] = []

    for (const user of options.users) {
      if (this.isWebNotificationEnabled(options.settingGetter(user))) {
        const notification = await options.notificationCreator(user)

        PeerTubeSocket.Instance.sendNotification(user.id, notification)
      }

      if (this.isEmailEnabled(user, options.settingGetter(user))) {
        emails.push(user.email)
      }
    }

    if (emails.length !== 0) {
      await options.emailSender(emails)
    }
  }

  private isEmailEnabled (user: UserModel, value: UserNotificationSettingValue) {
    if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION === true && user.emailVerified !== true) return false

    return value === UserNotificationSettingValue.EMAIL || value === UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL
  }

  private isWebNotificationEnabled (value: UserNotificationSettingValue) {
    return value === UserNotificationSettingValue.WEB_NOTIFICATION || value === UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  Notifier
}

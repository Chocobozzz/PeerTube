import { AccountModel } from '@server/models/account/account'
import { getServerActor } from '@server/models/application/application'
import { ServerBlocklistModel } from '@server/models/server/server-blocklist'
import {
  MUser,
  MUserAccount,
  MUserDefault,
  MUserNotifSettingAccount,
  MUserWithNotificationSetting,
  UserNotificationModelForApi
} from '@server/types/models/user'
import { MVideoBlacklistLightVideo, MVideoBlacklistVideo } from '@server/types/models/video/video-blacklist'
import { MVideoImportVideo } from '@server/types/models/video/video-import'
import { UserAbuse } from '@shared/models'
import { UserNotificationSettingValue, UserNotificationType, UserRight } from '../../shared/models/users'
import { VideoPrivacy, VideoState } from '../../shared/models/videos'
import { logger } from '../helpers/logger'
import { CONFIG } from '../initializers/config'
import { AccountBlocklistModel } from '../models/account/account-blocklist'
import { UserModel } from '../models/account/user'
import { UserNotificationModel } from '../models/account/user-notification'
import { MAbuseFull, MAbuseMessage, MAccountServer, MActorFollowFull } from '../types/models'
import { MCommentOwnerVideo, MVideoAccountLight, MVideoFullLight } from '../types/models/video'
import { isBlockedByServerOrAccount } from './blocklist'
import { Emailer } from './emailer'
import { PeerTubeSocket } from './peertube-socket'

class Notifier {

  private static instance: Notifier

  private constructor () {
  }

  notifyOnNewVideoIfNeeded (video: MVideoAccountLight): void {
    // Only notify on public and published videos which are not blacklisted
    if (video.privacy !== VideoPrivacy.PUBLIC || video.state !== VideoState.PUBLISHED || video.isBlacklisted()) return

    this.notifySubscribersOfNewVideo(video)
        .catch(err => logger.error('Cannot notify subscribers of new video %s.', video.url, { err }))
  }

  notifyOnVideoPublishedAfterTranscoding (video: MVideoFullLight): void {
    // don't notify if didn't wait for transcoding or video is still blacklisted/waiting for scheduled update
    if (!video.waitTranscoding || video.VideoBlacklist || video.ScheduleVideoUpdate) return

    this.notifyOwnedVideoHasBeenPublished(video)
        .catch(err => logger.error('Cannot notify owner that its video %s has been published after transcoding.', video.url, { err }))
  }

  notifyOnVideoPublishedAfterScheduledUpdate (video: MVideoFullLight): void {
    // don't notify if video is still blacklisted or waiting for transcoding
    if (video.VideoBlacklist || (video.waitTranscoding && video.state !== VideoState.PUBLISHED)) return

    this.notifyOwnedVideoHasBeenPublished(video)
        .catch(err => logger.error('Cannot notify owner that its video %s has been published after scheduled update.', video.url, { err }))
  }

  notifyOnVideoPublishedAfterRemovedFromAutoBlacklist (video: MVideoFullLight): void {
    // don't notify if video is still waiting for transcoding or scheduled update
    if (video.ScheduleVideoUpdate || (video.waitTranscoding && video.state !== VideoState.PUBLISHED)) return

    this.notifyOwnedVideoHasBeenPublished(video)
        .catch(err => {
          logger.error('Cannot notify owner that its video %s has been published after removed from auto-blacklist.', video.url, { err })
        })
  }

  notifyOnNewComment (comment: MCommentOwnerVideo): void {
    this.notifyVideoOwnerOfNewComment(comment)
        .catch(err => logger.error('Cannot notify video owner of new comment %s.', comment.url, { err }))

    this.notifyOfCommentMention(comment)
        .catch(err => logger.error('Cannot notify mentions of comment %s.', comment.url, { err }))
  }

  notifyOnNewAbuse (parameters: { abuse: UserAbuse, abuseInstance: MAbuseFull, reporter: string }): void {
    this.notifyModeratorsOfNewAbuse(parameters)
        .catch(err => logger.error('Cannot notify of new abuse %d.', parameters.abuseInstance.id, { err }))
  }

  notifyOnVideoAutoBlacklist (videoBlacklist: MVideoBlacklistLightVideo): void {
    this.notifyModeratorsOfVideoAutoBlacklist(videoBlacklist)
        .catch(err => logger.error('Cannot notify of auto-blacklist of video %s.', videoBlacklist.Video.url, { err }))
  }

  notifyOnVideoBlacklist (videoBlacklist: MVideoBlacklistVideo): void {
    this.notifyVideoOwnerOfBlacklist(videoBlacklist)
        .catch(err => logger.error('Cannot notify video owner of new video blacklist of %s.', videoBlacklist.Video.url, { err }))
  }

  notifyOnVideoUnblacklist (video: MVideoFullLight): void {
    this.notifyVideoOwnerOfUnblacklist(video)
        .catch(err => logger.error('Cannot notify video owner of unblacklist of %s.', video.url, { err }))
  }

  notifyOnFinishedVideoImport (videoImport: MVideoImportVideo, success: boolean): void {
    this.notifyOwnerVideoImportIsFinished(videoImport, success)
        .catch(err => logger.error('Cannot notify owner that its video import %s is finished.', videoImport.getTargetIdentifier(), { err }))
  }

  notifyOnNewUserRegistration (user: MUserDefault): void {
    this.notifyModeratorsOfNewUserRegistration(user)
        .catch(err => logger.error('Cannot notify moderators of new user registration (%s).', user.username, { err }))
  }

  notifyOfNewUserFollow (actorFollow: MActorFollowFull): void {
    this.notifyUserOfNewActorFollow(actorFollow)
        .catch(err => {
          logger.error(
            'Cannot notify owner of channel %s of a new follow by %s.',
            actorFollow.ActorFollowing.VideoChannel.getDisplayName(),
            actorFollow.ActorFollower.Account.getDisplayName(),
            { err }
          )
        })
  }

  notifyOfNewInstanceFollow (actorFollow: MActorFollowFull): void {
    this.notifyAdminsOfNewInstanceFollow(actorFollow)
        .catch(err => {
          logger.error('Cannot notify administrators of new follower %s.', actorFollow.ActorFollower.url, { err })
        })
  }

  notifyOfAutoInstanceFollowing (actorFollow: MActorFollowFull): void {
    this.notifyAdminsOfAutoInstanceFollowing(actorFollow)
        .catch(err => {
          logger.error('Cannot notify administrators of auto instance following %s.', actorFollow.ActorFollowing.url, { err })
        })
  }

  notifyOnAbuseStateChange (abuse: MAbuseFull): void {
    this.notifyReporterOfAbuseStateChange(abuse)
      .catch(err => {
        logger.error('Cannot notify reporter of abuse %d state change.', abuse.id, { err })
      })
  }

  notifyOnAbuseMessage (abuse: MAbuseFull, message: MAbuseMessage): void {
    this.notifyOfNewAbuseMessage(abuse, message)
      .catch(err => {
        logger.error('Cannot notify on new abuse %d message.', abuse.id, { err })
      })
  }

  private async notifySubscribersOfNewVideo (video: MVideoAccountLight) {
    // List all followers that are users
    const users = await UserModel.listUserSubscribersOf(video.VideoChannel.actorId)

    logger.info('Notifying %d users of new video %s.', users.length, video.url)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.newVideoFromSubscription
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
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

  private async notifyVideoOwnerOfNewComment (comment: MCommentOwnerVideo) {
    if (comment.Video.isOwned() === false) return

    const user = await UserModel.loadByVideoId(comment.videoId)

    // Not our user or user comments its own video
    if (!user || comment.Account.userId === user.id) return

    if (await this.isBlockedByServerOrUser(comment.Account, user)) return

    logger.info('Notifying user %s of new comment %s.', user.username, comment.url)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.newCommentOnMyVideo
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
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

  private async notifyOfCommentMention (comment: MCommentOwnerVideo) {
    const extractedUsernames = comment.extractMentions()
    logger.debug(
      'Extracted %d username from comment %s.', extractedUsernames.length, comment.url,
      { usernames: extractedUsernames, text: comment.text }
    )

    let users = await UserModel.listByUsernames(extractedUsernames)

    if (comment.Video.isOwned()) {
      const userException = await UserModel.loadByVideoId(comment.videoId)
      users = users.filter(u => u.id !== userException.id)
    }

    // Don't notify if I mentioned myself
    users = users.filter(u => u.Account.id !== comment.accountId)

    if (users.length === 0) return

    const serverAccountId = (await getServerActor()).Account.id
    const sourceAccounts = users.map(u => u.Account.id).concat([ serverAccountId ])

    const accountMutedHash = await AccountBlocklistModel.isAccountMutedByMulti(sourceAccounts, comment.accountId)
    const instanceMutedHash = await ServerBlocklistModel.isServerMutedByMulti(sourceAccounts, comment.Account.Actor.serverId)

    logger.info('Notifying %d users of new comment %s.', users.length, comment.url)

    function settingGetter (user: MUserNotifSettingAccount) {
      const accountId = user.Account.id
      if (
        accountMutedHash[accountId] === true || instanceMutedHash[accountId] === true ||
        accountMutedHash[serverAccountId] === true || instanceMutedHash[serverAccountId] === true
      ) {
        return UserNotificationSettingValue.NONE
      }

      return user.NotificationSetting.commentMention
    }

    async function notificationCreator (user: MUserNotifSettingAccount) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: UserNotificationType.COMMENT_MENTION,
        userId: user.id,
        commentId: comment.id
      })
      notification.Comment = comment

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addNewCommentMentionNotification(emails, comment)
    }

    return this.notify({ users, settingGetter, notificationCreator, emailSender })
  }

  private async notifyUserOfNewActorFollow (actorFollow: MActorFollowFull) {
    if (actorFollow.ActorFollowing.isOwned() === false) return

    // Account follows one of our account?
    let followType: 'account' | 'channel' = 'channel'
    let user = await UserModel.loadByChannelActorId(actorFollow.ActorFollowing.id)

    // Account follows one of our channel?
    if (!user) {
      user = await UserModel.loadByAccountActorId(actorFollow.ActorFollowing.id)
      followType = 'account'
    }

    if (!user) return

    const followerAccount = actorFollow.ActorFollower.Account
    const followerAccountWithActor = Object.assign(followerAccount, { Actor: actorFollow.ActorFollower })

    if (await this.isBlockedByServerOrUser(followerAccountWithActor, user)) return

    logger.info('Notifying user %s of new follower: %s.', user.username, followerAccount.getDisplayName())

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.newFollow
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: UserNotificationType.NEW_FOLLOW,
        userId: user.id,
        actorFollowId: actorFollow.id
      })
      notification.ActorFollow = actorFollow

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addNewFollowNotification(emails, actorFollow, followType)
    }

    return this.notify({ users: [ user ], settingGetter, notificationCreator, emailSender })
  }

  private async notifyAdminsOfNewInstanceFollow (actorFollow: MActorFollowFull) {
    const admins = await UserModel.listWithRight(UserRight.MANAGE_SERVER_FOLLOW)

    const follower = Object.assign(actorFollow.ActorFollower.Account, { Actor: actorFollow.ActorFollower })
    if (await this.isBlockedByServerOrUser(follower)) return

    logger.info('Notifying %d administrators of new instance follower: %s.', admins.length, actorFollow.ActorFollower.url)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.newInstanceFollower
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: UserNotificationType.NEW_INSTANCE_FOLLOWER,
        userId: user.id,
        actorFollowId: actorFollow.id
      })
      notification.ActorFollow = actorFollow

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addNewInstanceFollowerNotification(emails, actorFollow)
    }

    return this.notify({ users: admins, settingGetter, notificationCreator, emailSender })
  }

  private async notifyAdminsOfAutoInstanceFollowing (actorFollow: MActorFollowFull) {
    const admins = await UserModel.listWithRight(UserRight.MANAGE_SERVER_FOLLOW)

    logger.info('Notifying %d administrators of auto instance following: %s.', admins.length, actorFollow.ActorFollowing.url)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.autoInstanceFollowing
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: UserNotificationType.AUTO_INSTANCE_FOLLOWING,
        userId: user.id,
        actorFollowId: actorFollow.id
      })
      notification.ActorFollow = actorFollow

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addAutoInstanceFollowingNotification(emails, actorFollow)
    }

    return this.notify({ users: admins, settingGetter, notificationCreator, emailSender })
  }

  private async notifyModeratorsOfNewAbuse (parameters: {
    abuse: UserAbuse
    abuseInstance: MAbuseFull
    reporter: string
  }) {
    const { abuse, abuseInstance } = parameters

    const moderators = await UserModel.listWithRight(UserRight.MANAGE_ABUSES)
    if (moderators.length === 0) return

    const url = this.getAbuseUrl(abuseInstance)

    logger.info('Notifying %s user/moderators of new abuse %s.', moderators.length, url)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.abuseAsModerator
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: UserNotificationType.NEW_ABUSE_FOR_MODERATORS,
        userId: user.id,
        abuseId: abuse.id
      })
      notification.Abuse = abuseInstance

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addAbuseModeratorsNotification(emails, parameters)
    }

    return this.notify({ users: moderators, settingGetter, notificationCreator, emailSender })
  }

  private async notifyReporterOfAbuseStateChange (abuse: MAbuseFull) {
    // Only notify our users
    if (abuse.ReporterAccount.isOwned() !== true) return

    const url = this.getAbuseUrl(abuse)

    logger.info('Notifying reporter of abuse % of state change.', url)

    const reporter = await UserModel.loadByAccountActorId(abuse.ReporterAccount.actorId)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.abuseStateChange
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: UserNotificationType.ABUSE_STATE_CHANGE,
        userId: user.id,
        abuseId: abuse.id
      })
      notification.Abuse = abuse

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addAbuseStateChangeNotification(emails, abuse)
    }

    return this.notify({ users: [ reporter ], settingGetter, notificationCreator, emailSender })
  }

  private async notifyOfNewAbuseMessage (abuse: MAbuseFull, message: MAbuseMessage) {
    const url = this.getAbuseUrl(abuse)
    logger.info('Notifying reporter and moderators of new abuse message on %s.', url)

    const accountMessage = await AccountModel.load(message.accountId)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.abuseNewMessage
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: UserNotificationType.ABUSE_NEW_MESSAGE,
        userId: user.id,
        abuseId: abuse.id
      })
      notification.Abuse = abuse

      return notification
    }

    function emailSenderReporter (emails: string[]) {
      return Emailer.Instance.addAbuseNewMessageNotification(emails, { target: 'reporter', abuse, message, accountMessage })
    }

    function emailSenderModerators (emails: string[]) {
      return Emailer.Instance.addAbuseNewMessageNotification(emails, { target: 'moderator', abuse, message, accountMessage })
    }

    async function buildReporterOptions () {
      // Only notify our users
      if (abuse.ReporterAccount.isOwned() !== true) return

      const reporter = await UserModel.loadByAccountActorId(abuse.ReporterAccount.actorId)
      // Don't notify my own message
      if (reporter.Account.id === message.accountId) return

      return { users: [ reporter ], settingGetter, notificationCreator, emailSender: emailSenderReporter }
    }

    async function buildModeratorsOptions () {
      let moderators = await UserModel.listWithRight(UserRight.MANAGE_ABUSES)
      // Don't notify my own message
      moderators = moderators.filter(m => m.Account.id !== message.accountId)

      if (moderators.length === 0) return

      return { users: moderators, settingGetter, notificationCreator, emailSender: emailSenderModerators }
    }

    const [ reporterOptions, moderatorsOptions ] = await Promise.all([
      buildReporterOptions(),
      buildModeratorsOptions()
    ])

    return Promise.all([
      this.notify(reporterOptions),
      this.notify(moderatorsOptions)
    ])
  }

  private async notifyModeratorsOfVideoAutoBlacklist (videoBlacklist: MVideoBlacklistLightVideo) {
    const moderators = await UserModel.listWithRight(UserRight.MANAGE_VIDEO_BLACKLIST)
    if (moderators.length === 0) return

    logger.info('Notifying %s moderators of video auto-blacklist %s.', moderators.length, videoBlacklist.Video.url)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.videoAutoBlacklistAsModerator
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: UserNotificationType.VIDEO_AUTO_BLACKLIST_FOR_MODERATORS,
        userId: user.id,
        videoBlacklistId: videoBlacklist.id
      })
      notification.VideoBlacklist = videoBlacklist

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addVideoAutoBlacklistModeratorsNotification(emails, videoBlacklist)
    }

    return this.notify({ users: moderators, settingGetter, notificationCreator, emailSender })
  }

  private async notifyVideoOwnerOfBlacklist (videoBlacklist: MVideoBlacklistVideo) {
    const user = await UserModel.loadByVideoId(videoBlacklist.videoId)
    if (!user) return

    logger.info('Notifying user %s that its video %s has been blacklisted.', user.username, videoBlacklist.Video.url)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.blacklistOnMyVideo
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
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

  private async notifyVideoOwnerOfUnblacklist (video: MVideoFullLight) {
    const user = await UserModel.loadByVideoId(video.id)
    if (!user) return

    logger.info('Notifying user %s that its video %s has been unblacklisted.', user.username, video.url)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.blacklistOnMyVideo
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
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

  private async notifyOwnedVideoHasBeenPublished (video: MVideoFullLight) {
    const user = await UserModel.loadByVideoId(video.id)
    if (!user) return

    logger.info('Notifying user %s of the publication of its video %s.', user.username, video.url)

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.myVideoPublished
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: UserNotificationType.MY_VIDEO_PUBLISHED,
        userId: user.id,
        videoId: video.id
      })
      notification.Video = video

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.myVideoPublishedNotification(emails, video)
    }

    return this.notify({ users: [ user ], settingGetter, notificationCreator, emailSender })
  }

  private async notifyOwnerVideoImportIsFinished (videoImport: MVideoImportVideo, success: boolean) {
    const user = await UserModel.loadByVideoImportId(videoImport.id)
    if (!user) return

    logger.info('Notifying user %s its video import %s is finished.', user.username, videoImport.getTargetIdentifier())

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.myVideoImportFinished
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: success ? UserNotificationType.MY_VIDEO_IMPORT_SUCCESS : UserNotificationType.MY_VIDEO_IMPORT_ERROR,
        userId: user.id,
        videoImportId: videoImport.id
      })
      notification.VideoImport = videoImport

      return notification
    }

    function emailSender (emails: string[]) {
      return success
        ? Emailer.Instance.myVideoImportSuccessNotification(emails, videoImport)
        : Emailer.Instance.myVideoImportErrorNotification(emails, videoImport)
    }

    return this.notify({ users: [ user ], settingGetter, notificationCreator, emailSender })
  }

  private async notifyModeratorsOfNewUserRegistration (registeredUser: MUserDefault) {
    const moderators = await UserModel.listWithRight(UserRight.MANAGE_USERS)
    if (moderators.length === 0) return

    logger.info(
      'Notifying %s moderators of new user registration of %s.',
      moderators.length, registeredUser.username
    )

    function settingGetter (user: MUserWithNotificationSetting) {
      return user.NotificationSetting.newUserRegistration
    }

    async function notificationCreator (user: MUserWithNotificationSetting) {
      const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
        type: UserNotificationType.NEW_USER_REGISTRATION,
        userId: user.id,
        accountId: registeredUser.Account.id
      })
      notification.Account = registeredUser.Account

      return notification
    }

    function emailSender (emails: string[]) {
      return Emailer.Instance.addNewUserRegistrationNotification(emails, registeredUser)
    }

    return this.notify({ users: moderators, settingGetter, notificationCreator, emailSender })
  }

  private async notify<T extends MUserWithNotificationSetting> (options: {
    users: T[]
    notificationCreator: (user: T) => Promise<UserNotificationModelForApi>
    emailSender: (emails: string[]) => void
    settingGetter: (user: T) => UserNotificationSettingValue
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
      options.emailSender(emails)
    }
  }

  private isEmailEnabled (user: MUser, value: UserNotificationSettingValue) {
    if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION === true && user.emailVerified === false) return false

    return value & UserNotificationSettingValue.EMAIL
  }

  private isWebNotificationEnabled (value: UserNotificationSettingValue) {
    return value & UserNotificationSettingValue.WEB
  }

  private isBlockedByServerOrUser (targetAccount: MAccountServer, user?: MUserAccount) {
    return isBlockedByServerOrAccount(targetAccount, user?.Account)
  }

  private getAbuseUrl (abuse: MAbuseFull) {
    return abuse.VideoAbuse?.Video?.url ||
      abuse.VideoCommentAbuse?.VideoComment?.url ||
      abuse.FlaggedAccount.Actor.url
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  Notifier
}

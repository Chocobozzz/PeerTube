import { logger } from '@server/helpers/logger'
import { toSafeHtml } from '@server/helpers/markdown'
import { WEBSERVER } from '@server/initializers/constants'
import { AccountBlocklistModel } from '@server/models/account/account-blocklist'
import { getServerActor } from '@server/models/application/application'
import { ServerBlocklistModel } from '@server/models/server/server-blocklist'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import {
  MCommentOwnerVideo,
  MUserDefault,
  MUserNotifSettingAccount,
  MUserWithNotificationSetting,
  UserNotificationModelForApi
} from '@server/types/models'
import { UserNotificationSettingValue, UserNotificationType } from '@shared/models'
import { AbstractNotification } from '../common'

export class CommentMention extends AbstractNotification <MCommentOwnerVideo, MUserNotifSettingAccount> {
  private users: MUserDefault[]

  private serverAccountId: number

  private accountMutedHash: { [ id: number ]: boolean }
  private instanceMutedHash: { [ id: number ]: boolean }

  async prepare () {
    const extractedUsernames = this.payload.extractMentions()
    logger.debug(
      'Extracted %d username from comment %s.', extractedUsernames.length, this.payload.url,
      { usernames: extractedUsernames, text: this.payload.text }
    )

    this.users = await UserModel.listByUsernames(extractedUsernames)

    if (this.payload.Video.isOwned()) {
      const userException = await UserModel.loadByVideoId(this.payload.videoId)
      this.users = this.users.filter(u => u.id !== userException.id)
    }

    // Don't notify if I mentioned myself
    this.users = this.users.filter(u => u.Account.id !== this.payload.accountId)

    if (this.users.length === 0) return

    this.serverAccountId = (await getServerActor()).Account.id

    const sourceAccounts = this.users.map(u => u.Account.id).concat([ this.serverAccountId ])

    this.accountMutedHash = await AccountBlocklistModel.isAccountMutedByAccounts(sourceAccounts, this.payload.accountId)
    this.instanceMutedHash = await ServerBlocklistModel.isServerMutedByAccounts(sourceAccounts, this.payload.Account.Actor.serverId)
  }

  log () {
    logger.info('Notifying %d users of new comment %s.', this.users.length, this.payload.url)
  }

  getSetting (user: MUserNotifSettingAccount) {
    const accountId = user.Account.id
    if (
      this.accountMutedHash[accountId] === true || this.instanceMutedHash[accountId] === true ||
      this.accountMutedHash[this.serverAccountId] === true || this.instanceMutedHash[this.serverAccountId] === true
    ) {
      return UserNotificationSettingValue.NONE
    }

    return user.NotificationSetting.commentMention
  }

  getTargetUsers () {
    return this.users
  }

  async createNotification (user: MUserWithNotificationSetting) {
    const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
      type: UserNotificationType.COMMENT_MENTION,
      userId: user.id,
      commentId: this.payload.id
    })
    notification.Comment = this.payload

    return notification
  }

  createEmail (to: string) {
    const comment = this.payload

    const accountName = comment.Account.getDisplayName()
    const video = comment.Video
    const videoUrl = WEBSERVER.URL + comment.Video.getWatchStaticPath()
    const commentUrl = WEBSERVER.URL + comment.getCommentStaticPath()
    const commentHtml = toSafeHtml(comment.text)

    return {
      template: 'video-comment-mention',
      to,
      subject: 'Mention on video ' + video.name,
      locals: {
        comment,
        commentHtml,
        video,
        videoUrl,
        accountName,
        action: {
          text: 'View comment',
          url: commentUrl
        }
      }
    }
  }
}

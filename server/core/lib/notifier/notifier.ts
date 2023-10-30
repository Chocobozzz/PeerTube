import { UserNotificationSettingValue, UserNotificationSettingValueType } from '@peertube/peertube-models'
import { MRegistration, MUser, MUserDefault } from '@server/types/models/user/index.js'
import { MVideoBlacklistLightVideo, MVideoBlacklistVideo } from '@server/types/models/video/video-blacklist.js'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import {
  MAbuseFull,
  MAbuseMessage,
  MActorFollowFull,
  MApplication,
  MCommentOwnerVideo,
  MPlugin,
  MVideoAccountLight,
  MVideoFullLight
} from '../../types/models/index.js'
import { JobQueue } from '../job-queue/index.js'
import { PeerTubeSocket } from '../peertube-socket.js'
import { Hooks } from '../plugins/hooks.js'
import {
  AbstractNotification,
  AbuseStateChangeForReporter,
  AutoFollowForInstance,
  CommentMention,
  DirectRegistrationForModerators,
  FollowForInstance,
  FollowForUser,
  ImportFinishedForOwner,
  ImportFinishedForOwnerPayload,
  NewAbuseForModerators,
  NewAbuseMessageForModerators,
  NewAbuseMessageForReporter,
  NewAbusePayload,
  NewAutoBlacklistForModerators,
  NewBlacklistForOwner,
  NewCommentForVideoOwner,
  NewPeerTubeVersionForAdmins,
  NewPluginVersionForAdmins,
  NewVideoForSubscribers,
  OwnedPublicationAfterAutoUnblacklist,
  OwnedPublicationAfterScheduleUpdate,
  OwnedPublicationAfterTranscoding,
  RegistrationRequestForModerators,
  StudioEditionFinishedForOwner,
  UnblacklistForOwner
} from './shared/index.js'

class Notifier {

  private readonly notificationModels = {
    newVideo: [ NewVideoForSubscribers ],
    publicationAfterTranscoding: [ OwnedPublicationAfterTranscoding ],
    publicationAfterScheduleUpdate: [ OwnedPublicationAfterScheduleUpdate ],
    publicationAfterAutoUnblacklist: [ OwnedPublicationAfterAutoUnblacklist ],
    newComment: [ CommentMention, NewCommentForVideoOwner ],
    newAbuse: [ NewAbuseForModerators ],
    newBlacklist: [ NewBlacklistForOwner ],
    unblacklist: [ UnblacklistForOwner ],
    importFinished: [ ImportFinishedForOwner ],
    directRegistration: [ DirectRegistrationForModerators ],
    registrationRequest: [ RegistrationRequestForModerators ],
    userFollow: [ FollowForUser ],
    instanceFollow: [ FollowForInstance ],
    autoInstanceFollow: [ AutoFollowForInstance ],
    newAutoBlacklist: [ NewAutoBlacklistForModerators ],
    abuseStateChange: [ AbuseStateChangeForReporter ],
    newAbuseMessage: [ NewAbuseMessageForReporter, NewAbuseMessageForModerators ],
    newPeertubeVersion: [ NewPeerTubeVersionForAdmins ],
    newPluginVersion: [ NewPluginVersionForAdmins ],
    videoStudioEditionFinished: [ StudioEditionFinishedForOwner ]
  }

  private static instance: Notifier

  private constructor () {
  }

  notifyOnNewVideoIfNeeded (video: MVideoAccountLight): void {
    const models = this.notificationModels.newVideo

    this.sendNotifications(models, video)
      .catch(err => logger.error('Cannot notify subscribers of new video %s.', video.url, { err }))
  }

  notifyOnVideoPublishedAfterTranscoding (video: MVideoFullLight): void {
    const models = this.notificationModels.publicationAfterTranscoding

    this.sendNotifications(models, video)
      .catch(err => logger.error('Cannot notify owner that its video %s has been published after transcoding.', video.url, { err }))
  }

  notifyOnVideoPublishedAfterScheduledUpdate (video: MVideoFullLight): void {
    const models = this.notificationModels.publicationAfterScheduleUpdate

    this.sendNotifications(models, video)
      .catch(err => logger.error('Cannot notify owner that its video %s has been published after scheduled update.', video.url, { err }))
  }

  notifyOnVideoPublishedAfterRemovedFromAutoBlacklist (video: MVideoFullLight): void {
    const models = this.notificationModels.publicationAfterAutoUnblacklist

    this.sendNotifications(models, video)
      .catch(err => {
        logger.error('Cannot notify owner that its video %s has been published after removed from auto-blacklist.', video.url, { err })
      })
  }

  notifyOnNewComment (comment: MCommentOwnerVideo): void {
    const models = this.notificationModels.newComment

    this.sendNotifications(models, comment)
      .catch(err => logger.error('Cannot notify of new comment %s.', comment.url, { err }))
  }

  notifyOnNewAbuse (payload: NewAbusePayload): void {
    const models = this.notificationModels.newAbuse

    this.sendNotifications(models, payload)
      .catch(err => logger.error('Cannot notify of new abuse %d.', payload.abuseInstance.id, { err }))
  }

  notifyOnVideoAutoBlacklist (videoBlacklist: MVideoBlacklistLightVideo): void {
    const models = this.notificationModels.newAutoBlacklist

    this.sendNotifications(models, videoBlacklist)
      .catch(err => logger.error('Cannot notify of auto-blacklist of video %s.', videoBlacklist.Video.url, { err }))
  }

  notifyOnVideoBlacklist (videoBlacklist: MVideoBlacklistVideo): void {
    const models = this.notificationModels.newBlacklist

    this.sendNotifications(models, videoBlacklist)
      .catch(err => logger.error('Cannot notify video owner of new video blacklist of %s.', videoBlacklist.Video.url, { err }))
  }

  notifyOnVideoUnblacklist (video: MVideoFullLight): void {
    const models = this.notificationModels.unblacklist

    this.sendNotifications(models, video)
        .catch(err => logger.error('Cannot notify video owner of unblacklist of %s.', video.url, { err }))
  }

  notifyOnFinishedVideoImport (payload: ImportFinishedForOwnerPayload): void {
    const models = this.notificationModels.importFinished

    this.sendNotifications(models, payload)
        .catch(err => {
          logger.error('Cannot notify owner that its video import %s is finished.', payload.videoImport.getTargetIdentifier(), { err })
        })
  }

  notifyOnNewDirectRegistration (user: MUserDefault): void {
    const models = this.notificationModels.directRegistration

    this.sendNotifications(models, user)
      .catch(err => logger.error('Cannot notify moderators of new user registration (%s).', user.username, { err }))
  }

  notifyOnNewRegistrationRequest (registration: MRegistration): void {
    const models = this.notificationModels.registrationRequest

    this.sendNotifications(models, registration)
      .catch(err => logger.error('Cannot notify moderators of new registration request (%s).', registration.username, { err }))
  }

  notifyOfNewUserFollow (actorFollow: MActorFollowFull): void {
    const models = this.notificationModels.userFollow

    this.sendNotifications(models, actorFollow)
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
    const models = this.notificationModels.instanceFollow

    this.sendNotifications(models, actorFollow)
      .catch(err => logger.error('Cannot notify administrators of new follower %s.', actorFollow.ActorFollower.url, { err }))
  }

  notifyOfAutoInstanceFollowing (actorFollow: MActorFollowFull): void {
    const models = this.notificationModels.autoInstanceFollow

    this.sendNotifications(models, actorFollow)
      .catch(err => logger.error('Cannot notify administrators of auto instance following %s.', actorFollow.ActorFollowing.url, { err }))
  }

  notifyOnAbuseStateChange (abuse: MAbuseFull): void {
    const models = this.notificationModels.abuseStateChange

    this.sendNotifications(models, abuse)
      .catch(err => logger.error('Cannot notify of abuse %d state change.', abuse.id, { err }))
  }

  notifyOnAbuseMessage (abuse: MAbuseFull, message: MAbuseMessage): void {
    const models = this.notificationModels.newAbuseMessage

    this.sendNotifications(models, { abuse, message })
      .catch(err => logger.error('Cannot notify on new abuse %d message.', abuse.id, { err }))
  }

  notifyOfNewPeerTubeVersion (application: MApplication, latestVersion: string) {
    const models = this.notificationModels.newPeertubeVersion

    this.sendNotifications(models, { application, latestVersion })
      .catch(err => logger.error('Cannot notify on new PeerTubeb version %s.', latestVersion, { err }))
  }

  notifyOfNewPluginVersion (plugin: MPlugin) {
    const models = this.notificationModels.newPluginVersion

    this.sendNotifications(models, plugin)
      .catch(err => logger.error('Cannot notify on new plugin version %s.', plugin.name, { err }))
  }

  notifyOfFinishedVideoStudioEdition (video: MVideoFullLight) {
    const models = this.notificationModels.videoStudioEditionFinished

    this.sendNotifications(models, video)
      .catch(err => logger.error('Cannot notify on finished studio edition %s.', video.url, { err }))
  }

  private async notify <T> (object: AbstractNotification<T>) {
    await object.prepare()

    const users = object.getTargetUsers()

    if (users.length === 0) return
    if (await object.isDisabled()) return

    object.log()

    const toEmails: string[] = []

    for (const user of users) {
      const setting = object.getSetting(user)

      const webNotificationEnabled = this.isWebNotificationEnabled(setting)
      const emailNotificationEnabled = this.isEmailEnabled(user, setting)
      const notification = object.createNotification(user)

      if (webNotificationEnabled) {
        await notification.save()

        PeerTubeSocket.Instance.sendNotification(user.id, notification)
      }

      if (emailNotificationEnabled) {
        toEmails.push(user.email)
      }

      Hooks.runAction('action:notifier.notification.created', { webNotificationEnabled, emailNotificationEnabled, user, notification })
    }

    for (const to of toEmails) {
      const payload = await object.createEmail(to)
      JobQueue.Instance.createJobAsync({ type: 'email', payload })
    }
  }

  private isEmailEnabled (user: MUser, value: UserNotificationSettingValueType) {
    if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION === true && user.emailVerified === false) return false

    return value & UserNotificationSettingValue.EMAIL
  }

  private isWebNotificationEnabled (value: UserNotificationSettingValueType) {
    return value & UserNotificationSettingValue.WEB
  }

  private async sendNotifications <T> (models: (new (payload: T) => AbstractNotification<T>)[], payload: T) {
    for (const model of models) {
      // eslint-disable-next-line new-cap
      await this.notify(new model(payload))
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  Notifier
}

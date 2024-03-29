import { UserNotificationSettingValue, UserNotificationSettingValueType } from '@peertube/peertube-models'
import { MRegistration, MUser, MUserDefault } from '@server/types/models/user/index.js'
import { MVideoBlacklistLightVideo, MVideoBlacklistVideo } from '@server/types/models/video/video-blacklist.js'
import { logger, loggerTagsFactory } from '../../helpers/logger.js'
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
  NewVideoOrLiveForSubscribers,
  OwnedPublicationAfterAutoUnblacklist,
  OwnedPublicationAfterScheduleUpdate,
  OwnedPublicationAfterTranscoding,
  RegistrationRequestForModerators,
  StudioEditionFinishedForOwner,
  UnblacklistForOwner
} from './shared/index.js'

const lTags = loggerTagsFactory('notifier')

class Notifier {

  private readonly notificationModels = {
    newVideoOrLive: [ NewVideoOrLiveForSubscribers ],
    publicationAfterTranscoding: [ OwnedPublicationAfterTranscoding ],
    publicationAfterScheduleUpdate: [ OwnedPublicationAfterScheduleUpdate ],
    publicationAfterAutoUnblacklist: [ OwnedPublicationAfterAutoUnblacklist ],
    newComment: [ CommentMention, NewCommentForVideoOwner ],
    commentApproval: [ CommentMention ],
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

  notifyOnNewVideoOrLiveIfNeeded (video: MVideoAccountLight): void {
    const models = this.notificationModels.newVideoOrLive

    logger.debug('Notify on new video or live if needed', { video: video.url, ...lTags() })

    this.sendNotifications(models, video)
      .catch(err => logger.error('Cannot notify subscribers of new video %s.', video.url, { err }))
  }

  notifyOnVideoPublishedAfterTranscoding (video: MVideoFullLight): void {
    const models = this.notificationModels.publicationAfterTranscoding

    logger.debug('Notify on published video after transcoding', { video: video.url, ...lTags() })

    this.sendNotifications(models, video)
      .catch(err => logger.error('Cannot notify owner that its video %s has been published after transcoding.', video.url, { err }))
  }

  notifyOnVideoPublishedAfterScheduledUpdate (video: MVideoFullLight): void {
    const models = this.notificationModels.publicationAfterScheduleUpdate

    logger.debug('Notify on published video after scheduled update', { video: video.url, ...lTags() })

    this.sendNotifications(models, video)
      .catch(err => logger.error('Cannot notify owner that its video %s has been published after scheduled update.', video.url, { err }))
  }

  notifyOnVideoPublishedAfterRemovedFromAutoBlacklist (video: MVideoFullLight): void {
    const models = this.notificationModels.publicationAfterAutoUnblacklist

    logger.debug('Notify on published video after being removed from auto blacklist', { video: video.url, ...lTags() })

    this.sendNotifications(models, video)
      .catch(err => {
        logger.error('Cannot notify owner that its video %s has been published after removed from auto-blacklist.', video.url, { err })
      })
  }

  notifyOnNewComment (comment: MCommentOwnerVideo): void {
    const models = this.notificationModels.newComment

    logger.debug('Notify on new comment', { comment: comment.url, ...lTags() })

    this.sendNotifications(models, comment)
      .catch(err => logger.error('Cannot notify of new comment %s.', comment.url, { err }))
  }

  notifyOnNewCommentApproval (comment: MCommentOwnerVideo): void {
    const models = this.notificationModels.commentApproval

    logger.debug('Notify on comment approval', { comment: comment.url, ...lTags() })

    this.sendNotifications(models, comment)
      .catch(err => logger.error('Cannot notify on comment approval %s.', comment.url, { err }))
  }

  notifyOnNewAbuse (payload: NewAbusePayload): void {
    const models = this.notificationModels.newAbuse

    logger.debug('Notify on new abuse', { abuse: payload.abuseInstance.id, ...lTags() })

    this.sendNotifications(models, payload)
      .catch(err => logger.error('Cannot notify of new abuse %d.', payload.abuseInstance.id, { err }))
  }

  notifyOnVideoAutoBlacklist (videoBlacklist: MVideoBlacklistLightVideo): void {
    const models = this.notificationModels.newAutoBlacklist

    logger.debug('Notify on video auto blacklist', { video: videoBlacklist?.Video?.url, ...lTags() })

    this.sendNotifications(models, videoBlacklist)
      .catch(err => logger.error('Cannot notify of auto-blacklist of video %s.', videoBlacklist.Video.url, { err }))
  }

  notifyOnVideoBlacklist (videoBlacklist: MVideoBlacklistVideo): void {
    const models = this.notificationModels.newBlacklist

    logger.debug('Notify on video manual blacklist', { video: videoBlacklist?.Video?.url, ...lTags() })

    this.sendNotifications(models, videoBlacklist)
      .catch(err => logger.error('Cannot notify video owner of new video blacklist of %s.', videoBlacklist.Video.url, { err }))
  }

  notifyOnVideoUnblacklist (video: MVideoFullLight): void {
    const models = this.notificationModels.unblacklist

    logger.debug('Notify on video unblacklist', { video: video.url, ...lTags() })

    this.sendNotifications(models, video)
        .catch(err => logger.error('Cannot notify video owner of unblacklist of %s.', video.url, { err }))
  }

  notifyOnFinishedVideoImport (payload: ImportFinishedForOwnerPayload): void {
    const models = this.notificationModels.importFinished

    logger.debug('Notify on finished video import', { import: payload.videoImport.getTargetIdentifier(), ...lTags() })

    this.sendNotifications(models, payload)
        .catch(err => {
          logger.error('Cannot notify owner that its video import %s is finished.', payload.videoImport.getTargetIdentifier(), { err })
        })
  }

  notifyOnNewDirectRegistration (user: MUserDefault): void {
    const models = this.notificationModels.directRegistration

    logger.debug('Notify on new direct registration', { user: user.username, ...lTags() })

    this.sendNotifications(models, user)
      .catch(err => logger.error('Cannot notify moderators of new user registration (%s).', user.username, { err }))
  }

  notifyOnNewRegistrationRequest (registration: MRegistration): void {
    const models = this.notificationModels.registrationRequest

    logger.debug('Notify on new registration request', { registration: registration.username, ...lTags() })

    this.sendNotifications(models, registration)
      .catch(err => logger.error('Cannot notify moderators of new registration request (%s).', registration.username, { err }))
  }

  notifyOfNewUserFollow (actorFollow: MActorFollowFull): void {
    const models = this.notificationModels.userFollow

    const following = actorFollow?.ActorFollowing?.VideoChannel?.getDisplayName()
    const follower = actorFollow?.ActorFollower?.Account?.getDisplayName()

    logger.debug('Notify on new user follow', { following, follower, ...lTags() })

    this.sendNotifications(models, actorFollow)
      .catch(err => {
        logger.error('Cannot notify owner of channel %s of a new follow by %s.', following, follower, { err })
      })
  }

  notifyOfNewInstanceFollow (actorFollow: MActorFollowFull): void {
    const models = this.notificationModels.instanceFollow

    logger.debug('Notify on new instance follow', { follower: actorFollow.ActorFollower.url, ...lTags() })

    this.sendNotifications(models, actorFollow)
      .catch(err => logger.error('Cannot notify administrators of new follower %s.', actorFollow.ActorFollower.url, { err }))
  }

  notifyOfAutoInstanceFollowing (actorFollow: MActorFollowFull): void {
    const models = this.notificationModels.autoInstanceFollow

    logger.debug('Notify on new instance auto following', { following: actorFollow.ActorFollowing.url, ...lTags() })

    this.sendNotifications(models, actorFollow)
      .catch(err => logger.error('Cannot notify administrators of auto instance following %s.', actorFollow.ActorFollowing.url, { err }))
  }

  notifyOnAbuseStateChange (abuse: MAbuseFull): void {
    const models = this.notificationModels.abuseStateChange

    logger.debug('Notify on abuse state change', { abuse: abuse.id, ...lTags() })

    this.sendNotifications(models, abuse)
      .catch(err => logger.error('Cannot notify of abuse %d state change.', abuse.id, { err }))
  }

  notifyOnAbuseMessage (abuse: MAbuseFull, message: MAbuseMessage): void {
    const models = this.notificationModels.newAbuseMessage

    logger.debug('Notify on abuse message', { abuse: abuse.id, message, ...lTags() })

    this.sendNotifications(models, { abuse, message })
      .catch(err => logger.error('Cannot notify on new abuse %d message.', abuse.id, { err }))
  }

  notifyOfNewPeerTubeVersion (application: MApplication, latestVersion: string) {
    const models = this.notificationModels.newPeertubeVersion

    logger.debug('Notify on new peertube version', { currentVersion: application.version, latestVersion, ...lTags() })

    this.sendNotifications(models, { application, latestVersion })
      .catch(err => logger.error('Cannot notify on new PeerTube version %s.', latestVersion, { err }))
  }

  notifyOfNewPluginVersion (plugin: MPlugin) {
    const models = this.notificationModels.newPluginVersion

    logger.debug('Notify on new plugin version', { plugin: plugin.name, ...lTags() })

    this.sendNotifications(models, plugin)
      .catch(err => logger.error('Cannot notify on new plugin version %s.', plugin.name, { err }))
  }

  notifyOfFinishedVideoStudioEdition (video: MVideoFullLight) {
    const models = this.notificationModels.videoStudioEditionFinished

    logger.debug('Notify on finished video studio edition', { video: video.url, ...lTags() })

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

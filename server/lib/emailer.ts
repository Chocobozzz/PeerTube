import { createTransport, Transporter } from 'nodemailer'
import { isTestInstance } from '../helpers/core-utils'
import { bunyanLogger, logger } from '../helpers/logger'
import { CONFIG, isEmailEnabled } from '../initializers/config'
import { JobQueue } from './job-queue'
import { EmailPayload } from './job-queue/handlers/email'
import { readFileSync } from 'fs-extra'
import { WEBSERVER } from '../initializers/constants'
import {
  MCommentOwnerVideo,
  MVideo,
  MVideoAbuseVideo,
  MVideoAccountLight,
  MVideoBlacklistLightVideo,
  MVideoBlacklistVideo
} from '../typings/models/video'
import { MActorFollowActors, MActorFollowFull, MUser } from '../typings/models'
import { MVideoImport, MVideoImportVideo } from '@server/typings/models/video/video-import'

type SendEmailOptions = {
  to: string[]
  subject: string
  text: string

  fromDisplayName?: string
  replyTo?: string
}

class Emailer {

  private static instance: Emailer
  private initialized = false
  private transporter: Transporter

  private constructor () {
  }

  init () {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    if (isEmailEnabled()) {
      logger.info('Using %s:%s as SMTP server.', CONFIG.SMTP.HOSTNAME, CONFIG.SMTP.PORT)

      let tls
      if (CONFIG.SMTP.CA_FILE) {
        tls = {
          ca: [ readFileSync(CONFIG.SMTP.CA_FILE) ]
        }
      }

      let auth
      if (CONFIG.SMTP.USERNAME && CONFIG.SMTP.PASSWORD) {
        auth = {
          user: CONFIG.SMTP.USERNAME,
          pass: CONFIG.SMTP.PASSWORD
        }
      }

      this.transporter = createTransport({
        host: CONFIG.SMTP.HOSTNAME,
        port: CONFIG.SMTP.PORT,
        secure: CONFIG.SMTP.TLS,
        debug: CONFIG.LOG.LEVEL === 'debug',
        logger: bunyanLogger as any,
        ignoreTLS: CONFIG.SMTP.DISABLE_STARTTLS,
        tls,
        auth
      })
    } else {
      if (!isTestInstance()) {
        logger.error('Cannot use SMTP server because of lack of configuration. PeerTube will not be able to send mails!')
      }
    }
  }

  static isEnabled () {
    return !!CONFIG.SMTP.HOSTNAME && !!CONFIG.SMTP.PORT
  }

  async checkConnectionOrDie () {
    if (!this.transporter) return

    logger.info('Testing SMTP server...')

    try {
      const success = await this.transporter.verify()
      if (success !== true) this.dieOnConnectionFailure()

      logger.info('Successfully connected to SMTP server.')
    } catch (err) {
      this.dieOnConnectionFailure(err)
    }
  }

  addNewVideoFromSubscriberNotification (to: string[], video: MVideoAccountLight) {
    const channelName = video.VideoChannel.getDisplayName()
    const videoUrl = WEBSERVER.URL + video.getWatchStaticPath()

    const text = 'Hi dear user,\n\n' +
      `Your subscription ${channelName} just published a new video: ${video.name}` +
      '\n\n' +
      `You can view it on ${videoUrl} ` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + channelName + ' just published a new video',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewFollowNotification (to: string[], actorFollow: MActorFollowFull, followType: 'account' | 'channel') {
    const followerName = actorFollow.ActorFollower.Account.getDisplayName()
    const followingName = (actorFollow.ActorFollowing.VideoChannel || actorFollow.ActorFollowing.Account).getDisplayName()

    const text = 'Hi dear user,\n\n' +
      `Your ${followType} ${followingName} has a new subscriber: ${followerName}` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'New follower on your channel ' + followingName,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewInstanceFollowerNotification (to: string[], actorFollow: MActorFollowActors) {
    const awaitingApproval = actorFollow.state === 'pending' ? ' awaiting manual approval.' : ''

    const text = 'Hi dear admin,\n\n' +
      `Your instance has a new follower: ${actorFollow.ActorFollower.url}${awaitingApproval}` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'New instance follower',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addAutoInstanceFollowingNotification (to: string[], actorFollow: MActorFollowActors) {
    const text = 'Hi dear admin,\n\n' +
      `Your instance automatically followed a new instance: ${actorFollow.ActorFollowing.url}` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'Auto instance following',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  myVideoPublishedNotification (to: string[], video: MVideo) {
    const videoUrl = WEBSERVER.URL + video.getWatchStaticPath()

    const text = 'Hi dear user,\n\n' +
      `Your video ${video.name} has been published.` +
      '\n\n' +
      `You can view it on ${videoUrl} ` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + `Your video ${video.name} is published`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  myVideoImportSuccessNotification (to: string[], videoImport: MVideoImportVideo) {
    const videoUrl = WEBSERVER.URL + videoImport.Video.getWatchStaticPath()

    const text = 'Hi dear user,\n\n' +
      `Your video import ${videoImport.getTargetIdentifier()} is finished.` +
      '\n\n' +
      `You can view the imported video on ${videoUrl} ` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + `Your video import ${videoImport.getTargetIdentifier()} is finished`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  myVideoImportErrorNotification (to: string[], videoImport: MVideoImport) {
    const importUrl = WEBSERVER.URL + '/my-account/video-imports'

    const text = 'Hi dear user,\n\n' +
      `Your video import ${videoImport.getTargetIdentifier()} encountered an error.` +
      '\n\n' +
      `See your videos import dashboard for more information: ${importUrl}` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + `Your video import ${videoImport.getTargetIdentifier()} encountered an error`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewCommentOnMyVideoNotification (to: string[], comment: MCommentOwnerVideo) {
    const accountName = comment.Account.getDisplayName()
    const video = comment.Video
    const commentUrl = WEBSERVER.URL + comment.getCommentStaticPath()

    const text = 'Hi dear user,\n\n' +
      `A new comment has been posted by ${accountName} on your video ${video.name}` +
      '\n\n' +
      `You can view it on ${commentUrl} ` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'New comment on your video ' + video.name,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewCommentMentionNotification (to: string[], comment: MCommentOwnerVideo) {
    const accountName = comment.Account.getDisplayName()
    const video = comment.Video
    const commentUrl = WEBSERVER.URL + comment.getCommentStaticPath()

    const text = 'Hi dear user,\n\n' +
      `${accountName} mentioned you on video ${video.name}` +
      '\n\n' +
      `You can view the comment on ${commentUrl} ` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'Mention on video ' + video.name,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVideoAbuseModeratorsNotification (to: string[], videoAbuse: MVideoAbuseVideo) {
    const videoUrl = WEBSERVER.URL + videoAbuse.Video.getWatchStaticPath()

    const text = 'Hi,\n\n' +
      `${WEBSERVER.HOST} received an abuse for the following video ${videoUrl}\n\n` +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'Received a video abuse',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVideoAutoBlacklistModeratorsNotification (to: string[], videoBlacklist: MVideoBlacklistLightVideo) {
    const VIDEO_AUTO_BLACKLIST_URL = WEBSERVER.URL + '/admin/moderation/video-auto-blacklist/list'
    const videoUrl = WEBSERVER.URL + videoBlacklist.Video.getWatchStaticPath()

    const text = 'Hi,\n\n' +
      'A recently added video was auto-blacklisted and requires moderator review before publishing.' +
      '\n\n' +
      `You can view it and take appropriate action on ${videoUrl}` +
      '\n\n' +
      `A full list of auto-blacklisted videos can be reviewed here: ${VIDEO_AUTO_BLACKLIST_URL}` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'An auto-blacklisted video is awaiting review',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewUserRegistrationNotification (to: string[], user: MUser) {
    const text = 'Hi,\n\n' +
      `User ${user.username} just registered on ${WEBSERVER.HOST} PeerTube instance.\n\n` +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'New user registration on ' + WEBSERVER.HOST,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVideoBlacklistNotification (to: string[], videoBlacklist: MVideoBlacklistVideo) {
    const videoName = videoBlacklist.Video.name
    const videoUrl = WEBSERVER.URL + videoBlacklist.Video.getWatchStaticPath()

    const reasonString = videoBlacklist.reason ? ` for the following reason: ${videoBlacklist.reason}` : ''
    const blockedString = `Your video ${videoName} (${videoUrl} on ${WEBSERVER.HOST} has been blacklisted${reasonString}.`

    const text = 'Hi,\n\n' +
      blockedString +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + `Video ${videoName} blacklisted`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVideoUnblacklistNotification (to: string[], video: MVideo) {
    const videoUrl = WEBSERVER.URL + video.getWatchStaticPath()

    const text = 'Hi,\n\n' +
      `Your video ${video.name} (${videoUrl}) on ${WEBSERVER.HOST} has been unblacklisted.` +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to,
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + `Video ${video.name} unblacklisted`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addPasswordResetEmailJob (to: string, resetPasswordUrl: string) {
    const text = 'Hi dear user,\n\n' +
      `A reset password procedure for your account ${to} has been requested on ${WEBSERVER.HOST} ` +
      `Please follow this link to reset it: ${resetPasswordUrl}  (the link will expire within 1 hour)\n\n` +
      'If you are not the person who initiated this request, please ignore this email.\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to: [ to ],
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'Reset your password',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addPasswordCreateEmailJob (username: string, to: string, resetPasswordUrl: string) {
    const text = 'Hi,\n\n' +
      `Welcome to your ${WEBSERVER.HOST} PeerTube instance. Your username is: ${username}.\n\n` +
      `Please set your password by following this link: ${resetPasswordUrl} (this link will expire within seven days).\n\n` +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to: [ to ],
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'New PeerTube account password',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVerifyEmailJob (to: string, verifyEmailUrl: string) {
    const text = 'Welcome to PeerTube,\n\n' +
      `To start using PeerTube on ${WEBSERVER.HOST} you must  verify your email! ` +
      `Please follow this link to verify this email belongs to you: ${verifyEmailUrl}\n\n` +
      'If you are not the person who initiated this request, please ignore this email.\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const emailPayload: EmailPayload = {
      to: [ to ],
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'Verify your email',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addUserBlockJob (user: MUser, blocked: boolean, reason?: string) {
    const reasonString = reason ? ` for the following reason: ${reason}` : ''
    const blockedWord = blocked ? 'blocked' : 'unblocked'
    const blockedString = `Your account ${user.username} on ${WEBSERVER.HOST} has been ${blockedWord}${reasonString}.`

    const text = 'Hi,\n\n' +
      blockedString +
      '\n\n' +
      'Cheers,\n' +
      `${CONFIG.EMAIL.BODY.SIGNATURE}`

    const to = user.email
    const emailPayload: EmailPayload = {
      to: [ to ],
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + 'Account ' + blockedWord,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addContactFormJob (fromEmail: string, fromName: string, subject: string, body: string) {
    const text = 'Hello dear admin,\n\n' +
      fromName + ' sent you a message' +
      '\n\n---------------------------------------\n\n' +
      body +
      '\n\n---------------------------------------\n\n' +
      'Cheers,\n' +
      'PeerTube.'

    const emailPayload: EmailPayload = {
      fromDisplayName: fromEmail,
      replyTo: fromEmail,
      to: [ CONFIG.ADMIN.EMAIL ],
      subject: CONFIG.EMAIL.SUBJECT.PREFIX + subject,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  async sendMail (options: EmailPayload) {
    if (!isEmailEnabled()) {
      throw new Error('Cannot send mail because SMTP is not configured.')
    }

    const fromDisplayName = options.fromDisplayName
      ? options.fromDisplayName
      : WEBSERVER.HOST

    for (const to of options.to) {
      await this.transporter.sendMail({
        from: `"${fromDisplayName}" <${CONFIG.SMTP.FROM_ADDRESS}>`,
        replyTo: options.replyTo,
        to,
        subject: options.subject,
        text: options.text
      })
    }
  }

  private dieOnConnectionFailure (err?: Error) {
    logger.error('Failed to connect to SMTP %s:%d.', CONFIG.SMTP.HOSTNAME, CONFIG.SMTP.PORT, { err })
    process.exit(-1)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  Emailer,
  SendEmailOptions
}

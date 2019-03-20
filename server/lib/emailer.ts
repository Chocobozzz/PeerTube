import { createTransport, Transporter } from 'nodemailer'
import { isTestInstance } from '../helpers/core-utils'
import { bunyanLogger, logger } from '../helpers/logger'
import { CONFIG } from '../initializers'
import { UserModel } from '../models/account/user'
import { VideoModel } from '../models/video/video'
import { JobQueue } from './job-queue'
import { EmailPayload } from './job-queue/handlers/email'
import { readFileSync } from 'fs-extra'
import { VideoCommentModel } from '../models/video/video-comment'
import { VideoAbuseModel } from '../models/video/video-abuse'
import { VideoBlacklistModel } from '../models/video/video-blacklist'
import { VideoImportModel } from '../models/video/video-import'
import { ActorFollowModel } from '../models/activitypub/actor-follow'

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

  private constructor () {}

  init () {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    if (Emailer.isEnabled()) {
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

  addNewVideoFromSubscriberNotification (to: string[], video: VideoModel) {
    const channelName = video.VideoChannel.getDisplayName()
    const videoUrl = CONFIG.WEBSERVER.URL + video.getWatchStaticPath()

    const text = `Hi dear user,\n\n` +
      `Your subscription ${channelName} just published a new video: ${video.name}` +
      `\n\n` +
      `You can view it on ${videoUrl} ` +
      `\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: channelName + ' just published a new video',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewFollowNotification (to: string[], actorFollow: ActorFollowModel, followType: 'account' | 'channel') {
    const followerName = actorFollow.ActorFollower.Account.getDisplayName()
    const followingName = (actorFollow.ActorFollowing.VideoChannel || actorFollow.ActorFollowing.Account).getDisplayName()

    const text = `Hi dear user,\n\n` +
      `Your ${followType} ${followingName} has a new subscriber: ${followerName}` +
      `\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: 'New follower on your channel ' + followingName,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  myVideoPublishedNotification (to: string[], video: VideoModel) {
    const videoUrl = CONFIG.WEBSERVER.URL + video.getWatchStaticPath()

    const text = `Hi dear user,\n\n` +
      `Your video ${video.name} has been published.` +
      `\n\n` +
      `You can view it on ${videoUrl} ` +
      `\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: `Your video ${video.name} is published`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  myVideoImportSuccessNotification (to: string[], videoImport: VideoImportModel) {
    const videoUrl = CONFIG.WEBSERVER.URL + videoImport.Video.getWatchStaticPath()

    const text = `Hi dear user,\n\n` +
      `Your video import ${videoImport.getTargetIdentifier()} is finished.` +
      `\n\n` +
      `You can view the imported video on ${videoUrl} ` +
      `\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: `Your video import ${videoImport.getTargetIdentifier()} is finished`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  myVideoImportErrorNotification (to: string[], videoImport: VideoImportModel) {
    const importUrl = CONFIG.WEBSERVER.URL + '/my-account/video-imports'

    const text = `Hi dear user,\n\n` +
      `Your video import ${videoImport.getTargetIdentifier()} encountered an error.` +
      `\n\n` +
      `See your videos import dashboard for more information: ${importUrl}` +
      `\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: `Your video import ${videoImport.getTargetIdentifier()} encountered an error`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewCommentOnMyVideoNotification (to: string[], comment: VideoCommentModel) {
    const accountName = comment.Account.getDisplayName()
    const video = comment.Video
    const commentUrl = CONFIG.WEBSERVER.URL + comment.getCommentStaticPath()

    const text = `Hi dear user,\n\n` +
      `A new comment has been posted by ${accountName} on your video ${video.name}` +
      `\n\n` +
      `You can view it on ${commentUrl} ` +
      `\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: 'New comment on your video ' + video.name,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewCommentMentionNotification (to: string[], comment: VideoCommentModel) {
    const accountName = comment.Account.getDisplayName()
    const video = comment.Video
    const commentUrl = CONFIG.WEBSERVER.URL + comment.getCommentStaticPath()

    const text = `Hi dear user,\n\n` +
      `${accountName} mentioned you on video ${video.name}` +
      `\n\n` +
      `You can view the comment on ${commentUrl} ` +
      `\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: 'Mention on video ' + video.name,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVideoAbuseModeratorsNotification (to: string[], videoAbuse: VideoAbuseModel) {
    const videoUrl = CONFIG.WEBSERVER.URL + videoAbuse.Video.getWatchStaticPath()

    const text = `Hi,\n\n` +
      `${CONFIG.WEBSERVER.HOST} received an abuse for the following video ${videoUrl}\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: '[PeerTube] Received a video abuse',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVideoAutoBlacklistModeratorsNotification (to: string[], video: VideoModel) {
    const VIDEO_AUTO_BLACKLIST_URL = CONFIG.WEBSERVER.URL + '/admin/moderation/video-auto-blacklist/list'
    const videoUrl = CONFIG.WEBSERVER.URL + video.getWatchStaticPath()

    const text = `Hi,\n\n` +
      `A recently added video was auto-blacklisted and requires moderator review before publishing.` +
      `\n\n` +
      `You can view it and take appropriate action on ${videoUrl}` +
      `\n\n` +
      `A full list of auto-blacklisted videos can be reviewed here: ${VIDEO_AUTO_BLACKLIST_URL}` +
      `\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: '[PeerTube] An auto-blacklisted video is awaiting review',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewUserRegistrationNotification (to: string[], user: UserModel) {
    const text = `Hi,\n\n` +
      `User ${user.username} just registered on ${CONFIG.WEBSERVER.HOST} PeerTube instance.\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: '[PeerTube] New user registration on ' + CONFIG.WEBSERVER.HOST,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVideoBlacklistNotification (to: string[], videoBlacklist: VideoBlacklistModel) {
    const videoName = videoBlacklist.Video.name
    const videoUrl = CONFIG.WEBSERVER.URL + videoBlacklist.Video.getWatchStaticPath()

    const reasonString = videoBlacklist.reason ? ` for the following reason: ${videoBlacklist.reason}` : ''
    const blockedString = `Your video ${videoName} (${videoUrl} on ${CONFIG.WEBSERVER.HOST} has been blacklisted${reasonString}.`

    const text = 'Hi,\n\n' +
      blockedString +
      '\n\n' +
      'Cheers,\n' +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: `[PeerTube] Video ${videoName} blacklisted`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVideoUnblacklistNotification (to: string[], video: VideoModel) {
    const videoUrl = CONFIG.WEBSERVER.URL + video.getWatchStaticPath()

    const text = 'Hi,\n\n' +
      `Your video ${video.name} (${videoUrl}) on ${CONFIG.WEBSERVER.HOST} has been unblacklisted.` +
      '\n\n' +
      'Cheers,\n' +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to,
      subject: `[PeerTube] Video ${video.name} unblacklisted`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addPasswordResetEmailJob (to: string, resetPasswordUrl: string) {
    const text = `Hi dear user,\n\n` +
      `A reset password procedure for your account ${to} has been requested on ${CONFIG.WEBSERVER.HOST} ` +
      `Please follow this link to reset it: ${resetPasswordUrl}\n\n` +
      `If you are not the person who initiated this request, please ignore this email.\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to: [ to ],
      subject: 'Reset your PeerTube password',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVerifyEmailJob (to: string, verifyEmailUrl: string) {
    const text = `Welcome to PeerTube,\n\n` +
      `To start using PeerTube on ${CONFIG.WEBSERVER.HOST} you must  verify your email! ` +
      `Please follow this link to verify this email belongs to you: ${verifyEmailUrl}\n\n` +
      `If you are not the person who initiated this request, please ignore this email.\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const emailPayload: EmailPayload = {
      to: [ to ],
      subject: 'Verify your PeerTube email',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addUserBlockJob (user: UserModel, blocked: boolean, reason?: string) {
    const reasonString = reason ? ` for the following reason: ${reason}` : ''
    const blockedWord = blocked ? 'blocked' : 'unblocked'
    const blockedString = `Your account ${user.username} on ${CONFIG.WEBSERVER.HOST} has been ${blockedWord}${reasonString}.`

    const text = 'Hi,\n\n' +
      blockedString +
      '\n\n' +
      'Cheers,\n' +
      `PeerTube.`

    const to = user.email
    const emailPayload: EmailPayload = {
      to: [ to ],
      subject: '[PeerTube] Account ' + blockedWord,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addContactFormJob (fromEmail: string, fromName: string, body: string) {
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
      subject: '[PeerTube] Contact form submitted',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  sendMail (options: EmailPayload) {
    if (!Emailer.isEnabled()) {
      throw new Error('Cannot send mail because SMTP is not configured.')
    }

    const fromDisplayName = options.fromDisplayName
      ? options.fromDisplayName
      : CONFIG.WEBSERVER.HOST

    return this.transporter.sendMail({
      from: `"${fromDisplayName}" <${CONFIG.SMTP.FROM_ADDRESS}>`,
      replyTo: options.replyTo,
      to: options.to.join(','),
      subject: options.subject,
      text: options.text
    })
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

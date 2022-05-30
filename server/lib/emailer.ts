import { readFileSync } from 'fs-extra'
import { merge } from 'lodash'
import { createTransport, Transporter } from 'nodemailer'
import { join } from 'path'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { MVideoBlacklistLightVideo, MVideoBlacklistVideo } from '@server/types/models/video/video-blacklist'
import { MVideoImport, MVideoImportVideo } from '@server/types/models/video/video-import'
import { AbuseState, EmailPayload, UserAbuse } from '@shared/models'
import { SendEmailDefaultOptions } from '../../shared/models/server/emailer.model'
import { isTestInstance, root } from '../helpers/core-utils'
import { bunyanLogger, logger } from '../helpers/logger'
import { CONFIG, isEmailEnabled } from '../initializers/config'
import { WEBSERVER } from '../initializers/constants'
import { MAbuseFull, MAbuseMessage, MAccountDefault, MActorFollowActors, MActorFollowFull, MPlugin, MUser } from '../types/models'
import { MCommentOwnerVideo, MVideo, MVideoAccountLight } from '../types/models/video'
import { JobQueue } from './job-queue'
import { toSafeHtml } from '../helpers/markdown'

const Email = require('email-templates')

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

    if (!isEmailEnabled()) {
      if (!isTestInstance()) {
        logger.error('Cannot use SMTP server because of lack of configuration. PeerTube will not be able to send mails!')
      }

      return
    }

    if (CONFIG.SMTP.TRANSPORT === 'smtp') this.initSMTPTransport()
    else if (CONFIG.SMTP.TRANSPORT === 'sendmail') this.initSendmailTransport()
  }

  async checkConnection () {
    if (!this.transporter || CONFIG.SMTP.TRANSPORT !== 'smtp') return

    logger.info('Testing SMTP server...')

    try {
      const success = await this.transporter.verify()
      if (success !== true) this.warnOnConnectionFailure()

      logger.info('Successfully connected to SMTP server.')
    } catch (err) {
      this.warnOnConnectionFailure(err)
    }
  }

  addNewVideoFromSubscriberNotification (to: string[], video: MVideoAccountLight) {
    const channelName = video.VideoChannel.getDisplayName()
    const videoUrl = WEBSERVER.URL + video.getWatchStaticPath()

    const emailPayload: EmailPayload = {
      to,
      subject: channelName + ' just published a new video',
      text: `Your subscription ${channelName} just published a new video: "${video.name}".`,
      locals: {
        title: 'New content ',
        action: {
          text: 'View video',
          url: videoUrl
        }
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewFollowNotification (to: string[], actorFollow: MActorFollowFull, followType: 'account' | 'channel') {
    const followingName = (actorFollow.ActorFollowing.VideoChannel || actorFollow.ActorFollowing.Account).getDisplayName()

    const emailPayload: EmailPayload = {
      template: 'follower-on-channel',
      to,
      subject: `New follower on your channel ${followingName}`,
      locals: {
        followerName: actorFollow.ActorFollower.Account.getDisplayName(),
        followerUrl: actorFollow.ActorFollower.url,
        followingName,
        followingUrl: actorFollow.ActorFollowing.url,
        followType
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewInstanceFollowerNotification (to: string[], actorFollow: MActorFollowActors) {
    const awaitingApproval = actorFollow.state === 'pending' ? ' awaiting manual approval.' : ''

    const emailPayload: EmailPayload = {
      to,
      subject: 'New instance follower',
      text: `Your instance has a new follower: ${actorFollow.ActorFollower.url}${awaitingApproval}.`,
      locals: {
        title: 'New instance follower',
        action: {
          text: 'Review followers',
          url: WEBSERVER.URL + '/admin/follows/followers-list'
        }
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addAutoInstanceFollowingNotification (to: string[], actorFollow: MActorFollowActors) {
    const instanceUrl = actorFollow.ActorFollowing.url
    const emailPayload: EmailPayload = {
      to,
      subject: 'Auto instance following',
      text: `Your instance automatically followed a new instance: <a href="${instanceUrl}">${instanceUrl}</a>.`
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  myVideoPublishedNotification (to: string[], video: MVideo) {
    const videoUrl = WEBSERVER.URL + video.getWatchStaticPath()

    const emailPayload: EmailPayload = {
      to,
      subject: `Your video ${video.name} has been published`,
      text: `Your video "${video.name}" has been published.`,
      locals: {
        title: 'You video is live',
        action: {
          text: 'View video',
          url: videoUrl
        }
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  myVideoImportSuccessNotification (to: string[], videoImport: MVideoImportVideo) {
    const videoUrl = WEBSERVER.URL + videoImport.Video.getWatchStaticPath()

    const emailPayload: EmailPayload = {
      to,
      subject: `Your video import ${videoImport.getTargetIdentifier()} is complete`,
      text: `Your video "${videoImport.getTargetIdentifier()}" just finished importing.`,
      locals: {
        title: 'Import complete',
        action: {
          text: 'View video',
          url: videoUrl
        }
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  myVideoImportErrorNotification (to: string[], videoImport: MVideoImport) {
    const importUrl = WEBSERVER.URL + '/my-library/video-imports'

    const text =
      `Your video import "${videoImport.getTargetIdentifier()}" encountered an error.` +
      '\n\n' +
      `See your videos import dashboard for more information: <a href="${importUrl}">${importUrl}</a>.`

    const emailPayload: EmailPayload = {
      to,
      subject: `Your video import "${videoImport.getTargetIdentifier()}" encountered an error`,
      text,
      locals: {
        title: 'Import failed',
        action: {
          text: 'Review imports',
          url: importUrl
        }
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewCommentOnMyVideoNotification (to: string[], comment: MCommentOwnerVideo) {
    const video = comment.Video
    const videoUrl = WEBSERVER.URL + comment.Video.getWatchStaticPath()
    const commentUrl = WEBSERVER.URL + comment.getCommentStaticPath()
    const commentHtml = toSafeHtml(comment.text)

    const emailPayload: EmailPayload = {
      template: 'video-comment-new',
      to,
      subject: 'New comment on your video ' + video.name,
      locals: {
        accountName: comment.Account.getDisplayName(),
        accountUrl: comment.Account.Actor.url,
        comment,
        commentHtml,
        video,
        videoUrl,
        action: {
          text: 'View comment',
          url: commentUrl
        }
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewCommentMentionNotification (to: string[], comment: MCommentOwnerVideo) {
    const accountName = comment.Account.getDisplayName()
    const video = comment.Video
    const videoUrl = WEBSERVER.URL + comment.Video.getWatchStaticPath()
    const commentUrl = WEBSERVER.URL + comment.getCommentStaticPath()
    const commentHtml = toSafeHtml(comment.text)

    const emailPayload: EmailPayload = {
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

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addAbuseModeratorsNotification (to: string[], parameters: {
    abuse: UserAbuse
    abuseInstance: MAbuseFull
    reporter: string
  }) {
    const { abuse, abuseInstance, reporter } = parameters

    const action = {
      text: 'View report #' + abuse.id,
      url: WEBSERVER.URL + '/admin/moderation/abuses/list?search=%23' + abuse.id
    }

    let emailPayload: EmailPayload

    if (abuseInstance.VideoAbuse) {
      const video = abuseInstance.VideoAbuse.Video
      const videoUrl = WEBSERVER.URL + video.getWatchStaticPath()

      emailPayload = {
        template: 'video-abuse-new',
        to,
        subject: `New video abuse report from ${reporter}`,
        locals: {
          videoUrl,
          isLocal: video.remote === false,
          videoCreatedAt: new Date(video.createdAt).toLocaleString(),
          videoPublishedAt: new Date(video.publishedAt).toLocaleString(),
          videoName: video.name,
          reason: abuse.reason,
          videoChannel: abuse.video.channel,
          reporter,
          action
        }
      }
    } else if (abuseInstance.VideoCommentAbuse) {
      const comment = abuseInstance.VideoCommentAbuse.VideoComment
      const commentUrl = WEBSERVER.URL + comment.Video.getWatchStaticPath() + ';threadId=' + comment.getThreadId()

      emailPayload = {
        template: 'video-comment-abuse-new',
        to,
        subject: `New comment abuse report from ${reporter}`,
        locals: {
          commentUrl,
          videoName: comment.Video.name,
          isLocal: comment.isOwned(),
          commentCreatedAt: new Date(comment.createdAt).toLocaleString(),
          reason: abuse.reason,
          flaggedAccount: abuseInstance.FlaggedAccount.getDisplayName(),
          reporter,
          action
        }
      }
    } else {
      const account = abuseInstance.FlaggedAccount
      const accountUrl = account.getClientUrl()

      emailPayload = {
        template: 'account-abuse-new',
        to,
        subject: `New account abuse report from ${reporter}`,
        locals: {
          accountUrl,
          accountDisplayName: account.getDisplayName(),
          isLocal: account.isOwned(),
          reason: abuse.reason,
          reporter,
          action
        }
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addAbuseStateChangeNotification (to: string[], abuse: MAbuseFull) {
    const text = abuse.state === AbuseState.ACCEPTED
      ? 'Report #' + abuse.id + ' has been accepted'
      : 'Report #' + abuse.id + ' has been rejected'

    const abuseUrl = WEBSERVER.URL + '/my-account/abuses?search=%23' + abuse.id

    const action = {
      text,
      url: abuseUrl
    }

    const emailPayload: EmailPayload = {
      template: 'abuse-state-change',
      to,
      subject: text,
      locals: {
        action,
        abuseId: abuse.id,
        abuseUrl,
        isAccepted: abuse.state === AbuseState.ACCEPTED
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addAbuseNewMessageNotification (
    to: string[],
    options: {
      target: 'moderator' | 'reporter'
      abuse: MAbuseFull
      message: MAbuseMessage
      accountMessage: MAccountDefault
    }) {
    const { abuse, target, message, accountMessage } = options

    const text = 'New message on report #' + abuse.id
    const abuseUrl = target === 'moderator'
      ? WEBSERVER.URL + '/admin/moderation/abuses/list?search=%23' + abuse.id
      : WEBSERVER.URL + '/my-account/abuses?search=%23' + abuse.id

    const action = {
      text,
      url: abuseUrl
    }

    const emailPayload: EmailPayload = {
      template: 'abuse-new-message',
      to,
      subject: text,
      locals: {
        abuseId: abuse.id,
        abuseUrl: action.url,
        messageAccountName: accountMessage.getDisplayName(),
        messageText: message.message,
        action
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  async addVideoAutoBlacklistModeratorsNotification (to: string[], videoBlacklist: MVideoBlacklistLightVideo) {
    const videoAutoBlacklistUrl = WEBSERVER.URL + '/admin/moderation/video-auto-blacklist/list'
    const videoUrl = WEBSERVER.URL + videoBlacklist.Video.getWatchStaticPath()
    const channel = (await VideoChannelModel.loadAndPopulateAccount(videoBlacklist.Video.channelId)).toFormattedSummaryJSON()

    const emailPayload: EmailPayload = {
      template: 'video-auto-blacklist-new',
      to,
      subject: 'A new video is pending moderation',
      locals: {
        channel,
        videoUrl,
        videoName: videoBlacklist.Video.name,
        action: {
          text: 'Review autoblacklist',
          url: videoAutoBlacklistUrl
        }
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewUserRegistrationNotification (to: string[], user: MUser) {
    const emailPayload: EmailPayload = {
      template: 'user-registered',
      to,
      subject: `a new user registered on ${CONFIG.INSTANCE.NAME}: ${user.username}`,
      locals: {
        user
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVideoBlacklistNotification (to: string[], videoBlacklist: MVideoBlacklistVideo) {
    const videoName = videoBlacklist.Video.name
    const videoUrl = WEBSERVER.URL + videoBlacklist.Video.getWatchStaticPath()

    const reasonString = videoBlacklist.reason ? ` for the following reason: ${videoBlacklist.reason}` : ''
    const blockedString = `Your video ${videoName} (${videoUrl} on ${CONFIG.INSTANCE.NAME} has been blacklisted${reasonString}.`

    const emailPayload: EmailPayload = {
      to,
      subject: `Video ${videoName} blacklisted`,
      text: blockedString,
      locals: {
        title: 'Your video was blacklisted'
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVideoUnblacklistNotification (to: string[], video: MVideo) {
    const videoUrl = WEBSERVER.URL + video.getWatchStaticPath()

    const emailPayload: EmailPayload = {
      to,
      subject: `Video ${video.name} unblacklisted`,
      text: `Your video "${video.name}" (${videoUrl}) on ${CONFIG.INSTANCE.NAME} has been unblacklisted.`,
      locals: {
        title: 'Your video was unblacklisted'
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewPeerTubeVersionNotification (to: string[], latestVersion: string) {
    const emailPayload: EmailPayload = {
      to,
      template: 'peertube-version-new',
      subject: `A new PeerTube version is available: ${latestVersion}`,
      locals: {
        latestVersion
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addNewPlugionVersionNotification (to: string[], plugin: MPlugin) {
    const pluginUrl = WEBSERVER.URL + '/admin/plugins/list-installed?pluginType=' + plugin.type

    const emailPayload: EmailPayload = {
      to,
      template: 'plugin-version-new',
      subject: `A new plugin/theme version is available: ${plugin.name}@${plugin.latestVersion}`,
      locals: {
        pluginName: plugin.name,
        latestVersion: plugin.latestVersion,
        pluginUrl
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addPasswordResetEmailJob (username: string, to: string, resetPasswordUrl: string) {
    const emailPayload: EmailPayload = {
      template: 'password-reset',
      to: [ to ],
      subject: 'Reset your account password',
      locals: {
        username,
        resetPasswordUrl
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addPasswordCreateEmailJob (username: string, to: string, createPasswordUrl: string) {
    const emailPayload: EmailPayload = {
      template: 'password-create',
      to: [ to ],
      subject: 'Create your account password',
      locals: {
        username,
        createPasswordUrl
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addVerifyEmailJob (username: string, to: string, verifyEmailUrl: string) {
    const emailPayload: EmailPayload = {
      template: 'verify-email',
      to: [ to ],
      subject: `Verify your email on ${CONFIG.INSTANCE.NAME}`,
      locals: {
        username,
        verifyEmailUrl
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addUserBlockJob (user: MUser, blocked: boolean, reason?: string) {
    const reasonString = reason ? ` for the following reason: ${reason}` : ''
    const blockedWord = blocked ? 'blocked' : 'unblocked'

    const to = user.email
    const emailPayload: EmailPayload = {
      to: [ to ],
      subject: 'Account ' + blockedWord,
      text: `Your account ${user.username} on ${CONFIG.INSTANCE.NAME} has been ${blockedWord}${reasonString}.`
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  addContactFormJob (fromEmail: string, fromName: string, subject: string, body: string) {
    const emailPayload: EmailPayload = {
      template: 'contact-form',
      to: [ CONFIG.ADMIN.EMAIL ],
      replyTo: `"${fromName}" <${fromEmail}>`,
      subject: `(contact form) ${subject}`,
      locals: {
        fromName,
        fromEmail,
        body,

        // There are not notification preferences for the contact form
        hideNotificationPreferences: true
      }
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  async sendMail (options: EmailPayload) {
    if (!isEmailEnabled()) {
      throw new Error('Cannot send mail because SMTP is not configured.')
    }

    const fromDisplayName = options.from
      ? options.from
      : CONFIG.INSTANCE.NAME

    const email = new Email({
      send: true,
      message: {
        from: `"${fromDisplayName}" <${CONFIG.SMTP.FROM_ADDRESS}>`
      },
      transport: this.transporter,
      views: {
        root: join(root(), 'dist', 'server', 'lib', 'emails')
      },
      subjectPrefix: CONFIG.EMAIL.SUBJECT.PREFIX
    })

    for (const to of options.to) {
      const baseOptions: SendEmailDefaultOptions = {
        template: 'common',
        message: {
          to,
          from: options.from,
          subject: options.subject,
          replyTo: options.replyTo
        },
        locals: { // default variables available in all templates
          WEBSERVER,
          EMAIL: CONFIG.EMAIL,
          instanceName: CONFIG.INSTANCE.NAME,
          text: options.text,
          subject: options.subject
        }
      }

      // overriden/new variables given for a specific template in the payload
      const sendOptions = merge(baseOptions, options)

      await email.send(sendOptions)
        .then(res => logger.debug('Sent email.', { res }))
        .catch(err => logger.error('Error in email sender.', { err }))
    }
  }

  private warnOnConnectionFailure (err?: Error) {
    logger.error('Failed to connect to SMTP %s:%d.', CONFIG.SMTP.HOSTNAME, CONFIG.SMTP.PORT, { err })
  }

  private initSMTPTransport () {
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
  }

  private initSendmailTransport () {
    logger.info('Using sendmail to send emails')

    this.transporter = createTransport({
      sendmail: true,
      newline: 'unix',
      path: CONFIG.SMTP.SENDMAIL,
      logger: bunyanLogger as any
    })
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  Emailer
}

import { createTransport, Transporter } from 'nodemailer'
import { UserRight } from '../../shared/models/users'
import { isTestInstance } from '../helpers/core-utils'
import { bunyanLogger, logger } from '../helpers/logger'
import { CONFIG } from '../initializers'
import { UserModel } from '../models/account/user'
import { VideoModel } from '../models/video/video'
import { JobQueue } from './job-queue'
import { EmailPayload } from './job-queue/handlers/email'
import { readFileSync } from 'fs'

class Emailer {

  private static instance: Emailer
  private initialized = false
  private transporter: Transporter

  private constructor () {}

  init () {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    if (CONFIG.SMTP.HOSTNAME && CONFIG.SMTP.PORT) {
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

  addForgetPasswordEmailJob (to: string, resetPasswordUrl: string) {
    const text = `Hi dear user,\n\n` +
      `It seems you forgot your password on ${CONFIG.WEBSERVER.HOST}! ` +
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

  async addVideoAbuseReportJob (videoId: number) {
    const video = await VideoModel.load(videoId)
    if (!video) throw new Error('Unknown Video id during Abuse report.')

    const text = `Hi,\n\n` +
      `Your instance received an abuse for the following video ${video.url}\n\n` +
      `Cheers,\n` +
      `PeerTube.`

    const to = await UserModel.listEmailsWithRight(UserRight.MANAGE_VIDEO_ABUSES)
    const emailPayload: EmailPayload = {
      to,
      subject: '[PeerTube] Received a video abuse',
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  async addVideoBlacklistReportJob (videoId: number, reason?: string) {
    const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)
    if (!video) throw new Error('Unknown Video id during Blacklist report.')
    // It's not our user
    if (video.remote === true) return

    const user = await UserModel.loadById(video.VideoChannel.Account.userId)

    const reasonString = reason ? ` for the following reason: ${reason}` : ''
    const blockedString = `Your video ${video.name} on ${CONFIG.WEBSERVER.HOST} has been blacklisted${reasonString}.`

    const text = 'Hi,\n\n' +
      blockedString +
      '\n\n' +
      'Cheers,\n' +
      `PeerTube.`

    const to = user.email
    const emailPayload: EmailPayload = {
      to: [ to ],
      subject: `[PeerTube] Video ${video.name} blacklisted`,
      text
    }

    return JobQueue.Instance.createJob({ type: 'email', payload: emailPayload })
  }

  async addVideoUnblacklistReportJob (videoId: number) {
    const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)
    if (!video) throw new Error('Unknown Video id during Blacklist report.')
    // It's not our user
    if (video.remote === true) return

    const user = await UserModel.loadById(video.VideoChannel.Account.userId)

    const text = 'Hi,\n\n' +
      `Your video ${video.name} on ${CONFIG.WEBSERVER.HOST} has been unblacklisted.` +
      '\n\n' +
      'Cheers,\n' +
      `PeerTube.`

    const to = user.email
    const emailPayload: EmailPayload = {
      to: [ to ],
      subject: `[PeerTube] Video ${video.name} unblacklisted`,
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

  sendMail (to: string[], subject: string, text: string) {
    if (!this.transporter) {
      throw new Error('Cannot send mail because SMTP is not configured.')
    }

    return this.transporter.sendMail({
      from: CONFIG.SMTP.FROM_ADDRESS,
      to: to.join(','),
      subject,
      text
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
  Emailer
}

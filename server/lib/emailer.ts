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
      `Please follow this link to reset it: ${resetPasswordUrl}.\n\n` +
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

  async addVideoAbuseReport (videoId: number) {
    const video = await VideoModel.load(videoId)

    const text = `Hi,\n\n` +
      `Your instance received an abuse for video the following video ${video.url}\n\n` +
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

import { arrayify } from '@peertube/peertube-core-utils'
import { EmailPayload, SendEmailDefaultOptions, UserExportState, UserRegistrationState } from '@peertube/peertube-models'
import { isTestOrDevInstance, root } from '@peertube/peertube-node-utils'
import { readFileSync } from 'fs'
import merge from 'lodash-es/merge.js'
import { Transporter, createTransport } from 'nodemailer'
import { join } from 'path'
import { bunyanLogger, logger } from '../helpers/logger.js'
import { CONFIG, isEmailEnabled } from '../initializers/config.js'
import { WEBSERVER } from '../initializers/constants.js'
import { MRegistration, MUser, MUserExport, MUserImport } from '../types/models/index.js'
import { JobQueue } from './job-queue/index.js'
import { UserModel } from '@server/models/user/user.js'

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
      if (!isTestOrDevInstance()) {
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

  // ---------------------------------------------------------------------------

  addPasswordResetEmailJob (username: string, to: string, resetPasswordUrl: string) {
    const emailPayload: EmailPayload = {
      template: 'password-reset',
      to: [ to ],
      subject: 'Reset your account password',
      locals: {
        username,
        resetPasswordUrl,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  addPasswordCreateEmailJob (username: string, to: string, createPasswordUrl: string) {
    const emailPayload: EmailPayload = {
      template: 'password-create',
      to: [ to ],
      subject: 'Create your account password',
      locals: {
        username,
        createPasswordUrl,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  addVerifyEmailJob (options: {
    username: string
    isRegistrationRequest: boolean
    to: string
    verifyEmailUrl: string
  }) {
    const { username, isRegistrationRequest, to, verifyEmailUrl } = options

    const emailPayload: EmailPayload = {
      template: 'verify-email',
      to: [ to ],
      subject: `Verify your email on ${CONFIG.INSTANCE.NAME}`,
      locals: {
        username,
        verifyEmailUrl,
        isRegistrationRequest,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
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

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
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
        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  addUserRegistrationRequestProcessedJob (registration: MRegistration) {
    let template: string
    let subject: string
    if (registration.state === UserRegistrationState.ACCEPTED) {
      template = 'user-registration-request-accepted'
      subject = `Your registration request for ${registration.username} has been accepted`
    } else {
      template = 'user-registration-request-rejected'
      subject = `Your registration request for ${registration.username} has been rejected`
    }

    const to = registration.email
    const emailPayload: EmailPayload = {
      to: [ to ],
      template,
      subject,
      locals: {
        username: registration.username,
        moderationResponse: registration.moderationResponse,
        loginLink: WEBSERVER.URL + '/login',

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  // ---------------------------------------------------------------------------

  async addUserExportCompletedOrErroredJob (userExport: MUserExport) {
    let template: string
    let subject: string

    if (userExport.state === UserExportState.COMPLETED) {
      template = 'user-export-completed'
      subject = `Your export archive has been created`
    } else {
      template = 'user-export-errored'
      subject = `Failed to create your export archive`
    }

    const user = await UserModel.loadById(userExport.userId)

    const emailPayload: EmailPayload = {
      to: [ user.email ],
      template,
      subject,
      locals: {
        exportsUrl: WEBSERVER.URL + '/my-account/import-export',
        errorMessage: userExport.error,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  async addUserImportErroredJob (userImport: MUserImport) {
    const user = await UserModel.loadById(userImport.userId)

    const emailPayload: EmailPayload = {
      to: [ user.email ],
      template: 'user-import-errored',
      subject: 'Failed to import your archive',
      locals: {
        errorMessage: userImport.error,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  async addUserImportSuccessJob (userImport: MUserImport) {
    const user = await UserModel.loadById(userImport.userId)

    const emailPayload: EmailPayload = {
      to: [ user.email ],
      template: 'user-import-completed',
      subject: 'Your archive import has finished',
      locals: {
        resultStats: userImport.resultSummary.stats,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  // ---------------------------------------------------------------------------

  async sendMail (options: EmailPayload) {
    if (!isEmailEnabled()) {
      logger.info('Cannot send mail because SMTP is not configured.')
      return
    }

    const fromDisplayName = options.from
      ? options.from
      : CONFIG.INSTANCE.NAME

    const EmailTemplates = (await import('email-templates')).default

    const email = new EmailTemplates({
      send: true,
      htmlToText: {
        selectors: [
          { selector: 'img', format: 'skip' },
          { selector: 'a', options: { hideLinkHrefIfSameAsText: true } }
        ]
      },
      message: {
        from: `"${fromDisplayName}" <${CONFIG.SMTP.FROM_ADDRESS}>`
      },
      transport: this.transporter,
      views: {
        root: join(root(), 'dist', 'core', 'assets', 'email-templates')
      },
      subjectPrefix: CONFIG.EMAIL.SUBJECT.PREFIX
    })

    const toEmails = arrayify(options.to)

    for (const to of toEmails) {
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

      // overridden/new variables given for a specific template in the payload
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

    let tls: { ca: [ Buffer ] }
    if (CONFIG.SMTP.CA_FILE) {
      tls = {
        ca: [ readFileSync(CONFIG.SMTP.CA_FILE) ]
      }
    }

    let auth: { user: string, pass: string }
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
      logger: bunyanLogger
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

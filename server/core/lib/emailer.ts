import { arrayify } from '@peertube/peertube-core-utils'
import { EmailPayload, MailAction, SendEmailDefaultOptions, To, UserExportState, UserRegistrationState } from '@peertube/peertube-models'
import { getFilenameWithoutExt, isTestOrDevInstance, root } from '@peertube/peertube-node-utils'
import { t } from '@server/helpers/i18n.js'
import { toSafeMailHtml } from '@server/helpers/markdown.js'
import { getServerActor } from '@server/models/application/application.js'
import { UserModel } from '@server/models/user/user.js'
import { readFileSync } from 'fs'
import { readdir, readFile } from 'fs/promises'
import handlebars, { HelperOptions } from 'handlebars'
import merge from 'lodash-es/merge.js'
import { createTransport, Transporter } from 'nodemailer'
import { join } from 'path'
import { bunyanLogger, logger } from '../helpers/logger.js'
import { CONFIG, isEmailEnabled } from '../initializers/config.js'
import { WEBSERVER } from '../initializers/constants.js'
import { MRegistration, MUserExport, MUserImport } from '../types/models/index.js'
import { loginUrl, myAccountImportExportUrl } from './client-urls.js'
import { JobQueue } from './job-queue/index.js'
import { Hooks } from './plugins/hooks.js'
import { ServerConfigManager } from './server-config-manager.js'

export class Emailer {
  private static instance: Emailer

  private initialized = false
  private registeringHandlebars: Promise<any>

  private transporter: Transporter

  private readonly compiledTemplates = new Map<string, HandlebarsTemplateDelegate>()

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

  addPasswordResetEmailJob (options: {
    username: string
    to: string
    language: string
    resetPasswordUrl: string
  }) {
    const { username, to, resetPasswordUrl, language } = options

    const emailPayload: EmailPayload = {
      template: 'password-reset',
      to: { email: to, language },
      subject: t('Reset your account password', language),
      locals: {
        username,
        resetPasswordUrl,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  addPasswordCreateEmailJob (options: {
    username: string
    to: string
    language: string
    createPasswordUrl: string
  }) {
    const { username, to, createPasswordUrl, language } = options

    const emailPayload: EmailPayload = {
      template: 'password-create',
      to: { email: to, language },
      subject: t('Create your account password', language),
      locals: {
        username,
        createPasswordUrl,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  addUserVerifyChangeEmailJob (options: {
    username: string
    to: string
    language: string
    verifyEmailUrl: string
  }) {
    const { username, to, verifyEmailUrl, language } = options

    const emailPayload: EmailPayload = {
      template: 'verify-user-change-email',
      to: { email: to, language },
      subject: t('Verify your email on {instanceName}', language, { instanceName: CONFIG.INSTANCE.NAME }),
      locals: {
        username,
        verifyEmailUrl,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  addRegistrationVerifyEmailJob (options: {
    username: string
    isRegistrationRequest: boolean
    to: string
    language: string
    verifyEmailUrl: string
  }) {
    const { username, isRegistrationRequest, to, verifyEmailUrl, language } = options

    const emailPayload: EmailPayload = {
      template: 'verify-registration-email',
      to: { email: to, language },

      subject: t('Verify your email on {instanceName}', language, { instanceName: CONFIG.INSTANCE.NAME }),
      locals: {
        username,
        verifyEmailUrl,
        isRegistrationRequest,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  addUserBlockJob (options: {
    username: string
    email: string
    language: string
    blocked: boolean
    reason?: string
  }) {
    const { username, language, email, blocked, reason } = options

    const emailPayload = blocked
      ? {
        template: 'my-user-block-new',
        to: { email, language },
        subject: t('Your account has been blocked', language),
        locals: {
          username,
          instanceName: CONFIG.INSTANCE.NAME,
          reason
        }
      }
      : {
        template: 'my-user-unblocked',
        to: { email, language },
        subject: t('Your account has been unblocked', language),
        locals: {
          username,
          instanceName: CONFIG.INSTANCE.NAME
        }
      }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  addContactFormJob (options: {
    fromEmail: string

    fromName: string
    subject: string
    body: string
  }) {
    const { fromEmail, fromName, subject, body } = options

    const emailPayload: EmailPayload = {
      template: 'contact-form',
      to: { email: CONFIG.ADMIN.EMAIL, language: CONFIG.INSTANCE.DEFAULT_LANGUAGE },
      replyTo: `"${fromName}" <${fromEmail}>`,
      subject: t('Contact form - {subject}', CONFIG.INSTANCE.DEFAULT_LANGUAGE, { subject }),
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

  addUserRegistrationRequestProcessedJob (
    registration: Pick<MRegistration, 'username' | 'state' | 'email' | 'moderationResponse'>
  ) {
    const language = CONFIG.INSTANCE.DEFAULT_LANGUAGE

    let template: string
    let subject: string
    let action: MailAction

    if (registration.state === UserRegistrationState.ACCEPTED) {
      template = 'user-registration-request-accepted'
      subject = t('Your registration request for {username} has been accepted', language, { username: registration.username })

      action = { text: t('Login to your account', language), url: loginUrl }
    } else {
      template = 'user-registration-request-rejected'
      subject = t('Your registration request for {username} has been rejected', language, { username: registration.username })
    }

    const to = registration.email
    const emailPayload: EmailPayload = {
      to: { email: to, language },
      template,
      subject,
      locals: {
        username: registration.username,
        moderationResponse: registration.moderationResponse,
        action,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  // ---------------------------------------------------------------------------

  async addUserExportCompletedOrErroredJob (userExport: Pick<MUserExport, 'userId' | 'state' | 'error'>, toOverride?: To) {
    let template: string
    let subject: string

    const to = toOverride ?? await UserModel.loadForEmail(userExport.userId)

    if (userExport.state === UserExportState.COMPLETED) {
      template = 'user-export-completed'
      subject = t('Your export archive has been created', to.language)
    } else {
      template = 'user-export-errored'
      subject = t('Failed to create your export archive', to.language)
    }

    const emailPayload: EmailPayload = {
      to,
      template,
      subject,
      locals: {
        exportsUrl: myAccountImportExportUrl,
        errorMessage: userExport.error,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  async addUserImportErroredJob (userImport: Pick<MUserImport, 'userId' | 'error'>, toOverride?: To) {
    const to = toOverride ?? await UserModel.loadForEmail(userImport.userId)

    const emailPayload: EmailPayload = {
      to,

      template: 'user-import-errored',
      subject: t('Failed to import your archive', to.language),
      locals: {
        errorMessage: userImport.error,

        hideNotificationPreferencesLink: true
      }
    }

    return JobQueue.Instance.createJobAsync({ type: 'email', payload: emailPayload })
  }

  async addUserImportSuccessJob (userImport: Pick<MUserImport, 'userId' | 'resultSummary'>, toOverride?: To) {
    const to = toOverride ?? await UserModel.loadForEmail(userImport.userId)

    const emailPayload: EmailPayload = {
      to,

      template: 'user-import-completed',
      subject: t('Your archive import has finished', to.language),
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
      juice: false,
      htmlToText: {
        selectors: [
          { selector: 'img', format: 'skip' },
          { selector: 'a', options: { hideLinkHrefIfSameAsText: true } }
        ]
      },
      render: async (view: string, locals: Record<string, string>) => {
        if (view.split('/').pop() !== 'html') return undefined

        await this.initHandlebarsIfNeeded()

        const templatePath = await Hooks.wrapObject(
          join(root(), 'dist', 'core', 'assets', 'email-templates', view + '.hbs'),
          'filter:email.template-path.result',
          { view }
        )

        let compiledTemplate = this.compiledTemplates.get(templatePath)

        if (!compiledTemplate) {
          compiledTemplate = handlebars.compile(await readFile(templatePath, 'utf-8'))
          this.compiledTemplates.set(templatePath, compiledTemplate)
        }

        return compiledTemplate(locals)
      },
      message: {
        from: `"${fromDisplayName}" <${CONFIG.SMTP.FROM_ADDRESS}>`
      },
      transport: this.transporter,
      subjectPrefix: this.buildSubjectPrefix()
    })
    const subject = await Hooks.wrapObject(
      options.subject,
      'filter:email.subject.result',
      { template: 'template' in options ? options.template : undefined }
    )

    const errors: Error[] = []

    for (const to of arrayify(options.to)) {
      const baseOptions: SendEmailDefaultOptions = {
        template: 'common',
        message: {
          to: to.email,
          from: options.from,
          subject,
          replyTo: options.replyTo
        },
        locals: { // default variables available in all templates
          WEBSERVER,
          instanceName: CONFIG.INSTANCE.NAME,
          text: options.text,
          subject,
          signature: this.buildSignature(),
          fg: CONFIG.THEME.CUSTOMIZATION.FOREGROUND_COLOR || '#000',
          bg: CONFIG.THEME.CUSTOMIZATION.BACKGROUND_COLOR || '#fff',
          primary: CONFIG.THEME.CUSTOMIZATION.PRIMARY_COLOR || '#FF8F37',
          language: to.language,
          logoUrl: ServerConfigManager.Instance.getLogoUrl(await getServerActor(), 192)
        }
      }

      // overridden/new variables given for a specific template in the payload
      const sendOptions = merge(baseOptions, options)

      try {
        const res = await email.send(sendOptions)

        logger.debug('Sent email.', { res })
      } catch (err) {
        errors.push(err)

        logger.error('Error in email sender.', { err })
      }
    }

    if (errors.length !== 0) {
      const err = new Error('Some errors when sent emails') as Error & { errors: Error[] }
      err.errors = errors

      throw err
    }
  }

  private warnOnConnectionFailure (err?: Error) {
    logger.error('Failed to connect to SMTP %s:%d.', CONFIG.SMTP.HOSTNAME, CONFIG.SMTP.PORT, { err })
  }

  private initSMTPTransport () {
    logger.info('Using %s:%s as SMTP server.', CONFIG.SMTP.HOSTNAME, CONFIG.SMTP.PORT)

    let tls: { ca: [Buffer] }
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

  private buildSubjectPrefix () {
    let prefix = CONFIG.EMAIL.SUBJECT.PREFIX
    if (!prefix) return prefix

    prefix = prefix.replace(/{{instanceName}}/g, CONFIG.INSTANCE.NAME)
    if (prefix.endsWith(' ')) return prefix

    return prefix + ' '
  }

  private buildSignature () {
    const signature = CONFIG.EMAIL.BODY.SIGNATURE
    if (!signature) return signature

    return signature.replace(/{{instanceName}}/g, CONFIG.INSTANCE.NAME)
  }

  private initHandlebarsIfNeeded () {
    if (this.registeringHandlebars !== undefined) return this.registeringHandlebars

    this.registeringHandlebars = this._initHandlebarsIfNeeded()

    return this.registeringHandlebars
  }

  private async _initHandlebarsIfNeeded () {
    const partialsPath = join(root(), 'dist', 'core', 'assets', 'email-templates', 'partials')
    const partialFiles = await readdir(partialsPath)

    for (const partialFile of partialFiles) {
      handlebars.registerPartial(getFilenameWithoutExt(partialFile), await readFile(join(partialsPath, partialFile), 'utf-8'))
    }

    handlebars.registerHelper('t', function (key: string, options: HelperOptions) {
      const result = t(key, this.language, options.hash)

      return toSafeMailHtml(result)
    })
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

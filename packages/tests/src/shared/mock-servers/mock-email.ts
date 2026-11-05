import { parallelTests } from '@peertube/peertube-node-utils'
import { allocateParallelPort } from '@peertube/peertube-server-commands'
import type { MailDev } from 'maildev'

class MockSmtpServer {
  private static instance: MockSmtpServer
  private started = false
  private maildev: MailDev
  private emails: object[]
  private collectLoginNotifications = false

  private constructor () {}

  async collectEmails (emailsCollection: object[], options: {
    // If true, will collect emails about new logins
    collectLoginNotifications?: boolean // Default: false
  } = {}) {
    this.collectLoginNotifications = options.collectLoginNotifications === true

    const outgoingHost = process.env.MAILDEV_RELAY_HOST
    const outgoingPort = process.env.MAILDEV_RELAY_PORT
      ? parseInt(process.env.MAILDEV_RELAY_PORT)
      : undefined

    const port = parallelTests() ? allocateParallelPort() : 1025
    this.emails = emailsCollection

    if (this.started) return undefined

    const { MailDev } = await import('maildev')

    this.maildev = new MailDev({
      ip: '127.0.0.1',
      smtp: port,
      disableWeb: true,
      silent: true,
      outgoingHost,
      outgoingPort,
      autoRelay: !!(outgoingHost || outgoingPort)
    })

    const { smtp } = await this.maildev.start()

    smtp.on('new', email => {
      if (!this.collectLoginNotifications && email.subject?.includes('New login to your account')) return

      this.emails.push(email)
    })

    this.started = true

    return port
  }

  async kill () {
    if (!this.maildev) return

    await this.maildev.stop()

    this.maildev = null
    MockSmtpServer.instance = null
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  MockSmtpServer
}

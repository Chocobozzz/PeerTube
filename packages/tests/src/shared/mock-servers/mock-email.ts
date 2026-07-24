import { randomInt } from '@peertube/peertube-core-utils'
import { parallelTests } from '@peertube/peertube-node-utils'

class MockSmtpServer {
  private static instance: MockSmtpServer
  private started = false
  private maildev: any
  private emails: object[]
  private collectLoginNotifications = false
  private relayingEmail: Promise<void>

  private

  private constructor () {}

  // Every successful login from a new device sends a notification email. Most tests don't expect it and
  // assert on the total number of collected emails, so ignore these emails unless explicitly asked
  collectEmails (emailsCollection: object[], options: { loginNotifications?: boolean } = {}) {
    this.collectLoginNotifications = options.loginNotifications === true

    const outgoingHost = process.env.MAILDEV_RELAY_HOST
    const outgoingPort = process.env.MAILDEV_RELAY_PORT
      ? parseInt(process.env.MAILDEV_RELAY_PORT)
      : undefined

    return new Promise<number>(async (res, rej) => {
      const port = parallelTests() ? randomInt(1025, 2000) : 1025
      this.emails = emailsCollection

      if (this.started) {
        return res(undefined)
      }

      const MailDev = await import('maildev').then(mod => mod.default)

      this.maildev = new MailDev({
        ip: '127.0.0.1',
        smtp: port,
        disableWeb: true,
        silent: true,
        outgoingHost,
        outgoingPort
      })

      this.maildev.on('new', email => {
        if (!this.collectLoginNotifications && email.subject?.includes('New login to your account')) return

        this.emails.push(email)

        if (outgoingHost || outgoingPort) {
          this.relayingEmail = new Promise(resolve => {
            this.maildev.relayMail(email, function (err) {
              if (err) return console.log(err)

              console.log('Email has been relayed!')

              this.relayingEmail = undefined
              resolve()
            })
          })
        }
      })

      this.maildev.listen(err => {
        if (err) return rej(err)

        this.started = true

        return res(port)
      })
    })
  }

  async kill () {
    if (!this.maildev) return

    if (this.relayingEmail !== undefined) {
      await this.relayingEmail
    }

    this.maildev.close()

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

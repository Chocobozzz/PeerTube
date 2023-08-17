import MailDev from '@peertube/maildev'
import { randomInt } from '@peertube/peertube-core-utils'
import { parallelTests } from '@peertube/peertube-node-utils'

class MockSmtpServer {

  private static instance: MockSmtpServer
  private started = false
  private maildev: any
  private emails: object[]

  private constructor () { }

  collectEmails (emailsCollection: object[]) {
    return new Promise<number>((res, rej) => {
      const port = parallelTests() ? randomInt(1025, 2000) : 1025
      this.emails = emailsCollection

      if (this.started) {
        return res(undefined)
      }

      this.maildev = new MailDev({
        ip: '127.0.0.1',
        smtp: port,
        disableWeb: true,
        silent: true
      })

      this.maildev.on('new', email => {
        this.emails.push(email)
      })

      this.maildev.listen(err => {
        if (err) return rej(err)

        this.started = true

        return res(port)
      })
    })
  }

  kill () {
    if (!this.maildev) return

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

import MailDev from '@peertube/maildev'

class MockSMTPServer {

  private static instance: MockSMTPServer
  private started = false
  private maildev: any
  private emails: object[]

  collectEmails (port: number, emailsCollection: object[]) {
    return new Promise<number>((res, rej) => {
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
    MockSMTPServer.instance = null
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  MockSMTPServer
}

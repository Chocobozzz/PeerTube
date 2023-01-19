import { ChildProcess } from 'child_process'
import MailDev from '@peertube/maildev'

class MockSMTPServer {

  private static instance: MockSMTPServer
  private started = false
  private emailChildProcess: ChildProcess
  private emails: object[]

  collectEmails (port: number, emailsCollection: object[]) {
    return new Promise<number>((res, rej) => {
      this.emails = emailsCollection

      if (this.started) {
        return res(undefined)
      }

      const maildev = new MailDev({
        ip: '127.0.0.1',
        smtp: port,
        disableWeb: true,
        silent: true
      })

      maildev.on('new', email => {
        this.emails.push(email)
      })

      maildev.listen(err => {
        if (err) return rej(err)

        this.started = true

        return res(port)
      })
    })
  }

  kill () {
    if (!this.emailChildProcess) return

    process.kill(this.emailChildProcess.pid)

    this.emailChildProcess = null
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

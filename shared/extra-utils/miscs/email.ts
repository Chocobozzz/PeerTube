import { ChildProcess } from 'child_process'
import { randomInt } from '../../core-utils/miscs/miscs'
import { parallelTests } from '../server/servers'

const MailDev = require('maildev')

class MockSmtpServer {

  private static instance: MockSmtpServer
  private started = false
  private emailChildProcess: ChildProcess
  private emails: object[]

  private constructor () { }

  collectEmails (emailsCollection: object[]) {
    return new Promise<number>((res, rej) => {
      const port = parallelTests() ? randomInt(1000, 2000) : 1025
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

import * as child from 'child_process'

class MockSmtpServer {

  private static instance: MockSmtpServer
  private started = false
  private emailChildProcess: child.ChildProcess
  private emails: object[]

  private constructor () {
    this.emailChildProcess = child.fork(`${__dirname}/email-child-process`, [], { silent: true })
    this.emailChildProcess.on('message', (msg) => {
      if (msg.email) {
        return this.emails.push(msg.email)
      }
    })
    process.on('exit', () => {
      this.emailChildProcess.kill()
    })
  }

  collectEmails (emailsCollection: object[]) {
    return new Promise((res, rej) => {
      if (this.started) {
        this.emails = emailsCollection
        return res()
      }

      // ensure maildev isn't started until
      // unexpected exit can be reported to test runner
      this.emailChildProcess.send({ start: true })
      this.emailChildProcess.on('exit', () => {
        return rej(new Error('maildev exited unexpectedly, confirm port not in use'))
      })
      this.emailChildProcess.on('message', (msg) => {
        if (msg.err) {
          return rej(new Error(msg.err))
        }
        this.started = true
        this.emails = emailsCollection
        return res()
      })
    })
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  MockSmtpServer
}

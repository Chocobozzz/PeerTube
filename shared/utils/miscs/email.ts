import * as MailDev from 'maildev'

function mockSmtpServer (emailsCollection: object[]) {
  const maildev = new MailDev({
    ip: '127.0.0.1',
    smtp: 1025,
    disableWeb: true,
    silent: true
  })
  maildev.on('new', email => emailsCollection.push(email))

  return new Promise((res, rej) => {
    maildev.listen(err => {
      if (err) return rej(err)

      return res()
    })
  })
}

// ---------------------------------------------------------------------------

export {
  mockSmtpServer
}

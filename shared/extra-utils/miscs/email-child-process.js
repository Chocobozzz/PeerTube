const MailDev = require('maildev')

// must run maildev as forked ChildProcess
// failed instantiation stops main process with exit code 0
process.on('message', (msg) => {
  if (msg.start) {
    const maildev = new MailDev({
      ip: '127.0.0.1',
      smtp: msg.port,
      disableWeb: true,
      silent: true
    })

    maildev.on('new', email => {
      process.send({ email })
    })

    maildev.listen(err => {
      if (err) {
        // cannot send as Error object
        return process.send({ err: err.message })
      }

      return process.send({ err: null })
    })
  }
})

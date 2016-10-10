'use strict'

const program = require('commander')

const utilsClient = require('../../utils/clients')
const utilsLogin = require('../../utils/login')

program
  .option('-u, --url <url>', 'Server url')
  .option('-n, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .parse(process.argv)

if (
  !program.url ||
  !program.username ||
  !program.password
) {
  throw new Error('All arguments are required.')
}

const server = {
  url: program.url,
  user: {
    username: program.username,
    password: program.password
  },
  client: {
    id: null,
    secret: null
  }
}

utilsClient.getClient(program.url, function (err, res) {
  if (err) throw err

  server.client.id = res.body.client_id
  server.client.secret = res.body.client_secret

  utilsLogin.loginAndGetAccessToken(server, function (err, accessToken) {
    if (err) throw err

    console.log(accessToken)
  })
})

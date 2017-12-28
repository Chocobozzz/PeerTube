import * as program from 'commander'

import {
  getClient,
  serverLogin
} from '../../utils'

program
  .option('-u, --url <url>', 'Server url')
  .option('-n, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .parse(process.argv)

if (
  !program['url'] ||
  !program['username'] ||
  !program['password']
) {
  throw new Error('All arguments are required.')
}

const server = {
  url: program['url'],
  user: {
    username: program['username'],
    password: program['password']
  },
  client: {
    id: null,
    secret: null
  }
}

getClient(program.url)
  .then(res => {
    server.client.id = res.body.client_id
    server.client.secret = res.body.client_secret

    return serverLogin(server)
  })
  .then(accessToken => {
    console.log(accessToken)
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

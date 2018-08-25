import * as program from 'commander'

import {
  getClient,
  serverLogin,
  Server,
  Client,
  User
} from '../tests/utils/index'

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

getClient(program.url)
  .then(res => {
    const server = {
      url: program['url'],
      user: {
        username: program['username'],
        password: program['password']
      } as User,
      client: {
        id: res.body.client_id as string,
        secret: res.body.client_secret as string
      } as Client
    } as Server

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

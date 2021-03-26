import { registerTSPaths } from '../helpers/register-ts-paths'
registerTSPaths()

import * as program from 'commander'
import { getClient, Server, serverLogin } from '../../shared/extra-utils'

program
  .option('-u, --url <url>', 'Server url')
  .option('-n, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .parse(process.argv)

const options = program.opts()

if (
  !options.url ||
  !options.username ||
  !options.password
) {
  if (!options.url) console.error('--url field is required.')
  if (!options.username) console.error('--username field is required.')
  if (!options.password) console.error('--password field is required.')

  process.exit(-1)
}

getClient(options.url)
  .then(res => {
    const server = {
      url: options.url,
      user: {
        username: options.username,
        password: options.password
      },
      client: {
        id: res.body.client_id,
        secret: res.body.client_secret
      }
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

import { Command } from '@commander-js/extra-typings'
import { assignToken, buildServer } from './shared/index.js'

export function defineGetAccessProgram () {
  const program = new Command()
    .name('get-access-token')
    .description('Get a peertube access token')
    .alias('token')

  program
    .option('-u, --url <url>', 'Server url')
    .option('-n, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .action(async options => {
      try {
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

        const server = buildServer(options.url)
        await assignToken(server, options.username, options.password)

        console.log(server.accessToken)
      } catch (err) {
        console.error('Cannot get access token: ' + err.message)
        process.exit(-1)
      }
    })

  return program
}

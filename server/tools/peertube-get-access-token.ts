import { program } from 'commander'
import { assignToken, buildServer } from './shared'

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

const server = buildServer(options.url)

assignToken(server, options.username, options.password)
  .then(() => {
    console.log(server.accessToken)
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

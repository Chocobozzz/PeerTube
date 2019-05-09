import * as program from 'commander'
import * as prompt from 'prompt'
import { getSettings, writeSettings, getNetrc } from './cli'
import { isHostValid } from '../helpers/custom-validators/servers'
import { isUserUsernameValid } from '../helpers/custom-validators/users'

const Table = require('cli-table')

async function delInstance (url: string) {
  const [ settings, netrc ] = await Promise.all([ getSettings(), getNetrc() ])

  settings.remotes.splice(settings.remotes.indexOf(url))
  await writeSettings(settings)

  delete netrc.machines[url]

  await netrc.save()
}

async function setInstance (url: string, username: string, password: string) {
  const [ settings, netrc ] = await Promise.all([ getSettings(), getNetrc() ])

  if (settings.remotes.indexOf(url) === -1) {
    settings.remotes.push(url)
  }
  await writeSettings(settings)

  netrc.machines[url] = { login: username, password }
  await netrc.save()
}

function isURLaPeerTubeInstance (url: string) {
  return isHostValid(url) || (url.includes('localhost'))
}

program
  .name('auth')
  .usage('[command] [options]')

program
  .command('add')
  .description('remember your accounts on remote instances for easier use')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('--default', 'add the entry as the new default')
  .action(options => {
    prompt.override = options
    prompt.start()
    prompt.get({
      properties: {
        url: {
          description: 'instance url',
          conform: (value) => isURLaPeerTubeInstance(value),
          required: true
        },
        username: {
          conform: (value) => isUserUsernameValid(value),
          message: 'Name must be only letters, spaces, or dashes',
          required: true
        },
        password: {
          hidden: true,
          replace: '*',
          required: true
        }
      }
    }, async (_, result) => {
      await setInstance(result.url, result.username, result.password)

      process.exit(0)
    })
  })

program
  .command('del <url>')
  .description('unregisters a remote instance')
  .action(async url => {
    await delInstance(url)

    process.exit(0)
  })

program
  .command('list')
  .description('lists registered remote instances')
  .action(async () => {
    const [ settings, netrc ] = await Promise.all([ getSettings(), getNetrc() ])

    const table = new Table({
      head: ['instance', 'login'],
      colWidths: [30, 30]
    })

    settings.remotes.forEach(element => {
      table.push([
        element,
        netrc.machines[element].login
      ])
    })

    console.log(table.toString())

    process.exit(0)
  })

program
  .command('set-default <url>')
  .description('set an existing entry as default')
  .action(async url => {
    const settings = await getSettings()
    const instanceExists = settings.remotes.indexOf(url) !== -1

    if (instanceExists) {
      settings.default = settings.remotes.indexOf(url)
      await writeSettings(settings)

      process.exit(0)
    } else {
      console.log('<url> is not a registered instance.')
      process.exit(-1)
    }
  })

program.on('--help', function () {
  console.log('  Examples:')
  console.log()
  console.log('    $ peertube add -u peertube.cpy.re -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD"')
  console.log('    $ peertube add -u peertube.cpy.re -U root')
  console.log('    $ peertube list')
  console.log('    $ peertube del peertube.cpy.re')
  console.log()
})

if (!process.argv.slice(2).length) {
  program.outputHelp()
}

program.parse(process.argv)

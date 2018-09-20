import * as program from 'commander'
import * as prompt from 'prompt'
const Table = require('cli-table')
import { getSettings, writeSettings, netrc } from './cli'
import { isHostValid } from '../helpers/custom-validators/servers'
import { isUserUsernameValid } from '../helpers/custom-validators/users'

function delInstance (url: string) {
  return new Promise((res, rej): void => {
    getSettings()
      .then(async (settings) => {
        settings.remotes.splice(settings.remotes.indexOf(url))
        await writeSettings(settings)
        delete netrc.machines[url]
        netrc.save()
        res()
      })
      .catch(err => rej(err))
  })
}

async function setInstance (url: string, username: string, password: string) {
  return new Promise((res, rej): void => {
    getSettings()
      .then(async settings => {
        if (settings.remotes.indexOf(url) === -1) {
          settings.remotes.push(url)
        }
        await writeSettings(settings)
        netrc.machines[url] = { login: username, password }
        netrc.save()
        res()
      })
      .catch(err => rej(err))
  })
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
    }, (_, result) => {
      setInstance(result.url, result.username, result.password)
    })
  })

program
  .command('del <url>')
  .description('unregisters a remote instance')
  .action((url) => {
    delInstance(url)
  })

program
  .command('list')
  .description('lists registered remote instances')
  .action(() => {
    getSettings()
      .then(settings => {
        const table = new Table({
          head: ['instance', 'login'],
          colWidths: [30, 30]
        })
        netrc.loadSync()
        settings.remotes.forEach(element => {
          table.push([
            element,
            netrc.machines[element].login
          ])
        })

        console.log(table.toString())
      })
  })

program
  .command('set-default <url>')
  .description('set an existing entry as default')
  .action((url) => {
    getSettings()
      .then(settings => {
        const instanceExists = settings.remotes.indexOf(url) !== -1

        if (instanceExists) {
          settings.default = settings.remotes.indexOf(url)
          writeSettings(settings)
        } else {
          console.log('<url> is not a registered instance.')
          process.exit(-1)
        }
      })
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

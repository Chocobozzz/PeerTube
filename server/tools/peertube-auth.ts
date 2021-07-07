// eslint-disable @typescript-eslint/no-unnecessary-type-assertion

import { registerTSPaths } from '../helpers/register-ts-paths'
registerTSPaths()

import { OptionValues, program } from 'commander'
import * as prompt from 'prompt'
import { getNetrc, getSettings, writeSettings } from './cli'
import { isUserUsernameValid } from '../helpers/custom-validators/users'
import { getAccessToken } from '../../shared/extra-utils'
import * as CliTable3 from 'cli-table3'

async function delInstance (url: string) {
  const [ settings, netrc ] = await Promise.all([ getSettings(), getNetrc() ])

  const index = settings.remotes.indexOf(url)
  settings.remotes.splice(index)

  if (settings.default === index) settings.default = -1

  await writeSettings(settings)

  delete netrc.machines[url]

  await netrc.save()
}

async function setInstance (url: string, username: string, password: string, isDefault: boolean) {
  const [ settings, netrc ] = await Promise.all([ getSettings(), getNetrc() ])

  if (settings.remotes.includes(url) === false) {
    settings.remotes.push(url)
  }

  if (isDefault || settings.remotes.length === 1) {
    settings.default = settings.remotes.length - 1
  }

  await writeSettings(settings)

  netrc.machines[url] = { login: username, password }
  await netrc.save()
}

function isURLaPeerTubeInstance (url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

function stripExtraneousFromPeerTubeUrl (url: string) {
  // Get everything before the 3rd /.
  const urlLength = url.includes('/', 8)
    ? url.indexOf('/', 8)
    : url.length

  return url.substr(0, urlLength)
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
  .action((options: OptionValues) => {
    /* eslint-disable no-import-assign */
    prompt.override = options
    prompt.start()
    prompt.get({
      properties: {
        url: {
          description: 'instance url',
          conform: (value) => isURLaPeerTubeInstance(value),
          message: 'It should be an URL (https://peertube.example.com)',
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

      // Check credentials
      try {
        // Strip out everything after the domain:port.
        // @see https://github.com/Chocobozzz/PeerTube/issues/3520
        result.url = stripExtraneousFromPeerTubeUrl(result.url)

        await getAccessToken(result.url, result.username, result.password)
      } catch (err) {
        console.error(err.message)
        process.exit(-1)
      }

      await setInstance(result.url, result.username, result.password, options.default)

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

    const table = new CliTable3({
      head: [ 'instance', 'login' ],
      colWidths: [ 30, 30 ]
    }) as any

    settings.remotes.forEach(element => {
      if (!netrc.machines[element]) return

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
    const instanceExists = settings.remotes.includes(url)

    if (instanceExists) {
      settings.default = settings.remotes.indexOf(url)
      await writeSettings(settings)

      process.exit(0)
    } else {
      console.log('<url> is not a registered instance.')
      process.exit(-1)
    }
  })

program.addHelpText('after', '\n\n  Examples:\n\n' +
  '    $ peertube auth add -u https://peertube.cpy.re -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD"\n' +
  '    $ peertube auth add -u https://peertube.cpy.re -U root\n' +
  '    $ peertube auth list\n' +
  '    $ peertube auth del https://peertube.cpy.re\n'
)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}

program.parse(process.argv)

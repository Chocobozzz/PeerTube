import { Command } from '@commander-js/extra-typings'
import CliTable3 from 'cli-table3'
import prompts from 'prompts'
import { assignToken, buildServer, getNetrc, getSettings, writeSettings } from './shared/index.js'

export function defineAuthProgram () {
  const program = new Command()
    .name('auth')
    .description('Register your accounts on remote instances to use them with other commands')

  program
    .command('add')
    .description('remember your accounts on remote instances for easier use')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .option('--default', 'add the entry as the new default')
    .action(async options => {
      const overrides = {
        url: options.url,
        username: options.username,
        password: options.password
      }

      const result = await prompts([
        {
          type: overrides.url ? null : 'text',
          name: 'url',
          message: 'instance url',
          validate: value => isURLaPeerTubeInstance(value) ? true : 'It should be an URL (https://peertube.example.com)'
        },
        {
          type: overrides.username ? null : 'text',
          name: 'username',
          message: 'username',
          validate: value => typeof value === 'string' && value.length !== 0 ? true : 'Name must be only letters, spaces, or dashes'
        },
        {
          type: overrides.password ? null : 'password',
          name: 'password',
          message: 'password',
          validate: value => typeof value === 'string' && value.length !== 0 ? true : 'Password is required'
        }
      ], {
        onCancel: () => {
          process.exit(1)
        }
      })

      const resolved = {
        url: overrides.url ?? result.url,
        username: overrides.username ?? result.username,
        password: overrides.password ?? result.password
      }

      // Check credentials
      try {
        // Strip out everything after the domain:port.
        // See https://github.com/Chocobozzz/PeerTube/issues/3520
        resolved.url = stripExtraneousFromPeerTubeUrl(resolved.url)

        const server = buildServer(resolved.url)
        await assignToken(server, resolved.username, resolved.password)
      } catch (err) {
        console.error(err.message)
        process.exit(-1)
      }

      await setInstance(resolved.url, resolved.username, resolved.password, options.default)

      process.exit(0)
    })

  program
    .command('del <url>')
    .description('Unregisters a remote instance')
    .action(async url => {
      await delInstance(url)

      process.exit(0)
    })

  program
    .command('list')
    .description('List registered remote instances')
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
    .description('Set an existing entry as default')
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

  program.addHelpText(
    'after',
    '\n\n  Examples:\n\n' +
      '    $ peertube auth add -u https://peertube.cpy.re -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD"\n' +
      '    $ peertube auth add -u https://peertube.cpy.re -U root\n' +
      '    $ peertube auth list\n' +
      '    $ peertube auth del https://peertube.cpy.re\n'
  )

  return program
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

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

  return url.substring(0, urlLength)
}

// eslint-disable @typescript-eslint/no-unnecessary-type-assertion

import { registerTSPaths } from '../helpers/register-ts-paths'
registerTSPaths()

import * as program from 'commander'
import { PluginType } from '../../shared/models/plugins/plugin.type'
import { installPlugin, listPlugins, uninstallPlugin, updatePlugin } from '../../shared/extra-utils/server/plugins'
import { getAdminTokenOrDie, getServerCredentials } from './cli'
import { PeerTubePlugin } from '../../shared/models/plugins/peertube-plugin.model'
import { isAbsolute } from 'path'
import * as CliTable3 from 'cli-table3'

program
  .name('plugins')
  .usage('[command] [options]')

program
  .command('list')
  .description('List installed plugins')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-t, --only-themes', 'List themes only')
  .option('-P, --only-plugins', 'List plugins only')
  .action(() => pluginsListCLI())

program
  .command('install')
  .description('Install a plugin or a theme')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-P --path <path>', 'Install from a path')
  .option('-n, --npm-name <npmName>', 'Install from npm')
  .action((options) => installPluginCLI(options))

program
  .command('update')
  .description('Update a plugin or a theme')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-P --path <path>', 'Update from a path')
  .option('-n, --npm-name <npmName>', 'Update from npm')
  .action((options) => updatePluginCLI(options))

program
  .command('uninstall')
  .description('Uninstall a plugin or a theme')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-n, --npm-name <npmName>', 'NPM plugin/theme name')
  .action(options => uninstallPluginCLI(options))

if (!process.argv.slice(2).length) {
  program.outputHelp()
}

program.parse(process.argv)

// ----------------------------------------------------------------------------

async function pluginsListCLI () {
  const { url, username, password } = await getServerCredentials(program)
  const accessToken = await getAdminTokenOrDie(url, username, password)

  let pluginType: PluginType
  if (program['onlyThemes']) pluginType = PluginType.THEME
  if (program['onlyPlugins']) pluginType = PluginType.PLUGIN

  const res = await listPlugins({
    url,
    accessToken,
    start: 0,
    count: 100,
    sort: 'name',
    pluginType
  })
  const plugins: PeerTubePlugin[] = res.body.data

  const table = new CliTable3({
    head: [ 'name', 'version', 'homepage' ],
    colWidths: [ 50, 10, 50 ]
  }) as any

  for (const plugin of plugins) {
    const npmName = plugin.type === PluginType.PLUGIN
      ? 'peertube-plugin-' + plugin.name
      : 'peertube-theme-' + plugin.name

    table.push([
      npmName,
      plugin.version,
      plugin.homepage
    ])
  }

  console.log(table.toString())
  process.exit(0)
}

async function installPluginCLI (options: any) {
  if (!options['path'] && !options['npmName']) {
    console.error('You need to specify the npm name or the path of the plugin you want to install.\n')
    program.outputHelp()
    process.exit(-1)
  }

  if (options['path'] && !isAbsolute(options['path'])) {
    console.error('Path should be absolute.')
    process.exit(-1)
  }

  const { url, username, password } = await getServerCredentials(options)
  const accessToken = await getAdminTokenOrDie(url, username, password)

  try {
    await installPlugin({
      url,
      accessToken,
      npmName: options['npmName'],
      path: options['path']
    })
  } catch (err) {
    console.error('Cannot install plugin.', err)
    process.exit(-1)
  }

  console.log('Plugin installed.')
  process.exit(0)
}

async function updatePluginCLI (options: any) {
  if (!options['path'] && !options['npmName']) {
    console.error('You need to specify the npm name or the path of the plugin you want to update.\n')
    program.outputHelp()
    process.exit(-1)
  }

  if (options['path'] && !isAbsolute(options['path'])) {
    console.error('Path should be absolute.')
    process.exit(-1)
  }

  const { url, username, password } = await getServerCredentials(options)
  const accessToken = await getAdminTokenOrDie(url, username, password)

  try {
    await updatePlugin({
      url,
      accessToken,
      npmName: options['npmName'],
      path: options['path']
    })
  } catch (err) {
    console.error('Cannot update plugin.', err)
    process.exit(-1)
  }

  console.log('Plugin updated.')
  process.exit(0)
}

async function uninstallPluginCLI (options: any) {
  if (!options['npmName']) {
    console.error('You need to specify the npm name of the plugin/theme you want to uninstall.\n')
    program.outputHelp()
    process.exit(-1)
  }

  const { url, username, password } = await getServerCredentials(options)
  const accessToken = await getAdminTokenOrDie(url, username, password)

  try {
    await uninstallPlugin({
      url,
      accessToken,
      npmName: options['npmName']
    })
  } catch (err) {
    console.error('Cannot uninstall plugin.', err)
    process.exit(-1)
  }

  console.log('Plugin uninstalled.')
  process.exit(0)
}

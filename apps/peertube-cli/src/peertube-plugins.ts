import CliTable3 from 'cli-table3'
import { isAbsolute } from 'path'
import { Command } from '@commander-js/extra-typings'
import { PluginType, PluginType_Type } from '@peertube/peertube-models'
import { assignToken, buildServer, CommonProgramOptions, getServerCredentials } from './shared/index.js'

export function definePluginsProgram () {
  const program = new Command()

  program
    .name('plugins')
    .description('Manage instance plugins/themes')
    .alias('p')

  program
    .command('list')
    .description('List installed plugins')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .option('-t, --only-themes', 'List themes only')
    .option('-P, --only-plugins', 'List plugins only')
    .action(async options => {
      try {
        await pluginsListCLI(options)
      } catch (err) {
        console.error('Cannot list plugins: ' + err.message)
        process.exit(-1)
      }
    })

  program
    .command('install')
    .description('Install a plugin or a theme')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .option('-P --path <path>', 'Install from a path')
    .option('-n, --npm-name <npmName>', 'Install from npm')
    .option('--plugin-version <pluginVersion>', 'Specify the plugin version to install (only available when installing from npm)')
    .action(async options => {
      try {
        await installPluginCLI(options)
      } catch (err) {
        console.error('Cannot install plugin: ' + err.message)
        process.exit(-1)
      }
    })

  program
    .command('update')
    .description('Update a plugin or a theme')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .option('-P --path <path>', 'Update from a path')
    .option('-n, --npm-name <npmName>', 'Update from npm')
    .action(async options => {
      try {
        await updatePluginCLI(options)
      } catch (err) {
        console.error('Cannot update plugin: ' + err.message)
        process.exit(-1)
      }
    })

  program
    .command('uninstall')
    .description('Uninstall a plugin or a theme')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .option('-n, --npm-name <npmName>', 'NPM plugin/theme name')
    .action(async options => {
      try {
        await uninstallPluginCLI(options)
      } catch (err) {
        console.error('Cannot uninstall plugin: ' + err.message)
        process.exit(-1)
      }
    })

  return program
}

// ----------------------------------------------------------------------------

async function pluginsListCLI (options: CommonProgramOptions & { onlyThemes?: true, onlyPlugins?: true }) {
  const { url, username, password } = await getServerCredentials(options)
  const server = buildServer(url)
  await assignToken(server, username, password)

  let pluginType: PluginType_Type
  if (options.onlyThemes) pluginType = PluginType.THEME
  if (options.onlyPlugins) pluginType = PluginType.PLUGIN

  const { data } = await server.plugins.list({ start: 0, count: 100, sort: 'name', pluginType })

  const table = new CliTable3({
    head: [ 'name', 'version', 'homepage' ],
    colWidths: [ 50, 20, 50 ]
  }) as any

  for (const plugin of data) {
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
}

async function installPluginCLI (options: CommonProgramOptions & { path?: string, npmName?: string, pluginVersion?: string }) {
  if (!options.path && !options.npmName) {
    throw new Error('You need to specify the npm name or the path of the plugin you want to install.')
  }

  if (options.path && !isAbsolute(options.path)) {
    throw new Error('Path should be absolute.')
  }

  const { url, username, password } = await getServerCredentials(options)
  const server = buildServer(url)
  await assignToken(server, username, password)

  await server.plugins.install({ npmName: options.npmName, path: options.path, pluginVersion: options.pluginVersion })

  console.log('Plugin installed.')
}

async function updatePluginCLI (options: CommonProgramOptions & { path?: string, npmName?: string }) {
  if (!options.path && !options.npmName) {
    throw new Error('You need to specify the npm name or the path of the plugin you want to update.')
  }

  if (options.path && !isAbsolute(options.path)) {
    throw new Error('Path should be absolute.')
  }

  const { url, username, password } = await getServerCredentials(options)
  const server = buildServer(url)
  await assignToken(server, username, password)

  await server.plugins.update({ npmName: options.npmName, path: options.path })

  console.log('Plugin updated.')
}

async function uninstallPluginCLI (options: CommonProgramOptions & { npmName?: string }) {
  if (!options.npmName) {
    throw new Error('You need to specify the npm name of the plugin/theme you want to uninstall.')
  }

  const { url, username, password } = await getServerCredentials(options)
  const server = buildServer(url)
  await assignToken(server, username, password)

  await server.plugins.uninstall({ npmName: options.npmName })

  console.log('Plugin uninstalled.')
}

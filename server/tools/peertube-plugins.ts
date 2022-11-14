import CliTable3 from 'cli-table3'
import { Command, OptionValues, program } from 'commander'
import { isAbsolute } from 'path'
import { PluginType } from '../../shared/models'
import { assignToken, buildServer, getServerCredentials } from './cli'

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
  .action((options, command) => pluginsListCLI(command, options))

program
  .command('install')
  .description('Install a plugin or a theme')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-P --path <path>', 'Install from a path')
  .option('-n, --npm-name <npmName>', 'Install from npm')
  .option('--plugin-version <pluginVersion>', 'Specify the plugin version to install (only available when installing from npm)')
  .action((options, command) => installPluginCLI(command, options))

program
  .command('update')
  .description('Update a plugin or a theme')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-P --path <path>', 'Update from a path')
  .option('-n, --npm-name <npmName>', 'Update from npm')
  .action((options, command) => updatePluginCLI(command, options))

program
  .command('uninstall')
  .description('Uninstall a plugin or a theme')
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-n, --npm-name <npmName>', 'NPM plugin/theme name')
  .action((options, command) => uninstallPluginCLI(command, options))

if (!process.argv.slice(2).length) {
  program.outputHelp()
}

program.parse(process.argv)

// ----------------------------------------------------------------------------

async function pluginsListCLI (command: Command, options: OptionValues) {
  const { url, username, password } = await getServerCredentials(command)
  const server = buildServer(url)
  await assignToken(server, username, password)

  let pluginType: PluginType
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
  process.exit(0)
}

async function installPluginCLI (command: Command, options: OptionValues) {
  if (!options.path && !options.npmName) {
    console.error('You need to specify the npm name or the path of the plugin you want to install.\n')
    program.outputHelp()
    process.exit(-1)
  }

  if (options.path && !isAbsolute(options.path)) {
    console.error('Path should be absolute.')
    process.exit(-1)
  }

  const { url, username, password } = await getServerCredentials(command)
  const server = buildServer(url)
  await assignToken(server, username, password)

  try {
    await server.plugins.install({ npmName: options.npmName, path: options.path, pluginVersion: options.pluginVersion })
  } catch (err) {
    console.error('Cannot install plugin.', err)
    process.exit(-1)
  }

  console.log('Plugin installed.')
  process.exit(0)
}

async function updatePluginCLI (command: Command, options: OptionValues) {
  if (!options.path && !options.npmName) {
    console.error('You need to specify the npm name or the path of the plugin you want to update.\n')
    program.outputHelp()
    process.exit(-1)
  }

  if (options.path && !isAbsolute(options.path)) {
    console.error('Path should be absolute.')
    process.exit(-1)
  }

  const { url, username, password } = await getServerCredentials(command)
  const server = buildServer(url)
  await assignToken(server, username, password)

  try {
    await server.plugins.update({ npmName: options.npmName, path: options.path })
  } catch (err) {
    console.error('Cannot update plugin.', err)
    process.exit(-1)
  }

  console.log('Plugin updated.')
  process.exit(0)
}

async function uninstallPluginCLI (command: Command, options: OptionValues) {
  if (!options.npmName) {
    console.error('You need to specify the npm name of the plugin/theme you want to uninstall.\n')
    program.outputHelp()
    process.exit(-1)
  }

  const { url, username, password } = await getServerCredentials(command)
  const server = buildServer(url)
  await assignToken(server, username, password)

  try {
    await server.plugins.uninstall({ npmName: options.npmName })
  } catch (err) {
    console.error('Cannot uninstall plugin.', err)
    process.exit(-1)
  }

  console.log('Plugin uninstalled.')
  process.exit(0)
}

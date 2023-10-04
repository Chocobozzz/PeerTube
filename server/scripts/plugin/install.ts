import { program } from 'commander'
import { isAbsolute } from 'path'
import { initDatabaseModels } from '../../core/initializers/database.js'
import { PluginManager } from '../../core/lib/plugins/plugin-manager.js'

program
  .option('-n, --npm-name [npmName]', 'Plugin to install')
  .option('-v, --plugin-version [pluginVersion]', 'Plugin version to install')
  .option('-p, --plugin-path [pluginPath]', 'Path of the plugin you want to install')
  .parse(process.argv)

const options = program.opts()

if (!options.npmName && !options.pluginPath) {
  console.error('You need to specify a plugin name with the desired version, or a plugin path.')
  process.exit(-1)
}

if (options.pluginPath && !isAbsolute(options.pluginPath)) {
  console.error('Plugin path should be absolute.')
  process.exit(-1)
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  const toInstall = options.npmName || options.pluginPath
  await PluginManager.Instance.install({
    toInstall,
    version: options.pluginVersion,
    fromDisk: !!options.pluginPath,
    register: false
  })
}

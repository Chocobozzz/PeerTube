import { registerTSPaths } from '../../server/helpers/register-ts-paths'
registerTSPaths()

import { initDatabaseModels } from '../../server/initializers/database'
import * as program from 'commander'
import { PluginManager } from '../../server/lib/plugins/plugin-manager'
import { isAbsolute } from 'path'

program
  .option('-n, --npm-name [npmName]', 'Plugin to install')
  .option('-v, --plugin-version [pluginVersion]', 'Plugin version to install')
  .option('-p, --plugin-path [pluginPath]', 'Path of the plugin you want to install')
  .parse(process.argv)

if (!program['npmName'] && !program['pluginPath']) {
  console.error('You need to specify a plugin name with the desired version, or a plugin path.')
  process.exit(-1)
}

if (program['pluginPath'] && !isAbsolute(program['pluginPath'])) {
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

  const toInstall = program['npmName'] || program['pluginPath']
  await PluginManager.Instance.install(toInstall, program['pluginVersion'], !!program['pluginPath'])
}

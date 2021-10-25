import { registerTSPaths } from '../../server/helpers/register-ts-paths'
registerTSPaths()

import { initDatabaseModels } from '../../server/initializers/database'
import { program } from 'commander'
import { PluginManager } from '../../server/lib/plugins/plugin-manager'

program
  .option('-n, --npm-name [npmName]', 'Package name to install')
  .parse(process.argv)

const options = program.opts()

if (!options.npmName) {
  console.error('You need to specify the plugin name.')
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

  const toUninstall = options.npmName
  await PluginManager.Instance.uninstall(toUninstall)
}

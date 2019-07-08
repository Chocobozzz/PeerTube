import { initDatabaseModels } from '../../server/initializers/database'
import * as program from 'commander'
import { PluginManager } from '../../server/lib/plugins/plugin-manager'
import { isAbsolute } from 'path'

program
  .option('-n, --package-name [packageName]', 'Package name to install')
  .parse(process.argv)

if (!program['packageName']) {
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

  const toUninstall = program['packageName']
  await PluginManager.Instance.uninstall(toUninstall)
}

import { initDatabaseModels } from '@server/initializers/database.js'
import { runAutomaticMigrationScript } from '@server/lib/migration-scripts/migration-scripts.js'

// PeerTube runs this script automatically in the background after the upgrade
// This CLI is kept for admins that prefer to run it themselves
run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  const result = await runAutomaticMigrationScript('peertube-8.3', { info: message => console.log(message) }, { waitForLock: true })

  if (result === 'already-run') console.log('Migration script peertube-8.3 has already been run.')
  else console.log('Done!')
}

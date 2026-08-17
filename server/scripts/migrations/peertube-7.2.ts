import { initDatabaseModels, sequelizeTypescript } from '@server/initializers/database.js'
import { ApplicationModel } from '@server/models/application/application.js'

const MIGRATION_NAME = 'peertube-7.2'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  console.log('Running SQL request to update comments count...')
  {
    const query = 'UPDATE "video" SET "comments" = (SELECT COUNT(*) FROM "videoComment" WHERE "videoComment"."videoId" = "video"."id")'
    await sequelizeTypescript.query(query)
  }

  await ApplicationModel.setManualMigrationScriptRun(MIGRATION_NAME)

  console.log('Done!')
}

import { initDatabaseModels, sequelizeTypescript } from '@server/initializers/database.js'
import { ApplicationModel } from '@server/models/application/application.js'
import { QueryTypes } from 'sequelize'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  const application = await ApplicationModel.load()
  if (application.migrationVersion < 960) {
    console.error('This migration script must be run after v8.0 migration')
    process.exit(-1)
  }

  const chunkSize = 500
  let i = 1

  console.log(`Running SQL request to delete unused actors, in chunks of maximum ${chunkSize} rows...`)

  while (true) {
    console.log('Processing chunk ' + i)

    const query = `WITH cte AS (SELECT id FROM "actor" WHERE "accountId" IS NULL AND "videoChannelId" IS NULL LIMIT ${chunkSize}) ` +
      `DELETE FROM "actor" WHERE id IN (SELECT "id" FROM cte) RETURNING id`

    const deleted = await sequelizeTypescript.query(query, {
      type: QueryTypes.BULKDELETE,
      replacements: { limit: chunkSize }
    })

    if (deleted < chunkSize) {
      break
    }

    i++
  }

  console.log('Done!')
}

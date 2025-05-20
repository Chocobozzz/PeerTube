import { initDatabaseModels, sequelizeTypescript } from '@server/initializers/database.js'

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

  console.log('Done!')
}

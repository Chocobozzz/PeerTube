import { sequelizeTypescript } from '@server/initializers/database.js'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await fillVideoSearchTable()
}

async function fillVideoSearchTable () {
  console.log('Filling videoSearch table with existing videos...')

  // video_search_vector() is created by the server on startup, so this builds the exact same vector as the trigger
  await sequelizeTypescript.query(`
    INSERT INTO "videoSearch" ("videoId", "searchVector")
    SELECT "id", video_search_vector(name, description)
    FROM "video"
    ON CONFLICT ("videoId") DO UPDATE SET
      "searchVector" = EXCLUDED."searchVector"
  `)

  console.log('videoSearch table filled.\n')
}

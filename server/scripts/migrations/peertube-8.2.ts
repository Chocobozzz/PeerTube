import { sequelizeTypescript } from '@server/initializers/database.js'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  try {
    await fillVideoSearchTable()
  } catch (err) {
    console.error('An error occurred while filling the videoSearch table:', err)
  }
}

async function fillVideoSearchTable () {
  console.log('Filling videoSearch table with existing videos...')

  await sequelizeTypescript.query(`
    INSERT INTO "videoSearch" ("videoId", "searchVector")
    SELECT
      "id",
      setweight(to_tsvector('simple', unaccent(coalesce(name, ''))), 'A') ||
      setweight(to_tsvector('simple', unaccent(coalesce(description, ''))), 'B')
    FROM "video"
    ON CONFLICT ("videoId") DO UPDATE SET
      "searchVector" = EXCLUDED."searchVector"
  `)

  console.log('videoSearch table filled.\n')
}

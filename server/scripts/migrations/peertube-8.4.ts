import { CONFIG } from '@server/initializers/config.js'
import { initDatabaseModels } from '@server/initializers/database.js'
import { indexVideoCaptionSegments } from '@server/lib/video-caption-segments.js'
import { ApplicationModel } from '@server/models/application/application.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { FileStorage } from '@peertube/peertube-models'

const MIGRATION_NAME = 'peertube-8.4'

const BATCH_SIZE = 100

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  // Only index when the feature is enabled, and do not mark the migration as run in that case: the admin
  // has to run this script again after enabling it, instead of getting an empty index without any warning
  if (CONFIG.SEARCH.CAPTION_SEARCH.ENABLED !== true) {
    console.log('Caption search is disabled (search.caption_search.enabled), nothing to index.')
    console.log('Enable it and run this script again to index the captions that already exist.')
    return
  }

  await fillVideoCaptionSegments()

  await ApplicationModel.setManualMigrationScriptRun(MIGRATION_NAME)
}

async function fillVideoCaptionSegments () {
  const total = await VideoCaptionModel.count()

  console.log(`Indexing the segments of ${total} captions...`)

  let indexedCaptions = 0
  let skippedObjectStorage = 0
  let skippedMissingFiles = 0

  for (let offset = 0; offset < total; offset += BATCH_SIZE) {
    const captions = await VideoCaptionModel.findAll({
      offset,
      limit: BATCH_SIZE,
      order: [ [ 'id', 'ASC' ] ]
    })

    for (const caption of captions) {
      // Caption files stored on object storage are not available locally, so they are left to a future run
      if (caption.storage === FileStorage.OBJECT_STORAGE) {
        skippedObjectStorage++
        continue
      }

      const before = await VideoCaptionModel.sequelize.query(
        'SELECT COUNT(*) AS "count" FROM "videoCaptionSegment" WHERE "captionId" = ' + caption.id,
        { type: 'SELECT', plain: true }
      ) as { count: string }

      await indexVideoCaptionSegments(caption)

      const after = await VideoCaptionModel.sequelize.query(
        'SELECT COUNT(*) AS "count" FROM "videoCaptionSegment" WHERE "captionId" = ' + caption.id,
        { type: 'SELECT', plain: true }
      ) as { count: string }

      // indexVideoCaptionSegments() only logs, so we have to check that rows were written
      if (parseInt(before.count, 10) === 0 && parseInt(after.count, 10) === 0) {
        skippedMissingFiles++
      } else {
        indexedCaptions++
      }
    }

    console.log(`${Math.min(offset + BATCH_SIZE, total)}/${total} captions processed...`)
  }

  console.log(
    `Caption segments index is filled: ${indexedCaptions} captions indexed, ` +
    `${skippedObjectStorage} skipped (object storage), ${skippedMissingFiles} skipped (no segment extracted).`
  )
}

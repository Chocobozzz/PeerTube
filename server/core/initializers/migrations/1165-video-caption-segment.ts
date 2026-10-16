import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  // One row per caption cue, so that a search can return a passage with its timestamps instead of a whole video
  await utils.sequelize.query(
    `CREATE TABLE IF NOT EXISTS "videoCaptionSegment" (
      "id" SERIAL,
      "videoId" INTEGER NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "captionId" INTEGER NOT NULL REFERENCES "videoCaption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "language" VARCHAR(15) NOT NULL,
      "automaticallyGenerated" BOOLEAN NOT NULL,
      "startMs" INTEGER NOT NULL,
      "endMs" INTEGER NOT NULL,
      "text" TEXT NOT NULL,
      "searchVector" tsvector NOT NULL,
      PRIMARY KEY ("id")
    )`,
    { transaction }
  )

  await utils.sequelize.query(
    `CREATE INDEX IF NOT EXISTS "video_caption_segment_search_vector" ON "videoCaptionSegment" USING GIN ("searchVector")`,
    { transaction }
  )

  await utils.sequelize.query(
    `CREATE INDEX IF NOT EXISTS "video_caption_segment_video_id" ON "videoCaptionSegment" ("videoId")`,
    { transaction }
  )

  await utils.sequelize.query(
    `CREATE INDEX IF NOT EXISTS "video_caption_segment_caption_id" ON "videoCaptionSegment" ("captionId")`,
    { transaction }
  )
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}

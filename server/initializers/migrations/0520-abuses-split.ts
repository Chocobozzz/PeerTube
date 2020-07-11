import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.renameTable('videoAbuse', 'abuse')

  await utils.sequelize.query(`
    ALTER TABLE "abuse"
    ADD COLUMN "flaggedAccountId" INTEGER REFERENCES "account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  `)

  await utils.sequelize.query(`
    UPDATE "abuse" SET "videoId" = NULL
    WHERE "videoId" NOT IN (SELECT "id" FROM "video")
  `)

  await utils.sequelize.query(`
    UPDATE "abuse" SET "flaggedAccountId" = "videoChannel"."accountId"
    FROM "video" INNER JOIN "videoChannel" ON "video"."channelId" = "videoChannel"."id"
    WHERE "abuse"."videoId" = "video"."id"
  `)

  await utils.sequelize.query('DROP INDEX IF EXISTS video_abuse_video_id;')
  await utils.sequelize.query('DROP INDEX IF EXISTS video_abuse_reporter_account_id;')

  await utils.sequelize.query(`
    CREATE TABLE IF NOT EXISTS "videoAbuse" (
      "id" serial,
      "startAt" integer DEFAULT NULL,
      "endAt" integer DEFAULT NULL,
      "deletedVideo" jsonb DEFAULT NULL,
      "abuseId" integer NOT NULL REFERENCES "abuse" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "videoId" integer REFERENCES "video" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "createdAt" TIMESTAMP WITH time zone NOT NULL,
      "updatedAt" timestamp WITH time zone NOT NULL,
      PRIMARY KEY ("id")
    );
  `)

  await utils.sequelize.query(`
    CREATE TABLE IF NOT EXISTS "commentAbuse" (
      "id" serial,
      "abuseId" integer NOT NULL REFERENCES "abuse" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "videoCommentId" integer REFERENCES "videoComment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "createdAt" timestamp WITH time zone NOT NULL,
      "updatedAt" timestamp WITH time zone NOT NULL,
      PRIMARY KEY ("id")
    );
  `)

  await utils.sequelize.query(`
      INSERT INTO "videoAbuse" ("startAt", "endAt", "deletedVideo", "abuseId", "videoId", "createdAt", "updatedAt")
      SELECT "abuse"."startAt", "abuse"."endAt", "abuse"."deletedVideo", "abuse"."id", "abuse"."videoId",
      "abuse"."createdAt", "abuse"."updatedAt"
      FROM "abuse"
  `)

  await utils.queryInterface.removeColumn('abuse', 'startAt')
  await utils.queryInterface.removeColumn('abuse', 'endAt')
  await utils.queryInterface.removeColumn('abuse', 'deletedVideo')
  await utils.queryInterface.removeColumn('abuse', 'videoId')

  await utils.sequelize.query('DROP INDEX IF EXISTS user_notification_video_abuse_id')
  await utils.queryInterface.renameColumn('userNotification', 'videoAbuseId', 'abuseId')

  await utils.sequelize.query(
    'ALTER INDEX IF EXISTS "videoAbuse_pkey" RENAME TO "abuse_pkey"'
  )

  await utils.queryInterface.renameColumn('userNotificationSetting', 'videoAbuseAsModerator', 'abuseAsModerator')
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}

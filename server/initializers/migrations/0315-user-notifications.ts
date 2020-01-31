import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  {
    const query = `
CREATE TABLE IF NOT EXISTS "userNotificationSetting" ("id" SERIAL,
"newVideoFromSubscription" INTEGER NOT NULL DEFAULT NULL,
"newCommentOnMyVideo" INTEGER NOT NULL DEFAULT NULL,
"videoAbuseAsModerator" INTEGER NOT NULL DEFAULT NULL,
"blacklistOnMyVideo" INTEGER NOT NULL DEFAULT NULL,
"myVideoPublished" INTEGER NOT NULL DEFAULT NULL,
"myVideoImportFinished" INTEGER NOT NULL DEFAULT NULL,
"newUserRegistration" INTEGER NOT NULL DEFAULT NULL,
"newFollow" INTEGER NOT NULL DEFAULT NULL,
"commentMention" INTEGER NOT NULL DEFAULT NULL,
"userId" INTEGER REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
PRIMARY KEY ("id"))
`
    await utils.sequelize.query(query)
  }

  {
    const query = 'INSERT INTO "userNotificationSetting" ' +
      '("newVideoFromSubscription", "newCommentOnMyVideo", "videoAbuseAsModerator", "blacklistOnMyVideo", ' +
      '"myVideoPublished", "myVideoImportFinished", "newUserRegistration", "newFollow", "commentMention", ' +
      '"userId", "createdAt", "updatedAt") ' +
      '(SELECT 1, 1, 3, 3, 1, 1, 1, 1, 1, id, NOW(), NOW() FROM "user")'

    await utils.sequelize.query(query)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}

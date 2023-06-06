import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const query = `
      CREATE TABLE IF NOT EXISTS "videoPassword" (
        "id"   SERIAL,
        "password" VARCHAR(255) NOT NULL,
        "videoId" INTEGER NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        PRIMARY KEY ("id")
      );
    `

    await utils.sequelize.query(query, { transaction : utils.transaction })
  }

  {
    const query = `
      CREATE UNIQUE INDEX "video_password_video_id_password" ON "videoPassword" ("videoId", "password")
    `

    await utils.sequelize.query(query, { transaction : utils.transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}

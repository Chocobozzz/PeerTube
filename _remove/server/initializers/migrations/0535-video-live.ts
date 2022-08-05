import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const query = `
    CREATE TABLE IF NOT EXISTS "videoLive" (
      "id"   SERIAL ,
      "streamKey" VARCHAR(255),
      "videoId" INTEGER NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      PRIMARY KEY ("id")
    );
    `

    await utils.sequelize.query(query)
  }

  {
    await utils.queryInterface.addColumn('video', 'isLive', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}

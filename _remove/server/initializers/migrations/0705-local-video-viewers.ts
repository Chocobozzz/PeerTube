import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const { transaction } = utils

  {
    const query = `
    CREATE TABLE IF NOT EXISTS "localVideoViewer" (
      "id" serial,
      "startDate" timestamp with time zone NOT NULL,
      "endDate" timestamp with time zone NOT NULL,
      "watchTime" integer NOT NULL,
      "country" varchar(255),
      "uuid" uuid NOT NULL,
      "url" varchar(255) NOT NULL,
      "videoId" integer NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "createdAt" timestamp with time zone NOT NULL,
      PRIMARY KEY ("id")
    );
    `
    await utils.sequelize.query(query, { transaction })
  }

  {
    const query = `
    CREATE TABLE IF NOT EXISTS "localVideoViewerWatchSection" (
      "id" serial,
      "watchStart" integer NOT NULL,
      "watchEnd" integer NOT NULL,
      "localVideoViewerId" integer NOT NULL REFERENCES "localVideoViewer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "createdAt" timestamp with time zone NOT NULL,
      PRIMARY KEY ("id")
    );
    `
    await utils.sequelize.query(query, { transaction })
  }

}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}

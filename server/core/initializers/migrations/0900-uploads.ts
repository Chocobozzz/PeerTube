import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const query = `CREATE TABLE IF NOT EXISTS "uploadImage"(
  "id" serial,
  "filename" varchar(255) NOT NULL,
  "height" integer DEFAULT NULL,
  "width" integer DEFAULT NULL,
  "fileUrl" varchar(255),
  "type" integer NOT NULL,
  "actorId" integer NOT NULL REFERENCES "actor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" timestamp with time zone NOT NULL,
  "updatedAt" timestamp with time zone NOT NULL,
  PRIMARY KEY ("id")
);`

  await utils.sequelize.query(query, { transaction: utils.transaction })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}

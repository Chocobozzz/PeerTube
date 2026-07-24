import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    const query = `
CREATE TABLE IF NOT EXISTS "userLoginDevice" (
  "id" SERIAL,
  "fingerprint" VARCHAR(255) NOT NULL,
  "userId" INTEGER NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);`

    await utils.sequelize.query(query, { transaction })
  }

  {
    await utils.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "user_login_device_user_id_fingerprint" ON "userLoginDevice" ("userId", "fingerprint")`,
      { transaction }
    )
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}

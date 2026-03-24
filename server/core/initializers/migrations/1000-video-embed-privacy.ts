import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    const query = `
CREATE TABLE IF NOT EXISTS "videoEmbedPrivacyDomain" (
  "id" SERIAL,
  "domain" VARCHAR(255) NOT NULL,
  "videoId" INTEGER NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
)`

    await utils.sequelize.query(query, { transaction })
  }

  {
    await utils.queryInterface.addColumn('video', 'embedPrivacyPolicy', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1 // All allowed
    }, { transaction })

    await utils.queryInterface.changeColumn('video', 'embedPrivacyPolicy', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    }, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}

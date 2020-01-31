import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.STRING(2000),
      allowNull: true
    }

    await utils.queryInterface.addColumn('accountVideoRate', 'url', data)
  }

  {
    const builtUrlQuery = `SELECT "actor"."url" || '/' ||  "accountVideoRate"."type" || 's/' || "videoId" ` +
      'FROM "accountVideoRate" ' +
      'INNER JOIN account ON account.id = "accountVideoRate"."accountId" ' +
      'INNER JOIN actor ON actor.id = account."actorId" ' +
      'WHERE "base".id = "accountVideoRate".id'

    const query = 'UPDATE "accountVideoRate" base SET "url" = (' + builtUrlQuery + ') WHERE "url" IS NULL'
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.STRING(2000),
      allowNull: false,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('accountVideoRate', 'url', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}

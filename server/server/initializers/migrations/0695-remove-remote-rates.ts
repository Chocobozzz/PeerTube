import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const query = 'DELETE FROM "accountVideoRate" ' +
    'WHERE "accountVideoRate".id IN (' +
      'SELECT "accountVideoRate".id FROM "accountVideoRate" ' +
      'INNER JOIN account ON account.id = "accountVideoRate"."accountId" ' +
      'INNER JOIN actor ON actor.id = account."actorId" ' +
      'INNER JOIN video ON video.id = "accountVideoRate"."videoId" ' +
      'WHERE actor."serverId" IS NOT NULL AND video.remote IS TRUE' +
    ')'

  await utils.sequelize.query(query, { type: Sequelize.QueryTypes.BULKDELETE, transaction: utils.transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}

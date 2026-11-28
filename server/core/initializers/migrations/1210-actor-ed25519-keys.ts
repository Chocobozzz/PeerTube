import { generateED25519KeyPairPromise } from '@peertube/peertube-node-utils'
import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  // Ed25519 keys used for FEP-8b32 integrity proofs
  for (const column of [ 'ed25519PublicKey', 'ed25519PrivateKey' ]) {
    await utils.queryInterface.addColumn('actor', column, {
      type: Sequelize.STRING(5000),
      allowNull: true,
      defaultValue: null
    }, { transaction })
  }

  // Key id (verification method) of remote actors
  await utils.queryInterface.addColumn('actor', 'ed25519KeyUrl', {
    type: Sequelize.STRING(2000),
    allowNull: true,
    defaultValue: null
  }, { transaction })

  const rows = await utils.sequelize.query<{ id: number }>(
    'SELECT "id" FROM "actor" WHERE "serverId" IS NULL',
    { type: Sequelize.QueryTypes.SELECT, transaction }
  )

  for (const { id } of rows) {
    const { publicKey, privateKey } = await generateED25519KeyPairPromise()

    await utils.sequelize.query(
      'UPDATE "actor" SET "ed25519PublicKey" = :publicKey, "ed25519PrivateKey" = :privateKey WHERE "id" = :id',
      { replacements: { publicKey, privateKey, id }, transaction }
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

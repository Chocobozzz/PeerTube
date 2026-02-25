import { createPrivateKey } from 'crypto'
import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const rows = await utils.sequelize.query<{ id: number, privateKey: string }>(
    'SELECT "id", "privateKey" FROM "actor" WHERE "serverId" IS NULL',
    { type: Sequelize.QueryTypes.SELECT as Sequelize.QueryTypes.SELECT, transaction: utils.transaction }
  )

  for (const { id, privateKey } of rows) {
    const newPrivateKey = toPKCS8(privateKey)

    await utils.sequelize.query('UPDATE "actor" SET "privateKey" = :newPrivateKey WHERE "id" = :id', {
      replacements: { newPrivateKey, id },
      transaction: utils.transaction
    })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}

// ---------------------------------------------------------------------------

function toPKCS8 (privateKeyPEM: string) {
  const keyObject = createPrivateKey({
    key: privateKeyPEM,
    format: 'pem'
  })

  return keyObject.export({
    type: 'pkcs8',
    format: 'pem'
  }).toString()
}

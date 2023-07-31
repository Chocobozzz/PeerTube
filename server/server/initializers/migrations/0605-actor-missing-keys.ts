import * as Sequelize from 'sequelize'
import { generateRSAKeyPairPromise } from '../../helpers/core-utils.js'
import { PRIVATE_RSA_KEY_SIZE } from '../constants.js'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {

  {
    const query = 'SELECT * FROM "actor" WHERE "serverId" IS NULL AND "publicKey" IS NULL'
    const options = { type: Sequelize.QueryTypes.SELECT as Sequelize.QueryTypes.SELECT }
    const actors = await utils.sequelize.query<any>(query, options)

    for (const actor of actors) {
      const { privateKey, publicKey } = await generateRSAKeyPairPromise(PRIVATE_RSA_KEY_SIZE)

      const queryUpdate = `UPDATE "actor" SET "publicKey" = '${publicKey}', "privateKey" = '${privateKey}' WHERE id = ${actor.id}`
      await utils.sequelize.query(queryUpdate)
    }
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}

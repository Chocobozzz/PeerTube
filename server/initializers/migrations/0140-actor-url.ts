import * as Sequelize from 'sequelize'
import { WEBSERVER } from '../constants'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const toReplace = WEBSERVER.HOSTNAME + ':443'
  const by = WEBSERVER.HOST
  const replacer = column => `replace("${column}", '${toReplace}', '${by}')`

  {
    const query = `UPDATE video SET url = ${replacer('url')}`
    await utils.sequelize.query(query)
  }

  {
    const query = `
      UPDATE actor SET url = ${replacer('url')}, "inboxUrl" = ${replacer('inboxUrl')}, "outboxUrl" = ${replacer('outboxUrl')},
      "sharedInboxUrl" = ${replacer('sharedInboxUrl')}, "followersUrl" = ${replacer('followersUrl')},
      "followingUrl" = ${replacer('followingUrl')}
    `
    await utils.sequelize.query(query)
  }

  {
    const query = `UPDATE server SET host = replace(host, ':443', '')`
    await utils.sequelize.query(query)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}

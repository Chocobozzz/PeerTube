import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const toReplace = ':443'
    const by = ''
    const replacer = column => `replace("${column}", '${toReplace}', '${by}')`

    const query = `
    UPDATE actor SET url = ${replacer('url')}, "inboxUrl" = ${replacer('inboxUrl')}, "outboxUrl" = ${replacer('outboxUrl')},
    "sharedInboxUrl" = ${replacer('sharedInboxUrl')}, "followersUrl" = ${replacer('followersUrl')},
    "followingUrl" = ${replacer('followingUrl')}
  `
    await utils.sequelize.query(query)
  }

  {
    const toReplace = '/account/'
    const by = '/accounts/'
    const replacer = column => `replace("${column}", '${toReplace}', '${by}')`

    const query = `
    UPDATE actor SET url = ${replacer('url')}, "inboxUrl" = ${replacer('inboxUrl')}, "outboxUrl" = ${replacer('outboxUrl')},
    "sharedInboxUrl" = ${replacer('sharedInboxUrl')}, "followersUrl" = ${replacer('followersUrl')},
    "followingUrl" = ${replacer('followingUrl')}
  `
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

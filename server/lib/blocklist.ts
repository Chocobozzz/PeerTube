import { sequelizeTypescript } from '../initializers'
import { AccountBlocklistModel } from '../models/account/account-blocklist'
import { ServerBlocklistModel } from '../models/server/server-blocklist'
import { MAccountBlocklist, MServerBlocklist } from '@server/typings/models'

function addAccountInBlocklist (byAccountId: number, targetAccountId: number) {
  return sequelizeTypescript.transaction(async t => {
    return AccountBlocklistModel.upsert({
      accountId: byAccountId,
      targetAccountId: targetAccountId
    }, { transaction: t })
  })
}

function addServerInBlocklist (byAccountId: number, targetServerId: number) {
  return sequelizeTypescript.transaction(async t => {
    return ServerBlocklistModel.upsert({
      accountId: byAccountId,
      targetServerId
    }, { transaction: t })
  })
}

function removeAccountFromBlocklist (accountBlock: MAccountBlocklist) {
  return sequelizeTypescript.transaction(async t => {
    return accountBlock.destroy({ transaction: t })
  })
}

function removeServerFromBlocklist (serverBlock: MServerBlocklist) {
  return sequelizeTypescript.transaction(async t => {
    return serverBlock.destroy({ transaction: t })
  })
}

export {
  addAccountInBlocklist,
  addServerInBlocklist,
  removeAccountFromBlocklist,
  removeServerFromBlocklist
}

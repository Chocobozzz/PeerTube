import { BlocklistExportJSON } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { AbstractUserImporter } from './abstract-user-importer.js'
import { addAccountInBlocklist, addServerInBlocklist } from '@server/lib/blocklist.js'
import { ServerModel } from '@server/models/server/server.js'
import { AccountModel } from '@server/models/account/account.js'
import { isValidActorHandle } from '@server/helpers/custom-validators/activitypub/actor.js'
import { isHostValid } from '@server/helpers/custom-validators/servers.js'
import { pick } from '@peertube/peertube-core-utils'

const lTags = loggerTagsFactory('user-import')

type ImportObject = { handle: string | null, host: string | null, archiveFiles?: never }

export class BlocklistImporter extends AbstractUserImporter <BlocklistExportJSON, ImportObject, ImportObject> {

  protected getImportObjects (json: BlocklistExportJSON) {
    return [
      ...json.actors.map(o => ({ handle: o.handle, host: null })),
      ...json.instances.map(o => ({ handle: null, host: o.host }))
    ]
  }

  protected sanitize (blocklistImportData: ImportObject) {
    if (!isValidActorHandle(blocklistImportData.handle) && !isHostValid(blocklistImportData.host)) return undefined

    return pick(blocklistImportData, [ 'handle', 'host' ])
  }

  protected async importObject (blocklistImportData: ImportObject) {
    if (blocklistImportData.handle) {
      await this.importAccountBlock(blocklistImportData.handle)
    } else {
      await this.importServerBlock(blocklistImportData.host)
    }

    return { duplicate: false }
  }

  private async importAccountBlock (handle: string) {
    const accountToBlock = await AccountModel.loadByNameWithHost(handle)
    if (!accountToBlock) {
      logger.info('Account %s was not blocked on user import because it cannot be found in the database.', handle, lTags())
      return
    }

    await addAccountInBlocklist({
      byAccountId: this.user.Account.id,
      targetAccountId: accountToBlock.id,
      removeNotificationOfUserId: this.user.id
    })

    logger.info('Account %s blocked on user import.', handle, lTags())
  }

  private async importServerBlock (hostToBlock: string) {
    const serverToBlock = await ServerModel.loadOrCreateByHost(hostToBlock)

    await addServerInBlocklist({
      byAccountId: this.user.Account.id,
      targetServerId: serverToBlock.id,
      removeNotificationOfUserId: this.user.id
    })

    logger.info('Server %s blocked on user import.', hostToBlock, lTags())
  }
}

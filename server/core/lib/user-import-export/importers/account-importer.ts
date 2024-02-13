import { AccountExportJSON, ActorImageType } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { AbstractUserImporter } from './abstract-user-importer.js'
import { updateLocalActorImageFiles } from '@server/lib/local-actor.js'
import { saveInTransactionWithRetries } from '@server/helpers/database-utils.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { MAccountDefault } from '@server/types/models/index.js'
import { isUserDescriptionValid, isUserDisplayNameValid } from '@server/helpers/custom-validators/users.js'
import { pick } from '@peertube/peertube-core-utils'

const lTags = loggerTagsFactory('user-import')

type SanitizedObject = Pick<AccountExportJSON, 'description' | 'displayName' | 'archiveFiles'>

export class AccountImporter extends AbstractUserImporter <AccountExportJSON, AccountExportJSON, SanitizedObject> {

  protected getImportObjects (json: AccountExportJSON) {
    return [ json ]
  }

  protected sanitize (blocklistImportData: AccountExportJSON) {
    if (!isUserDisplayNameValid(blocklistImportData.displayName)) return undefined

    if (!isUserDescriptionValid(blocklistImportData.description)) blocklistImportData.description = null

    return pick(blocklistImportData, [ 'displayName', 'description', 'archiveFiles' ])
  }

  protected async importObject (accountImportData: SanitizedObject) {
    const account = this.user.Account

    account.name = accountImportData.displayName
    account.description = accountImportData.description

    await saveInTransactionWithRetries(account)

    await this.importAvatar(account, accountImportData)

    logger.info('Account %s imported.', account.name, lTags())

    return { duplicate: false }
  }

  private async importAvatar (account: MAccountDefault, accountImportData: SanitizedObject) {
    const avatarPath = this.getSafeArchivePathOrThrow(accountImportData.archiveFiles.avatar)
    if (!avatarPath) return undefined

    if (!await this.isFileValidOrLog(avatarPath, CONSTRAINTS_FIELDS.ACTORS.IMAGE.FILE_SIZE.max)) return undefined

    await updateLocalActorImageFiles({
      accountOrChannel: account,
      imagePhysicalFile: { path: avatarPath },
      type: ActorImageType.AVATAR,
      sendActorUpdate: false
    })
  }
}

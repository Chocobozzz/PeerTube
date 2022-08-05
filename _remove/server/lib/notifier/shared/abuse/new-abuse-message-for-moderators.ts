import { logger } from '@server/helpers/logger'
import { getAbuseTargetUrl } from '@server/lib/activitypub/url'
import { UserModel } from '@server/models/user/user'
import { MUserDefault } from '@server/types/models'
import { UserRight } from '@shared/models'
import { AbstractNewAbuseMessage } from './abstract-new-abuse-message'

export class NewAbuseMessageForModerators extends AbstractNewAbuseMessage {
  private moderators: MUserDefault[]

  async prepare () {
    this.moderators = await UserModel.listWithRight(UserRight.MANAGE_ABUSES)

    // Don't notify my own message
    this.moderators = this.moderators.filter(m => m.Account.id !== this.message.accountId)
    if (this.moderators.length === 0) return

    await this.loadMessageAccount()
  }

  log () {
    logger.info('Notifying moderators of new abuse message on %s.', getAbuseTargetUrl(this.abuse))
  }

  getTargetUsers () {
    return this.moderators
  }

  createEmail (to: string) {
    return this.createEmailFor(to, 'moderator')
  }
}

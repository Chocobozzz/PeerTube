import { logger } from '@server/helpers/logger.js'
import { getAbuseIdentifier } from '@server/lib/activitypub/url.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault } from '@server/types/models/index.js'
import { UserRight } from '@peertube/peertube-models'
import { AbstractNewAbuseMessage } from './abstract-new-abuse-message.js'

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
    logger.info('Notifying moderators of new abuse message on %s.', getAbuseIdentifier(this.abuse))
  }

  getTargetUsers () {
    return this.moderators
  }

  createEmail (to: string) {
    return this.createEmailFor(to, 'moderator')
  }
}

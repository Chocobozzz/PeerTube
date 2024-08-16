import { logger } from '@server/helpers/logger.js'
import { getAbuseIdentifier } from '@server/lib/activitypub/url.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault } from '@server/types/models/index.js'
import { AbstractNewAbuseMessage } from './abstract-new-abuse-message.js'

export class NewAbuseMessageForReporter extends AbstractNewAbuseMessage {
  private reporter: MUserDefault

  async prepare () {
    // Only notify our users
    if (this.abuse.ReporterAccount.isOwned() !== true) return

    await this.loadMessageAccount()

    const reporter = await UserModel.loadByAccountActorId(this.abuse.ReporterAccount.actorId)
    // Don't notify my own message
    if (reporter.Account.id === this.message.accountId) return

    this.reporter = reporter
  }

  log () {
    logger.info('Notifying reporter of new abuse message on %s.', getAbuseIdentifier(this.abuse))
  }

  getTargetUsers () {
    if (!this.reporter) return []

    return [ this.reporter ]
  }

  createEmail (to: string) {
    return this.createEmailFor(to, 'reporter')
  }
}

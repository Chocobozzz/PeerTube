import { logger } from '@server/helpers/logger'
import { getAbuseTargetUrl } from '@server/lib/activitypub/url'
import { UserModel } from '@server/models/user/user'
import { MUserDefault } from '@server/types/models'
import { AbstractNewAbuseMessage } from './abstract-new-abuse-message'

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
    logger.info('Notifying reporter of new abuse message on %s.', getAbuseTargetUrl(this.abuse))
  }

  getTargetUsers () {
    if (!this.reporter) return []

    return [ this.reporter ]
  }

  createEmail (to: string) {
    return this.createEmailFor(to, 'reporter')
  }
}

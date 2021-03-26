
import { doJSONRequest } from '@server/helpers/requests'
import { ApplicationModel } from '@server/models/application/application'
import { compareSemVer } from '@shared/core-utils'
import { JoinPeerTubeVersions } from '@shared/models'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers/config'
import { PEERTUBE_VERSION, SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { Notifier } from '../notifier'
import { AbstractScheduler } from './abstract-scheduler'

export class PeerTubeVersionCheckScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.checkPeerTubeVersion

  private constructor () {
    super()
  }

  protected async internalExecute () {
    return this.checkLatestVersion()
  }

  private async checkLatestVersion () {
    if (CONFIG.PEERTUBE.CHECK_LATEST_VERSION.ENABLED === false) return

    logger.info('Checking latest PeerTube version.')

    const { body } = await doJSONRequest<JoinPeerTubeVersions>(CONFIG.PEERTUBE.CHECK_LATEST_VERSION.URL)

    if (!body?.peertube?.latestVersion) {
      logger.warn('Cannot check latest PeerTube version: body is invalid.', { body })
      return
    }

    const latestVersion = body.peertube.latestVersion
    const application = await ApplicationModel.load()

    // Already checked this version
    if (application.latestPeerTubeVersion === latestVersion) return

    if (compareSemVer(PEERTUBE_VERSION, latestVersion) < 0) {
      application.latestPeerTubeVersion = latestVersion
      await application.save()

      Notifier.Instance.notifyOfNewPeerTubeVersion(application, latestVersion)
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

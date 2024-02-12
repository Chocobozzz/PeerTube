import { FollowingExportJSON } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { AbstractUserImporter } from './abstract-user-importer.js'
import { JobQueue } from '@server/lib/job-queue/job-queue.js'
import { isValidActorHandle } from '@server/helpers/custom-validators/activitypub/actor.js'

const lTags = loggerTagsFactory('user-import')

export class FollowingImporter extends AbstractUserImporter <FollowingExportJSON, FollowingExportJSON['following'][0]> {

  protected getImportObjects (json: FollowingExportJSON) {
    return json.following
  }

  protected sanitize (followingImportData: FollowingExportJSON['following'][0]) {
    if (!isValidActorHandle(followingImportData.targetHandle)) return undefined

    return followingImportData
  }

  protected async importObject (followingImportData: FollowingExportJSON['following'][0]) {
    const [ name, host ] = followingImportData.targetHandle.split('@')

    const payload = {
      name,
      host,
      assertIsChannel: true,
      followerActorId: this.user.Account.Actor.id
    }

    await JobQueue.Instance.createJob({ type: 'activitypub-follow', payload })

    logger.info('Subscription job of %s created on user import.', followingImportData.targetHandle, lTags())

    return { duplicate: false }
  }
}

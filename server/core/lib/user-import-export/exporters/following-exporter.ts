import { ActivityPubOrderedCollection, FollowingExportJSON } from '@peertube/peertube-models'
import { activityPubContextify } from '@server/helpers/activity-pub-utils.js'
import { activityPubCollection } from '@server/lib/activitypub/collection.js'
import { getContextFilter } from '@server/lib/activitypub/context.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { AbstractUserExporter } from './abstract-user-exporter.js'

export class FollowingExporter extends AbstractUserExporter<FollowingExportJSON> {
  async export () {
    const following = await ActorFollowModel.listAcceptedFollowingForExport(this.user.Account.Actor.id)
    const followingJSON = this.formatFollowingJSON(following, this.user.Account.Actor.getFullIdentifier())

    return {
      json: { following: followingJSON } as FollowingExportJSON,

      staticFiles: [],

      activityPub: await this.formatFollowingAP(following)
    }
  }

  getActivityPubFilename () {
    return this.activityPubFilenames.following
  }

  private formatFollowingJSON (
    follows: {
      createdAt: Date
      followingHandle: string
    }[],
    handle: string
  ): FollowingExportJSON['following'] {
    return follows.map(f => ({
      handle,
      targetHandle: f.followingHandle,
      createdAt: f.createdAt.toISOString()
    }))
  }

  private formatFollowingAP (follows: { followingUrl: string }[]): Promise<ActivityPubOrderedCollection<string>> {
    return activityPubContextify(
      activityPubCollection(this.getActivityPubFilename(), follows.map(f => f.followingUrl)),
      'Collection',
      getContextFilter()
    )
  }
}

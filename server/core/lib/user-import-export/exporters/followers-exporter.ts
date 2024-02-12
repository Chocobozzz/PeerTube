import { AbstractUserExporter } from './abstract-user-exporter.js'
import { FollowersExportJSON } from '@peertube/peertube-models'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'

export class FollowersExporter extends AbstractUserExporter <FollowersExportJSON> {

  async export () {
    let followersJSON = this.formatFollowersJSON(
      await ActorFollowModel.listAcceptedFollowersForExport(this.user.Account.actorId),
      this.user.Account.Actor.getFullIdentifier()
    )

    const channels = await VideoChannelModel.listAllByAccount(this.user.Account.id)

    for (const channel of channels) {
      followersJSON = followersJSON.concat(
        this.formatFollowersJSON(
          await ActorFollowModel.listAcceptedFollowersForExport(channel.Actor.id),
          channel.Actor.getFullIdentifier()
        )
      )
    }

    return {
      json: { followers: followersJSON } as FollowersExportJSON,

      staticFiles: []
    }
  }

  private formatFollowersJSON (
    follows: {
      createdAt: Date
      followerHandle: string
    }[],
    targetHandle: string
  ): FollowersExportJSON['followers'] {
    return follows.map(f => ({
      targetHandle,
      handle: f.followerHandle,
      createdAt: f.createdAt.toISOString()
    }))
  }
}

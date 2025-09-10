import { CommentsExportJSON, VideoCommentObject } from '@peertube/peertube-models'
import { audiencify, getPublicAudience } from '@server/lib/activitypub/audience.js'
import { buildCreateActivity } from '@server/lib/activitypub/send/send-create.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { MCommentExport } from '@server/types/models/index.js'
import Bluebird from 'bluebird'
import { AbstractUserExporter } from './abstract-user-exporter.js'

export class CommentsExporter extends AbstractUserExporter<CommentsExportJSON> {
  async export () {
    const comments = await VideoCommentModel.listForExport(this.user.Account.id)

    return {
      json: {
        comments: this.formatCommentsJSON(comments)
      },

      activityPubOutbox: await this.formatCommentsAP(comments),

      staticFiles: []
    }
  }

  private formatCommentsJSON (comments: MCommentExport[]) {
    return comments.map(c => ({
      url: c.url,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      videoUrl: c.Video.url,
      inReplyToCommentUrl: c?.InReplyToVideoComment?.url
    }))
  }

  private formatCommentsAP (comments: MCommentExport[]) {
    return Bluebird.mapSeries(comments, async ({ url }) => {
      const comment = await VideoCommentModel.loadByUrlAndPopulateReplyAndVideoImmutableAndAccount(url)

      const threadParentComments = await VideoCommentModel.listThreadParentComments({ comment })
      let commentObject = comment.toActivityPubObject(threadParentComments) as VideoCommentObject

      const audience = getPublicAudience(comment.Account.Actor)

      commentObject = audiencify(commentObject, audience)

      return buildCreateActivity(comment.url, comment.Account.Actor, commentObject, audience)
    })
  }
}

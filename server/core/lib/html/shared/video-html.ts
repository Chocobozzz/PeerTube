import { escapeHTML } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import { toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { Memoize } from '@server/helpers/memoize.js'
import express from 'express'
import validator from 'validator'
import { CONFIG } from '../../../initializers/config.js'
import { MEMOIZE_TTL, WEBSERVER } from '../../../initializers/constants.js'
import { VideoModel } from '../../../models/video/video.js'
import { MVideo, MVideoThumbnailBlacklist } from '../../../types/models/index.js'
import { getActivityStreamDuration } from '../../activitypub/activity.js'
import { isVideoInPrivateDirectory } from '../../video-privacy.js'
import { CommonEmbedHtml } from './common-embed-html.js'
import { PageHtml } from './page-html.js'
import { TagsHtml } from './tags-html.js'

export class VideoHtml {

  static async getWatchVideoHTML (videoIdArg: string, req: express.Request, res: express.Response) {
    const videoId = toCompleteUUID(videoIdArg)

    // Let Angular application handle errors
    if (!validator.default.isInt(videoId) && !validator.default.isUUID(videoId, 4)) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return PageHtml.getIndexHTML(req, res)
    }

    const [ html, video ] = await Promise.all([
      PageHtml.getIndexHTML(req, res),
      VideoModel.loadWithBlacklist(videoId)
    ])

    // Let Angular application handle errors
    if (!video || isVideoInPrivateDirectory(video.privacy) || video.VideoBlacklist) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return html
    }

    return this.buildVideoHTML({
      html,
      video,
      addEmbedInfo: true,
      addOG: true,
      addTwitterCard: true
    })
  }

  @Memoize({ maxAge: MEMOIZE_TTL.EMBED_HTML })
  static async getEmbedVideoHTML (videoIdArg: string) {
    const videoId = toCompleteUUID(videoIdArg)

    const videoPromise: Promise<MVideoThumbnailBlacklist> = validator.default.isInt(videoId) || validator.default.isUUID(videoId, 4)
      ? VideoModel.loadWithBlacklist(videoId)
      : Promise.resolve(undefined)

    const [ html, video ] = await Promise.all([ PageHtml.getEmbedHTML(), videoPromise ])

    if (!video || isVideoInPrivateDirectory(video.privacy) || video.VideoBlacklist) {
      return CommonEmbedHtml.buildEmptyEmbedHTML({ html, video })
    }

    return this.buildVideoHTML({
      html,
      video,
      addEmbedInfo: true,
      addOG: false,
      addTwitterCard: false
    })
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private static buildVideoHTML (options: {
    html: string
    video: MVideo

    addOG: boolean
    addTwitterCard: boolean
    addEmbedInfo: boolean
  }) {
    const { html, video, addEmbedInfo, addOG, addTwitterCard } = options
    const escapedTruncatedDescription = TagsHtml.buildEscapedTruncatedDescription(video.description)

    let customHTML = TagsHtml.addTitleTag(html, video.name)
    customHTML = TagsHtml.addDescriptionTag(customHTML, escapedTruncatedDescription)

    const embed = addEmbedInfo
      ? {
        url: WEBSERVER.URL + video.getEmbedStaticPath(),
        createdAt: video.createdAt.toISOString(),
        duration: getActivityStreamDuration(video.duration),
        views: video.views
      }
      : undefined

    const ogType = addOG
      ? 'video' as 'video'
      : undefined

    const twitterCard = addTwitterCard
      ? 'player'
      : undefined

    const schemaType = 'VideoObject'

    return TagsHtml.addTags(customHTML, {
      url: WEBSERVER.URL + video.getWatchStaticPath(),
      escapedSiteName: escapeHTML(CONFIG.INSTANCE.NAME),
      escapedTitle: escapeHTML(video.name),
      escapedTruncatedDescription,

      indexationPolicy: video.remote || video.privacy !== VideoPrivacy.PUBLIC
        ? 'never'
        : 'always',

      image: { url: WEBSERVER.URL + video.getPreviewStaticPath() },

      embed,
      ogType,
      twitterCard,
      schemaType
    }, { video })
  }
}

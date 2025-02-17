import { addQueryParams, escapeHTML, getVideoWatchRSSFeeds } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import { toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { Memoize } from '@server/helpers/memoize.js'
import express from 'express'
import validator from 'validator'
import { CONFIG } from '../../../initializers/config.js'
import { MEMOIZE_TTL, WEBSERVER } from '../../../initializers/constants.js'
import { VideoModel } from '../../../models/video/video.js'
import { MVideo, MVideoThumbnail, MVideoThumbnailBlacklist } from '../../../types/models/index.js'
import { getActivityStreamDuration } from '../../activitypub/activity.js'
import { isVideoInPrivateDirectory } from '../../video-privacy.js'
import { buildEmptyEmbedHTML } from './common.js'
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
      currentQuery: req.query,
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
      return buildEmptyEmbedHTML({ html, video })
    }

    return this.buildVideoHTML({
      html,
      video,
      addEmbedInfo: true,
      addOG: false,
      addTwitterCard: false,

      // TODO: Implement it so we can send query params to oembed service
      currentQuery: {}
    })
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private static buildVideoHTML (options: {
    html: string
    video: MVideoThumbnail

    addOG: boolean
    addTwitterCard: boolean
    addEmbedInfo: boolean

    currentQuery: Record<string, string>
  }) {
    const { html, video, addEmbedInfo, addOG, addTwitterCard, currentQuery = {} } = options
    const escapedTruncatedDescription = TagsHtml.buildEscapedTruncatedDescription(video.description)

    let customHTML = TagsHtml.addTitleTag(html, video.name)
    customHTML = TagsHtml.addDescriptionTag(customHTML, escapedTruncatedDescription)

    const embed = addEmbedInfo
      ? {
        url: WEBSERVER.URL + video.getEmbedStaticPath(),
        createdAt: video.createdAt.toISOString(),
        duration: video.duration ? getActivityStreamDuration(video.duration) : undefined,
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

    const preview = video.getPreview()

    return TagsHtml.addTags(customHTML, {
      url: WEBSERVER.URL + video.getWatchStaticPath(),

      escapedSiteName: escapeHTML(CONFIG.INSTANCE.NAME),
      escapedTitle: escapeHTML(video.name),
      escapedTruncatedDescription,

      forbidIndexation: video.remote || video.privacy !== VideoPrivacy.PUBLIC,

      image: preview
        ? { url: WEBSERVER.URL + video.getPreviewStaticPath(), width: preview.width, height: preview.height }
        : undefined,

      embed,
      oembedUrl: this.getOEmbedUrl(video, currentQuery),

      ogType,
      twitterCard,
      schemaType,

      rssFeeds: getVideoWatchRSSFeeds(WEBSERVER.URL, CONFIG.INSTANCE.NAME, video)
    }, { video })
  }

  private static getOEmbedUrl (video: MVideo, currentQuery: Record<string, string>) {
    const base = WEBSERVER.URL + video.getWatchStaticPath()

    const additionalQuery: Record<string, string> = {}
    const allowedParams = new Set([ 'start' ])

    for (const [ key, value ] of Object.entries(currentQuery)) {
      if (allowedParams.has(key)) additionalQuery[key] = value
    }

    return addQueryParams(base, additionalQuery)
  }
}

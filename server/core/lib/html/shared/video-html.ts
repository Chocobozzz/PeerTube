import { addQueryParams, escapeHTML } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import { Memoize } from '@server/helpers/memoize.js'
import { getVideoRSSFeeds } from '@server/lib/rss.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import express from 'express'
import validator from 'validator'
import { CONFIG } from '../../../initializers/config.js'
import { MEMOIZE_TTL, WEBSERVER } from '../../../initializers/constants.js'
import { VideoModel } from '../../../models/video/video.js'
import { MVideo, MVideoSeo } from '../../../types/models/index.js'
import { isVideoInPrivateDirectory } from '../../video-privacy.js'
import { buildEmptyEmbedHTML } from './common.js'
import { PageHtml } from './page-html.js'
import { TagsHtml } from './tags-html.js'

export class VideoHtml {
  static async getWatchVideoHTML (videoId: string, req: express.Request, res: express.Response) {
    // Let Angular application handle errors
    if (!validator.default.isInt(videoId) && !validator.default.isUUID(videoId, 4)) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return PageHtml.getIndexHTML(req, res)
    }

    const [ html, video ] = await Promise.all([
      PageHtml.getIndexHTML(req, res),
      VideoModel.loadForSEO(videoId)
    ])

    if (video?.privacy === VideoPrivacy.PASSWORD_PROTECTED) {
      return html
    }

    // Let Angular application handle errors
    if (!video || isVideoInPrivateDirectory(video.privacy) || video.VideoBlacklist) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return html
    }

    return this.buildVideoHTML({
      req,

      html,
      video,
      currentQuery: req.query,
      addOG: true,
      addTwitterCard: true,
      isEmbed: false
    })
  }

  @Memoize({ maxAge: MEMOIZE_TTL.EMBED_HTML })
  static async getEmbedVideoHTML (videoId: string) {
    const videoPromise: Promise<MVideoSeo> = validator.default.isInt(videoId) || validator.default.isUUID(videoId, 4)
      ? VideoModel.loadForSEO(videoId)
      : Promise.resolve(undefined)

    const [ html, video ] = await Promise.all([ PageHtml.getEmbedHTML(), videoPromise ])

    if (!video || isVideoInPrivateDirectory(video.privacy) || video.VideoBlacklist) {
      return buildEmptyEmbedHTML({ html, video })
    }

    return this.buildVideoHTML({
      req: null,

      html,
      video,
      addOG: false,
      addTwitterCard: false,
      isEmbed: true,

      // TODO: Implement it so we can send query params to oembed service
      currentQuery: {}
    })
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private static buildVideoHTML (options: {
    req: express.Request

    html: string
    video: MVideoSeo

    addOG: boolean
    addTwitterCard: boolean

    isEmbed: boolean

    currentQuery: Record<string, string>
  }) {
    const { req, html, video, addOG, addTwitterCard, isEmbed, currentQuery = {} } = options
    const escapedTruncatedDescription = TagsHtml.buildEscapedTruncatedDescription(video.description)

    let customHTML = TagsHtml.addTitleTag(html, video.name)
    customHTML = TagsHtml.addDescriptionTag(customHTML, escapedTruncatedDescription)

    const preview = video.getPreview()

    return TagsHtml.addTags(customHTML, {
      url: WEBSERVER.URL + video.getWatchStaticPath(),

      escapedSiteName: escapeHTML(CONFIG.INSTANCE.NAME),
      escapedTitle: escapeHTML(video.name),
      escapedTruncatedDescription,

      forbidIndexation: isEmbed
        ? video.privacy !== VideoPrivacy.PUBLIC && video.privacy !== VideoPrivacy.UNLISTED
        : video.remote || video.privacy !== VideoPrivacy.PUBLIC,

      embedIndexation: isEmbed,

      image: preview
        ? { url: WEBSERVER.URL + video.getPreviewStaticPath(), width: preview.width, height: preview.height }
        : undefined,

      videoOrPlaylist: {
        embedUrl: WEBSERVER.URL + video.getEmbedStaticPath(),
        oembedUrl: this.getOEmbedUrl(video, currentQuery),

        channel: {
          displayName: video.VideoChannel.name,
          url: video.VideoChannel.getClientUrl(false)
        },

        createdAt: video.createdAt.toISOString(),
        updatedAt: video.updatedAt.toISOString()
      },

      video: {
        publishedAt: video.publishedAt.toISOString(),
        duration: video.duration,
        views: video.views,
        language: video.language,
        dislikes: video.dislikes,
        likes: video.likes,
        nsfw: video.nsfw,
        tags: video.Tags.map(t => t.name),
        captions: video.VideoCaptions.map(c => ({
          label: VideoCaptionModel.getLanguageLabel(c.language),
          mediaType: 'text/vtt',
          language: c.language,
          url: c.getFileUrl(video)
        }))
      },

      ogType: addOG
        ? 'video' as 'video'
        : undefined,

      twitterCard: addTwitterCard
        ? 'player'
        : undefined,

      schemaType: 'VideoObject',

      rssFeeds: req
        ? getVideoRSSFeeds(video, req)
        : []
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

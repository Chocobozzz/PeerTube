import { addQueryParams, escapeHTML } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoPlaylistPrivacy } from '@peertube/peertube-models'
import { Memoize } from '@server/helpers/memoize.js'
import { getDefaultRSSFeeds } from '@server/lib/rss.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { MVideoPlaylist, MVideoPlaylistFull } from '@server/types/models/index.js'
import express from 'express'
import validator from 'validator'
import { CONFIG } from '../../../initializers/config.js'
import { MEMOIZE_TTL, WEBSERVER } from '../../../initializers/constants.js'
import { buildEmptyEmbedHTML } from './common.js'
import { PageHtml } from './page-html.js'
import { TagsHtml } from './tags-html.js'

export class PlaylistHtml {
  static async getWatchPlaylistHTML (videoPlaylistId: string, req: express.Request, res: express.Response) {
    // Let Angular application handle errors
    if (!validator.default.isInt(videoPlaylistId) && !validator.default.isUUID(videoPlaylistId, 4)) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return PageHtml.getIndexHTML(req, res)
    }

    const [ html, videoPlaylist ] = await Promise.all([
      PageHtml.getIndexHTML(req, res),
      VideoPlaylistModel.loadWithAccountAndChannel(videoPlaylistId, null)
    ])

    // Let Angular application handle errors
    if (!videoPlaylist || videoPlaylist.privacy === VideoPlaylistPrivacy.PRIVATE) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return html
    }

    return this.buildPlaylistHTML({
      req,
      html,
      playlist: videoPlaylist,
      addEmbedInfo: true,
      addOG: true,
      addTwitterCard: true,
      isEmbed: false,

      currentQuery: req.query
    })
  }

  @Memoize({ maxAge: MEMOIZE_TTL.EMBED_HTML })
  static async getEmbedPlaylistHTML (playlistId: string) {
    const playlistPromise: Promise<MVideoPlaylistFull> = validator.default.isInt(playlistId) || validator.default.isUUID(playlistId, 4)
      ? VideoPlaylistModel.loadWithAccountAndChannel(playlistId, null)
      : Promise.resolve(undefined)

    const [ html, playlist ] = await Promise.all([ PageHtml.getEmbedHTML(), playlistPromise ])

    if (!playlist || playlist.privacy === VideoPlaylistPrivacy.PRIVATE) {
      return buildEmptyEmbedHTML({ html, playlist })
    }

    return this.buildPlaylistHTML({
      req: null,

      html,
      playlist,
      addEmbedInfo: true,
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

  private static buildPlaylistHTML (options: {
    req: express.Request

    html: string
    playlist: MVideoPlaylistFull

    addOG: boolean
    addTwitterCard: boolean
    addEmbedInfo: boolean

    isEmbed: boolean

    currentQuery: Record<string, string>
  }) {
    const { req, html, playlist, addEmbedInfo, addOG, addTwitterCard, isEmbed, currentQuery = {} } = options
    const escapedTruncatedDescription = TagsHtml.buildEscapedTruncatedDescription(playlist.description)

    let htmlResult = TagsHtml.addTitleTag(html, playlist.name)
    htmlResult = TagsHtml.addDescriptionTag(htmlResult, escapedTruncatedDescription)

    const list = { numberOfItems: playlist.get('videosLength') as number }
    const schemaType = 'ItemList'

    const twitterCard = addTwitterCard
      ? 'player'
      : undefined

    const ogType = addOG
      ? 'video' as 'video'
      : undefined

    const embed = addEmbedInfo
      ? { url: WEBSERVER.URL + playlist.getEmbedStaticPath(), createdAt: playlist.createdAt.toISOString() }
      : undefined

    return TagsHtml.addTags(htmlResult, {
      url: WEBSERVER.URL + playlist.getWatchStaticPath(),

      escapedSiteName: escapeHTML(CONFIG.INSTANCE.NAME),
      escapedTitle: escapeHTML(playlist.name),
      escapedTruncatedDescription,

      forbidIndexation: isEmbed
        ? playlist.privacy !== VideoPlaylistPrivacy.PUBLIC && playlist.privacy !== VideoPlaylistPrivacy.UNLISTED
        : !playlist.isLocal() || playlist.privacy !== VideoPlaylistPrivacy.PUBLIC,

      embedIndexation: isEmbed,

      image: playlist.hasThumbnail()
        ? { url: playlist.getThumbnailUrl(), width: playlist.Thumbnail.width, height: playlist.Thumbnail.height }
        : undefined,

      list,

      schemaType,
      ogType,
      twitterCard,

      embed,
      oembedUrl: this.getOEmbedUrl(playlist, currentQuery),

      rssFeeds: req
        ? getDefaultRSSFeeds(req)
        : []
    }, { playlist })
  }

  private static getOEmbedUrl (playlist: MVideoPlaylist, currentQuery: Record<string, string>) {
    const base = WEBSERVER.URL + playlist.getWatchStaticPath()

    const additionalQuery: Record<string, string> = {}
    const allowedParams = new Set([ 'playlistPosition' ])

    for (const [ key, value ] of Object.entries(currentQuery)) {
      if (allowedParams.has(key)) additionalQuery[key] = value
    }

    return addQueryParams(base, additionalQuery)
  }
}

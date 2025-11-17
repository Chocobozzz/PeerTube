import { escapeHTML, getChannelRSSFeeds, getDefaultRSSFeed, maxBy } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { WEBSERVER } from '@server/initializers/constants.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MAccountDefault, MChannelDefault } from '@server/types/models/index.js'
import express from 'express'
import { CONFIG } from '../../../initializers/config.js'
import { PageHtml } from './page-html.js'
import { TagsHtml, TagsOptions } from './tags-html.js'

export class ActorHtml {
  static async getAccountHTMLPage (handle: string, req: express.Request, res: express.Response) {
    const accountModelPromise = AccountModel.loadByHandle(handle)

    return this.getAccountOrChannelHTMLPage({
      loader: () => accountModelPromise,
      getRSSFeeds: () => this.getDefaultRSSFeeds(req),
      req,
      res
    })
  }

  static async getVideoChannelHTMLPage (handle: string, req: express.Request, res: express.Response) {
    const videoChannel = await VideoChannelModel.loadByHandleAndPopulateAccount(handle)

    return this.getAccountOrChannelHTMLPage({
      loader: () => Promise.resolve(videoChannel),
      getRSSFeeds: () => this.getChannelRSSFeeds(videoChannel, req),
      req,
      res
    })
  }

  static async getActorHTMLPage (handle: string, req: express.Request, res: express.Response) {
    const [ account, channel ] = await Promise.all([
      AccountModel.loadByHandle(handle),
      VideoChannelModel.loadByHandleAndPopulateAccount(handle)
    ])

    return this.getAccountOrChannelHTMLPage({
      loader: () => Promise.resolve(account || channel),

      getRSSFeeds: () =>
        account
          ? this.getDefaultRSSFeeds(req)
          : this.getChannelRSSFeeds(channel, req),

      req,
      res
    })
  }

  // ---------------------------------------------------------------------------

  private static async getAccountOrChannelHTMLPage (options: {
    loader: () => Promise<MAccountDefault | MChannelDefault>
    getRSSFeeds: (entity: MAccountDefault | MChannelDefault) => TagsOptions['rssFeeds']
    req: express.Request
    res: express.Response
  }) {
    const { loader, getRSSFeeds, req, res } = options

    const [ html, entity ] = await Promise.all([
      PageHtml.getIndexHTML(req, res),
      loader()
    ])

    // Let Angular application handle errors
    if (!entity) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return PageHtml.getIndexHTML(req, res)
    }

    const escapedTruncatedDescription = TagsHtml.buildEscapedTruncatedDescription(entity.description)

    let customHTML = TagsHtml.addTitleTag(html, entity.getDisplayName())
    customHTML = TagsHtml.addDescriptionTag(customHTML, escapedTruncatedDescription)

    const url = entity.getClientUrl()
    const siteName = CONFIG.INSTANCE.NAME
    const title = entity.getDisplayName()

    const avatar = maxBy(entity.Actor.Avatars, 'width')
    const image = {
      url: ActorImageModel.getImageUrl(avatar),
      width: avatar?.width,
      height: avatar?.height
    }

    const ogType = 'website'
    const twitterCard = 'summary'
    const schemaType = 'ProfilePage'

    customHTML = await TagsHtml.addTags(customHTML, {
      url,
      escapedTitle: escapeHTML(title),
      escapedSiteName: escapeHTML(siteName),
      escapedTruncatedDescription,
      relMe: TagsHtml.findRelMe(entity.description),
      image,
      ogType,
      twitterCard,
      schemaType,
      jsonldProfile: {
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      },

      forbidIndexation: !entity.Actor.isLocal(),
      embedIndexation: false,

      rssFeeds: getRSSFeeds(entity)
    }, {})

    return customHTML
  }

  private static getDefaultRSSFeeds (req: express.Request) {
    return [
      getDefaultRSSFeed({
        url: WEBSERVER.URL,
        title: req.t('{instanceName} videos feed', { instanceName: CONFIG.INSTANCE.NAME })
      })
    ]
  }

  private static getChannelRSSFeeds (channel: MChannelDefault, req: express.Request) {
    return getChannelRSSFeeds({
      url: WEBSERVER.URL,
      channel,
      titles: {
        videosFeed: req.t('{instanceName} videos feed', { instanceName: CONFIG.INSTANCE.NAME }),
        channelVideosFeed: req.t('{name} videos feed', { name: channel.getDisplayName() }),
        channelPodcastFeed: req.t('{name} podcast feed', { name: channel.getDisplayName() })
      }
    })
  }
}

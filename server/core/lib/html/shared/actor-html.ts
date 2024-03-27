import { escapeHTML, maxBy } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { AccountModel } from '@server/models/account/account.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MAccountHost, MChannelHost } from '@server/types/models/index.js'
import express from 'express'
import { CONFIG } from '../../../initializers/config.js'
import { PageHtml } from './page-html.js'
import { TagsHtml } from './tags-html.js'

export class ActorHtml {

  static async getAccountHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    const accountModelPromise = AccountModel.loadByNameWithHost(nameWithHost)

    return this.getAccountOrChannelHTMLPage(() => accountModelPromise, req, res)
  }

  static async getVideoChannelHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    const videoChannelModelPromise = VideoChannelModel.loadByNameWithHostAndPopulateAccount(nameWithHost)

    return this.getAccountOrChannelHTMLPage(() => videoChannelModelPromise, req, res)
  }

  static async getActorHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    const [ account, channel ] = await Promise.all([
      AccountModel.loadByNameWithHost(nameWithHost),
      VideoChannelModel.loadByNameWithHostAndPopulateAccount(nameWithHost)
    ])

    return this.getAccountOrChannelHTMLPage(() => Promise.resolve(account || channel), req, res)
  }

  // ---------------------------------------------------------------------------

  private static async getAccountOrChannelHTMLPage (
    loader: () => Promise<MAccountHost | MChannelHost>,
    req: express.Request,
    res: express.Response
  ) {
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
      image,
      ogType,
      twitterCard,
      schemaType,
      jsonldProfile: {
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      },

      indexationPolicy: entity.Actor.isOwned()
        ? 'always'
        : 'never'
    }, {})

    return customHTML
  }
}

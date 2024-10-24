import { escapeHTML } from '@peertube/peertube-core-utils'
import express from 'express'
import { CONFIG } from '../../../initializers/config.js'
import { WEBSERVER } from '../../../initializers/constants.js'
import { PageHtml } from './page-html.js'
import { TagsHtml } from './tags-html.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { getServerActor } from '@server/models/application/application.js'
import { ActorImageType } from '@peertube/peertube-models'

export type VideosOrderType = 'local' | 'trending' | 'overview' | 'recently-added'

export class VideosHtml {

  static async getVideosHTML (type: VideosOrderType, req: express.Request, res: express.Response) {
    const html = await PageHtml.getIndexHTML(req, res)

    return this.buildVideosHTML({
      html,
      type,
      currentPage: req.query.page
    })
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private static async buildVideosHTML (options: {
    html: string
    type: VideosOrderType
    currentPage: string
  }) {
    const { html, currentPage, type } = options
    const serverActor = await getServerActor()
    const avatar = serverActor.getMaxQualityImage(ActorImageType.AVATAR)

    const title = type === 'recently-added' ? 'Recently added' : type.slice(0, 1).toUpperCase() + type.slice(1)
    let customHTML = TagsHtml.addTitleTag(html, title)
    customHTML = TagsHtml.addDescriptionTag(customHTML)

    let url = WEBSERVER.URL + '/videos/' + type

    if (currentPage) {
      url += `?page=${currentPage}`
    }

    return TagsHtml.addTags(customHTML, {
      url,

      escapedSiteName: escapeHTML(CONFIG.INSTANCE.NAME),
      escapedTitle: `${title} - ${escapeHTML(CONFIG.INSTANCE.NAME)}`,
      escapedTruncatedDescription: escapeHTML(CONFIG.INSTANCE.SHORT_DESCRIPTION),

      image: avatar
        ? { url: ActorImageModel.getImageUrl(avatar), width: avatar.width, height: avatar.height }
        : undefined,

      ogType: 'website',
      twitterCard: 'summary_large_image',

      forbidIndexation: false
    }, {})
  }
}

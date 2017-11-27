import * as express from 'express'

import { CONFIG, EMBED_SIZE, PREVIEWS_SIZE } from '../initializers'
import { oembedValidator } from '../middlewares'
import { asyncMiddleware } from '../middlewares/async'
import { VideoInstance } from '../models'

const servicesRouter = express.Router()

servicesRouter.use('/oembed',
  asyncMiddleware(oembedValidator),
  generateOEmbed
)

// ---------------------------------------------------------------------------

export {
  servicesRouter
}

// ---------------------------------------------------------------------------

function generateOEmbed (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video = res.locals.video as VideoInstance
  const webserverUrl = CONFIG.WEBSERVER.URL
  const maxHeight = parseInt(req.query.maxheight, 10)
  const maxWidth = parseInt(req.query.maxwidth, 10)

  const embedUrl = webserverUrl + video.getEmbedPath()
  let thumbnailUrl = webserverUrl + video.getPreviewPath()
  let embedWidth = EMBED_SIZE.width
  let embedHeight = EMBED_SIZE.height

  if (maxHeight < embedHeight) embedHeight = maxHeight
  if (maxWidth < embedWidth) embedWidth = maxWidth

  // Our thumbnail is too big for the consumer
  if (
    (maxHeight !== undefined && maxHeight < PREVIEWS_SIZE.height) ||
    (maxWidth !== undefined && maxWidth < PREVIEWS_SIZE.width)
  ) {
    thumbnailUrl = undefined
  }

  const html = `<iframe width="${embedWidth}" height="${embedHeight}" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`

  const json: any = {
    type: 'video',
    version: '1.0',
    html,
    width: embedWidth,
    height: embedHeight,
    title: video.name,
    author_name: video.VideoChannel.Account.name,
    provider_name: 'PeerTube',
    provider_url: webserverUrl
  }

  if (thumbnailUrl !== undefined) {
    json.thumbnail_url = thumbnailUrl
    json.thumbnail_width = PREVIEWS_SIZE.width
    json.thumbnail_height = PREVIEWS_SIZE.height
  }

  return res.json(json)
}

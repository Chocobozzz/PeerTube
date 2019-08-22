import * as express from 'express'
import { EMBED_SIZE, PREVIEWS_SIZE, WEBSERVER } from '../initializers/constants'
import { asyncMiddleware, oembedValidator } from '../middlewares'
import { accountNameWithHostGetValidator } from '../middlewares/validators'

const servicesRouter = express.Router()

servicesRouter.use('/oembed',
  asyncMiddleware(oembedValidator),
  generateOEmbed
)
servicesRouter.use('/redirect/accounts/:accountName',
  asyncMiddleware(accountNameWithHostGetValidator),
  redirectToAccountUrl
)

// ---------------------------------------------------------------------------

export {
  servicesRouter
}

// ---------------------------------------------------------------------------

function generateOEmbed (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const webserverUrl = WEBSERVER.URL
  const maxHeight = parseInt(req.query.maxheight, 10)
  const maxWidth = parseInt(req.query.maxwidth, 10)

  const embedUrl = webserverUrl + video.getEmbedStaticPath()
  let thumbnailUrl = webserverUrl + video.getPreviewStaticPath()
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

  const html = `<iframe width="${embedWidth}" height="${embedHeight}" sandbox="allow-same-origin allow-scripts" ` +
    `src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`

  const json: any = {
    type: 'video',
    version: '1.0',
    html,
    width: embedWidth,
    height: embedHeight,
    title: video.name,
    author_name: video.VideoChannel.Account.name,
    author_url: video.VideoChannel.Account.Actor.url,
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

function redirectToAccountUrl (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.redirect(res.locals.account.Actor.url)
}

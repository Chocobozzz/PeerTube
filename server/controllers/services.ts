import * as express from 'express'
import { EMBED_SIZE, PREVIEWS_SIZE, WEBSERVER, THUMBNAILS_SIZE } from '../initializers/constants'
import { asyncMiddleware, oembedValidator } from '../middlewares'
import { accountNameWithHostGetValidator } from '../middlewares/validators'
import { MChannelSummary } from '@server/types/models'

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
  if (res.locals.videoAll) return generateVideoOEmbed(req, res)

  return generatePlaylistOEmbed(req, res)
}

function generatePlaylistOEmbed (req: express.Request, res: express.Response) {
  const playlist = res.locals.videoPlaylistSummary

  const json = buildOEmbed({
    channel: playlist.VideoChannel,
    title: playlist.name,
    embedPath: playlist.getEmbedStaticPath(),
    previewPath: playlist.getThumbnailStaticPath(),
    previewSize: THUMBNAILS_SIZE,
    req
  })

  return res.json(json)
}

function generateVideoOEmbed (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  const json = buildOEmbed({
    channel: video.VideoChannel,
    title: video.name,
    embedPath: video.getEmbedStaticPath(),
    previewPath: video.getPreviewStaticPath(),
    previewSize: PREVIEWS_SIZE,
    req
  })

  return res.json(json)
}

function buildOEmbed (options: {
  req: express.Request
  title: string
  channel: MChannelSummary
  previewPath: string | null
  embedPath: string
  previewSize: {
    height: number
    width: number
  }
}) {
  const { req, previewSize, previewPath, title, channel, embedPath } = options

  const webserverUrl = WEBSERVER.URL
  const maxHeight = parseInt(req.query.maxheight, 10)
  const maxWidth = parseInt(req.query.maxwidth, 10)

  const embedUrl = webserverUrl + embedPath
  let embedWidth = EMBED_SIZE.width
  let embedHeight = EMBED_SIZE.height

  let thumbnailUrl = previewPath
    ? webserverUrl + previewPath
    : undefined

  if (maxHeight < embedHeight) embedHeight = maxHeight
  if (maxWidth < embedWidth) embedWidth = maxWidth

  // Our thumbnail is too big for the consumer
  if (
    (maxHeight !== undefined && maxHeight < previewSize.height) ||
    (maxWidth !== undefined && maxWidth < previewSize.width)
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
    title: title,
    author_name: channel.name,
    author_url: channel.Actor.url,
    provider_name: 'PeerTube',
    provider_url: webserverUrl
  }

  if (thumbnailUrl !== undefined) {
    json.thumbnail_url = thumbnailUrl
    json.thumbnail_width = previewSize.width
    json.thumbnail_height = previewSize.height
  }

  return json
}

function redirectToAccountUrl (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.redirect(res.locals.account.Actor.url)
}

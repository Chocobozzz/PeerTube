import { escapeHTML, forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { getOrCreateAPActor } from '@server/lib/activitypub/actors/get.js'
import { loadActorUrlOrGetFromWebfinger } from '@server/lib/activitypub/actors/webfinger.js'
import { AccountModel } from '@server/models/account/account.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoModel } from '@server/models/video/video.js'
import { MChannelSummary, MThumbnail } from '@server/types/models/index.js'
import cors from 'cors'
import express from 'express'
import { EMBED_SIZE, WEBSERVER } from '../initializers/constants.js'
import { apiRateLimiter, asyncMiddleware, oembedValidator } from '../middlewares/index.js'
import { accountHandleGetValidatorFactory } from '../middlewares/validators/index.js'

const servicesRouter = express.Router()

servicesRouter.use(
  '/oembed',
  cors(),
  apiRateLimiter,
  asyncMiddleware(oembedValidator),
  asyncMiddleware(generateOEmbed)
)

// TODO: deprecated, remove in PeerTube 8.1
servicesRouter.use(
  '/redirect/accounts/:handle',
  apiRateLimiter,
  asyncMiddleware(accountHandleGetValidatorFactory({ checkIsLocal: false, checkCanManage: false })),
  redirectToAccountUrl
)

servicesRouter.use(
  '/redirect/actors/:handle',
  apiRateLimiter,
  asyncMiddleware(redirectToActorUrl)
)

// ---------------------------------------------------------------------------

export {
  servicesRouter
}

// ---------------------------------------------------------------------------

async function generateOEmbed (req: express.Request, res: express.Response) {
  if (res.locals.videoWithRights) {
    await generateVideoOEmbed(req, res)
    return
  }

  return generatePlaylistOEmbed(req, res)
}

function generatePlaylistOEmbed (req: express.Request, res: express.Response) {
  const playlist = res.locals.videoPlaylistSummary

  const json = buildOEmbed({
    channel: playlist.VideoChannel,
    title: playlist.name,
    embedPath: playlist.getEmbedStaticPath() + buildPlayerURLQuery(req.query.url),
    thumbnail: playlist.Thumbnail,
    req
  })

  return res.json(json)
}

async function generateVideoOEmbed (req: express.Request, res: express.Response) {
  const video = res.locals.videoWithRights
  const videoWithThumbnails = await VideoModel.loadWithThumbnails(video.id)

  const json = buildOEmbed({
    channel: video.VideoChannel,
    title: video.name,
    embedPath: video.getEmbedStaticPath() + buildPlayerURLQuery(req.query.url),
    thumbnail: videoWithThumbnails.getBestThumbnail('16:9', 1280),
    req
  })

  return res.json(json)
}

function buildPlayerURLQuery (inputQueryUrl: string) {
  const allowedParameters = new Set([
    'start',
    'stop',
    'loop',
    'autoplay',
    'muted',
    'controls',
    'controlBar',
    'title',
    'api',
    'warningTitle',
    'peertubeLink',
    'p2p',
    'subtitle',
    'bigPlayBackgroundColor',
    'mode',
    'foregroundColor',
    'playbackRate',
    'api',
    'waitPasswordFromEmbedAPI',
    'playlistPosition'
  ])

  const params = new URLSearchParams()

  new URL(inputQueryUrl).searchParams.forEach((v, k) => {
    if (allowedParameters.has(k)) {
      params.append(k, v)
    }
  })

  const stringQuery = params.toString()
  if (!stringQuery) return ''

  return '?' + stringQuery
}

function buildOEmbed (options: {
  req: express.Request
  title: string
  channel: MChannelSummary
  embedPath: string

  thumbnail: MThumbnail
}) {
  const { req, thumbnail, title, channel, embedPath } = options

  const webserverUrl = WEBSERVER.URL
  const maxHeight = forceNumber(req.query.maxheight)
  const maxWidth = forceNumber(req.query.maxwidth)

  const embedUrl = webserverUrl + embedPath
  const embedTitle = escapeHTML(title)

  let embedWidth = EMBED_SIZE.width
  if (maxWidth < embedWidth) embedWidth = maxWidth

  let embedHeight = EMBED_SIZE.height
  if (maxHeight < embedHeight) embedHeight = maxHeight

  const html = `<iframe width="${embedWidth}" height="${embedHeight}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" ` +
    `title="${embedTitle}" src="${embedUrl}" style="border: none" allow="fullscreen"></iframe>`

  const json: any = {
    type: 'video',
    version: '1.0',
    html,
    width: embedWidth,
    height: embedHeight,
    title,
    author_name: channel.name,
    author_url: channel.Actor.url,
    provider_name: 'PeerTube',
    provider_url: webserverUrl
  }

  if (thumbnail && (!maxHeight || thumbnail.height < maxHeight) && (!maxWidth || thumbnail.width < maxWidth)) {
    json.thumbnail_url = webserverUrl + thumbnail.getFileStaticPath()
    json.thumbnail_width = thumbnail.width
    json.thumbnail_height = thumbnail.height
  }

  return json
}

// ---------------------------------------------------------------------------
function redirectToAccountUrl (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.redirect(res.locals.account.Actor.url)
}

async function redirectToActorUrl (req: express.Request, res: express.Response, next: express.NextFunction) {
  const handle = req.params.handle

  if (handle.includes('@')) {
    try {
      const actorUrl = await loadActorUrlOrGetFromWebfinger(handle)
      const actor = await getOrCreateAPActor(actorUrl, 'all')

      if (actor) return res.redirect(actor.url)
    } catch (error) {
      logger.info('Cannot redirect to actor URL from handle.', { handle, error })

      return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
    }
  } else {
    const account = await AccountModel.loadByHandle(handle)
    if (account) return res.redirect(account.Actor.url)

    const channel = await VideoChannelModel.loadByHandleAndPopulateAccount(handle)
    if (channel) return res.redirect(channel.Actor.url)
  }

  return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
}

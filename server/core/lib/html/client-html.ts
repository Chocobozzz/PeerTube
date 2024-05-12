import { HttpStatusCode } from '@peertube/peertube-models'
import express from 'express'
import { logger } from '../../helpers/logger.js'
import { ACCEPT_HEADERS } from '../../initializers/constants.js'
import { VideoHtml } from './shared/video-html.js'
import { PlaylistHtml } from './shared/playlist-html.js'
import { ActorHtml } from './shared/actor-html.js'
import { PageHtml } from './shared/page-html.js'

class ClientHtml {

  static invalidateCache () {
    PageHtml.invalidateCache()
  }

  static getDefaultHTMLPage (req: express.Request, res: express.Response, paramLang?: string) {
    return PageHtml.getDefaultHTML(req, res, paramLang)
  }

  // ---------------------------------------------------------------------------

  static getWatchHTMLPage (videoIdArg: string, req: express.Request, res: express.Response) {
    return VideoHtml.getWatchVideoHTML(videoIdArg, req, res)
  }

  static getVideoEmbedHTML (videoIdArg: string) {
    return VideoHtml.getEmbedVideoHTML(videoIdArg)
  }

  // ---------------------------------------------------------------------------

  static getWatchPlaylistHTMLPage (videoPlaylistIdArg: string, req: express.Request, res: express.Response) {
    return PlaylistHtml.getWatchPlaylistHTML(videoPlaylistIdArg, req, res)
  }

  static getVideoPlaylistEmbedHTML (playlistIdArg: string) {
    return PlaylistHtml.getEmbedPlaylistHTML(playlistIdArg)
  }

  // ---------------------------------------------------------------------------

  static getAccountHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    return ActorHtml.getAccountHTMLPage(nameWithHost, req, res)
  }

  static getVideoChannelHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    return ActorHtml.getVideoChannelHTMLPage(nameWithHost, req, res)
  }

  static getActorHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    return ActorHtml.getActorHTMLPage(nameWithHost, req, res)
  }
}

function sendHTML (html: string, res: express.Response, localizedHTML: boolean = false) {
  res.set('Content-Type', 'text/html; charset=UTF-8')
  res.set('Cache-Control', 'max-age=0, no-cache, must-revalidate')

  if (localizedHTML) {
    res.set('Vary', 'Accept-Language')
  }

  return res.send(html)
}

async function serveIndexHTML (req: express.Request, res: express.Response) {
  if (req.accepts(ACCEPT_HEADERS) === 'html' || !req.headers.accept) {
    try {
      await generateHTMLPage(req, res, req.params.language)
      return
    } catch (err) {
      logger.error('Cannot generate HTML page.', { err })
      return res.status(HttpStatusCode.INTERNAL_SERVER_ERROR_500).end()
    }
  }

  return res.status(HttpStatusCode.NOT_ACCEPTABLE_406).end()
}

// ---------------------------------------------------------------------------

export {
  ClientHtml,
  sendHTML,
  serveIndexHTML
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function generateHTMLPage (req: express.Request, res: express.Response, paramLang?: string) {
  const html = await ClientHtml.getDefaultHTMLPage(req, res, paramLang)

  return sendHTML(html, res, true)
}

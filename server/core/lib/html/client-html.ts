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

  static getWatchHTMLPage (videoId: string, req: express.Request, res: express.Response) {
    return VideoHtml.getWatchVideoHTML(videoId, req, res)
  }

  static getVideoEmbedHTML (videoId: string) {
    return VideoHtml.getEmbedVideoHTML(videoId)
  }

  // ---------------------------------------------------------------------------

  static getWatchPlaylistHTMLPage (videoPlaylistId: string, req: express.Request, res: express.Response) {
    return PlaylistHtml.getWatchPlaylistHTML(videoPlaylistId, req, res)
  }

  static getVideoPlaylistEmbedHTML (playlistId: string) {
    return PlaylistHtml.getEmbedPlaylistHTML(playlistId)
  }

  // ---------------------------------------------------------------------------

  static getAccountHTMLPage (handle: string, req: express.Request, res: express.Response) {
    return ActorHtml.getAccountHTMLPage(handle, req, res)
  }

  static getVideoChannelHTMLPage (handle: string, req: express.Request, res: express.Response) {
    return ActorHtml.getVideoChannelHTMLPage(handle, req, res)
  }

  static getActorHTMLPage (handle: string, req: express.Request, res: express.Response) {
    return ActorHtml.getActorHTMLPage(handle, req, res)
  }
}

function sendHTML (html: string, res: express.Response, localizedHTML = false) {
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

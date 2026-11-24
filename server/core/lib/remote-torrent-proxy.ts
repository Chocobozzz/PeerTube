import { HttpStatusCode } from '@peertube/peertube-models'
import { isUrlValid } from '@server/helpers/custom-validators/urls.js'
import { createLogger } from '@server/helpers/logger.js'
import { doBufferRequest } from '@server/helpers/requests.js'
import bencode from 'bencode'
import { create as createContentDisposition } from 'content-disposition'
import express from 'express'

const logger = createLogger('download')

// Never pipe the remote response to our response: the remote server must not control our status code and headers
export async function proxifyRemoteTorrent (options: {
  res: express.Response
  remoteUrl: string
  downloadFilename: string
}) {
  const { res, remoteUrl, downloadFilename } = options

  if (!remoteUrl || !isUrlValid(remoteUrl)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  let body: Uint8Array

  try {
    // Throws on non 2xx responses
    const result = await doBufferRequest(remoteUrl)

    body = result.body
  } catch (err) {
    logger.info(`Cannot proxify remote torrent ${remoteUrl}`, { err })

    return res.sendStatus(
      err.statusCode === HttpStatusCode.NOT_FOUND_404
        ? HttpStatusCode.NOT_FOUND_404
        : HttpStatusCode.BAD_GATEWAY_502
    )
  }

  if (!isTorrentContent(body)) {
    logger.info(`Remote torrent ${remoteUrl} is not a valid torrent file`)

    return res.sendStatus(HttpStatusCode.BAD_GATEWAY_502)
  }

  res.status(HttpStatusCode.OK_200)
  res.setHeader('Content-Type', 'application/x-bittorrent')
  res.setHeader('Content-Disposition', createContentDisposition(downloadFilename))
  res.setHeader('X-Content-Type-Options', 'nosniff')

  return res.end(body)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isTorrentContent (body: Uint8Array) {
  try {
    const decoded = bencode.decode(body)

    return !!decoded && typeof decoded === 'object' && !!decoded.info && typeof decoded.info === 'object'
  } catch {
    return false
  }
}

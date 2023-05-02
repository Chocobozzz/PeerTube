import { createWriteStream, remove } from 'fs-extra'
import { request as requestHTTP } from 'http'
import { request as requestHTTPS, RequestOptions } from 'https'
import { logger } from './logger'

export function downloadFile (options: {
  url: string
  destination: string
  runnerToken: string
  jobToken: string
}) {
  const { url, destination, runnerToken, jobToken } = options

  logger.debug(`Downloading file ${url}`)

  return new Promise<void>((res, rej) => {
    const parsed = new URL(url)

    const body = JSON.stringify({
      runnerToken,
      jobToken
    })

    const getOptions: RequestOptions = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf-8')
      }
    }

    const request = getRequest(url)(getOptions, response => {
      const code = response.statusCode ?? 0

      if (code >= 400) {
        return rej(new Error(response.statusMessage))
      }

      const file = createWriteStream(destination)
      file.on('finish', () => res())

      response.pipe(file)
    })

    request.on('error', err => {
      remove(destination)
        .catch(err => logger.error(err))

      return rej(err)
    })

    request.write(body)
    request.end()
  })
}

// ---------------------------------------------------------------------------

function getRequest (url: string) {
  if (url.startsWith('https://')) return requestHTTPS

  return requestHTTP
}

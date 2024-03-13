import { HttpErrorResponse, HttpEventType, HttpHeaders } from '@angular/common/http'
import { Notifier } from '@app/core'
import { HttpStatusCode } from '@peertube/peertube-models'
import { UploadState } from 'ngx-uploadx'

export function genericUploadErrorHandler (options: {
  err: Pick<HttpErrorResponse, 'message' | 'status' | 'headers'>
  name: string
  notifier?: Notifier
  sticky?: boolean
}) {
  const { err, name, notifier, sticky = false } = options
  const title = $localize`Upload failed`
  const message = buildMessage(name, err)

  if (notifier) notifier.error(message, title, null, sticky)

  return message
}

export function getUploadXRetryConfig () {
  return {
    maxAttempts: 30, // maximum attempts for 503 codes, otherwise set to 6, see below
    maxDelay: 120_000, // 2 min
    shouldRetry: (code: number, attempts: number) => {
      return code === HttpStatusCode.SERVICE_UNAVAILABLE_503 || ((code < 400 || code > 500) && attempts < 6)
    }
  }
}

export function buildHTTPErrorResponse (state: UploadState): HttpErrorResponse {
  const error = state.response?.error?.message || state.response?.error || 'Unknown error'

  return {
    error: new Error(error),
    name: 'HttpErrorResponse',
    message: error,
    ok: false,
    headers: new HttpHeaders(state.responseHeaders),
    status: +state.responseStatus,
    statusText: error,
    type: HttpEventType.Response,
    url: state.url
  }
}

// ---------------------------------------------------------------------------

function buildMessage (name: string, err: Pick<HttpErrorResponse, 'message' | 'status' | 'headers'>) {
  if (err instanceof ErrorEvent) { // network error
    return $localize`The connection was interrupted`
  }

  if (err.status === HttpStatusCode.INTERNAL_SERVER_ERROR_500) {
    return $localize`The server encountered an error`
  }

  if (err.status === HttpStatusCode.REQUEST_TIMEOUT_408) {
    return $localize`Your ${name} file couldn't be transferred before the server proxy timeout`
  }

  if (err.status === HttpStatusCode.PAYLOAD_TOO_LARGE_413) {
    const maxFileSize = err.headers?.get('X-File-Maximum-Size')
    let message = $localize`Your ${name} file was too large `

    if (maxFileSize) message += $localize` (max. size: ${maxFileSize})`

    return message
  }

  return err.message
}

import { HttpErrorResponse } from '@angular/common/http'
import { Notifier } from '@app/core'
import { HttpStatusCode } from '@shared/models'

function genericUploadErrorHandler (parameters: {
  err: Pick<HttpErrorResponse, 'message' | 'status' | 'headers'>
  name: string
  notifier: Notifier
  sticky?: boolean
}) {
  const { err, name, notifier, sticky } = { sticky: false, ...parameters }
  const title = $localize`The upload failed`
  let message = err.message

  if (err instanceof ErrorEvent) { // network error
    message = $localize`The connection was interrupted`
    notifier.error(message, title, null, sticky)
  } else if (err.status === HttpStatusCode.INTERNAL_SERVER_ERROR_500) {
    message = $localize`The server encountered an error`
    notifier.error(message, title, null, sticky)
  } else if (err.status === HttpStatusCode.REQUEST_TIMEOUT_408) {
    message = $localize`Your ${name} file couldn't be transferred before the set timeout (usually 10min)`
    notifier.error(message, title, null, sticky)
  } else if (err.status === HttpStatusCode.PAYLOAD_TOO_LARGE_413) {
    const maxFileSize = err.headers?.get('X-File-Maximum-Size') || '8G'
    message = $localize`Your ${name} file was too large (max. size: ${maxFileSize})`
    notifier.error(message, title, null, sticky)
  } else {
    notifier.error(err.message, title)
  }

  return message
}

export {
  genericUploadErrorHandler
}

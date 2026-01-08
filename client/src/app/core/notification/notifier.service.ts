import { Injectable, inject } from '@angular/core'
import { HttpStatusCode } from '@peertube/peertube-models'
import { PeerTubeHTTPError, PeerTubeReconnectError } from '@root-helpers/errors'
import { logger } from '@root-helpers/logger'
import { MessageService } from 'primeng/api'

@Injectable()
export class Notifier {
  private messageService = inject(MessageService)

  readonly TIMEOUT = 5000

  info (text: string, title?: string, timeout?: number, sticky?: boolean) {
    if (!title) title = $localize`Info`

    logger.info(`${title}: ${text}`)
    return this.notify({ severity: 'info', text, title, timeout, sticky })
  }

  error (text: string, title?: string, timeout?: number, sticky?: boolean) {
    if (!title) title = $localize`Error`

    logger.error(`${title}: ${text}`)
    return this.notify({ severity: 'error', text, title, timeout, sticky })
  }

  success (text: string, title?: string, timeout?: number, sticky?: boolean) {
    if (!title) title = $localize`Success`

    logger.info(`${title}: ${text}`)
    return this.notify({ severity: 'success', text, title, timeout, sticky })
  }

  handleError (err: Error) {
    if (err instanceof PeerTubeReconnectError && err.alreadyNotified) return

    if (err instanceof PeerTubeHTTPError) {
      const message = `Backend returned code ${err.status}, errorMessage is: ${err.message}`

      if (err.status === HttpStatusCode.NOT_FOUND_404) logger.clientError(message)
      else logger.error(message, { url: err.url })
    } else {
      logger.error(err.message, err)
    }

    return this.notify({ severity: 'error', text: err.message, title: $localize`Error` })
  }

  private notify (options: {
    severity: 'success' | 'info' | 'warn' | 'error'
    text: string
    title: string
    timeout?: number
    sticky?: boolean
  }) {
    const { severity, text, title, timeout, sticky } = options

    this.messageService.add({
      severity,
      summary: title,
      detail: text,
      closable: true,
      life: timeout || this.TIMEOUT,
      sticky
    })
  }
}

import { MessageService } from 'primeng/api'
import { Injectable } from '@angular/core'
import { logger } from '@root-helpers/logger'

@Injectable()
export class Notifier {
  readonly TIMEOUT = 5000

  constructor (private messageService: MessageService) { }

  info (text: string, title?: string, timeout?: number, sticky?: boolean) {
    if (!title) title = $localize`Info`

    logger.info(`${title}: ${text}`)
    return this.notify('info', text, title, timeout, sticky)
  }

  error (text: string, title?: string, timeout?: number, sticky?: boolean) {
    if (!title) title = $localize`Error`

    logger.error(`${title}: ${text}`)
    return this.notify('error', text, title, timeout, sticky)
  }

  success (text: string, title?: string, timeout?: number, sticky?: boolean) {
    if (!title) title = $localize`Success`

    logger.info(`${title}: ${text}`)
    return this.notify('success', text, title, timeout, sticky)
  }

  private notify (severity: 'success' | 'info' | 'warn' | 'error', text: string, title: string, timeout?: number, sticky?: boolean) {
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

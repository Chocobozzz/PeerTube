import { MessageService } from 'primeng/api'
import { Injectable } from '@angular/core'

@Injectable()
export class Notifier {
  readonly TIMEOUT = 5000

  constructor (private messageService: MessageService) { }

  info (text: string, title?: string, timeout?: number, sticky?: boolean) {
    if (!title) title = $localize`Info`

    console.info(`${title}: ${text}`)
    return this.notify('info', text, title, timeout, sticky)
  }

  error (text: string, title?: string, timeout?: number, sticky?: boolean) {
    if (!title) title = $localize`Error`

    console.error(`${title}: ${text}`)
    return this.notify('error', text, title, timeout, sticky)
  }

  success (text: string, title?: string, timeout?: number, sticky?: boolean) {
    if (!title) title = $localize`Success`

    console.log(`${title}: ${text}`)
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

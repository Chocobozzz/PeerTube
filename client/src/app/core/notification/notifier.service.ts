import { MessageService } from 'primeng/api'
import { Injectable } from '@angular/core'

@Injectable()
export class Notifier {
  readonly TIMEOUT = 5000

  constructor (private messageService: MessageService) { }

  info (text: string, title?: string, timeout?: number) {
    if (!title) title = $localize`Info`

    return this.notify('info', text, title, timeout)
  }

  error (text: string, title?: string, timeout?: number) {
    if (!title) title = $localize`Error`

    return this.notify('error', text, title, timeout)
  }

  success (text: string, title?: string, timeout?: number) {
    if (!title) title = $localize`Success`

    return this.notify('success', text, title, timeout)
  }

  private notify (severity: 'success' | 'info' | 'warn' | 'error', text: string, title: string, timeout?: number) {
    this.messageService.add({
      severity,
      summary: title,
      detail: text,
      closable: true,
      life: timeout || this.TIMEOUT
    })
  }
}

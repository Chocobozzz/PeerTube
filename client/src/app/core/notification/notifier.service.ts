import { Injectable } from '@angular/core'
import { MessageService } from 'primeng/api'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Injectable()
export class Notifier {
  readonly TIMEOUT = 5000

  constructor (
    private i18n: I18n,
    private messageService: MessageService) {
  }

  info (text: string, title?: string, timeout?: number) {
    if (!title) title = this.i18n('Info')

    return this.notify('info', text, title, timeout)
  }

  error (text: string, title?: string, timeout?: number) {
    if (!title) title = this.i18n('Error')

    return this.notify('error', text, title, timeout)
  }

  success (text: string, title?: string, timeout?: number) {
    if (!title) title = this.i18n('Success')

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

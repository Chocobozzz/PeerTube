import { Injectable } from '@angular/core'
import { CanDeactivate } from '@angular/router'
import { Observable } from 'rxjs'
import { ConfirmService } from '../../core/index'
import { I18n } from '@ngx-translate/i18n-polyfill'

export interface CanComponentDeactivate {
  canDeactivate: () => { text?: string, canDeactivate: Observable<boolean> | boolean }
}

@Injectable()
export class CanDeactivateGuard implements CanDeactivate<CanComponentDeactivate> {
  constructor (
    private confirmService: ConfirmService,
    private i18n: I18n
  ) { }

  canDeactivate (component: CanComponentDeactivate) {
    const result = component.canDeactivate()
    const text = result.text || this.i18n('All unsaved data will be lost, are you sure you want to leave this page?')

    return result.canDeactivate || this.confirmService.confirm(
      text,
      this.i18n('Warning')
    )
  }

}

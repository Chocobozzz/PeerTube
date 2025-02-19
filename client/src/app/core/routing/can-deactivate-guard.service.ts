import debug from 'debug'
import { Observable } from 'rxjs'
import { Injectable, inject } from '@angular/core'
import { ConfirmService } from '@app/core/confirm'

export type CanComponentDeactivateResult = { text?: string, canDeactivate: Observable<boolean> | boolean }

const debugLogger = debug('peertube:routing:CanComponentDeactivate')

export interface CanComponentDeactivate {
  canDeactivate: () => CanComponentDeactivateResult
}

@Injectable()
export class CanDeactivateGuard {
  private confirmService = inject(ConfirmService)

  canDeactivate (component: CanComponentDeactivate) {
    const result = component.canDeactivate()

    debugLogger('Checking if component can deactivate', result)

    const text = result.text || $localize`All unsaved data will be lost, are you sure you want to leave this page?`

    return result.canDeactivate || this.confirmService.confirm(
      text,
      $localize`Warning`
    )
  }
}

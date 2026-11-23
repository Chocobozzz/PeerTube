import debug from 'debug'
import { Observable } from 'rxjs'
import { Injectable, inject } from '@angular/core'
import { ConfirmService } from '@app/core/confirm'

export type CanComponentDeactivateResult = {
  canDeactivate: Observable<boolean> | boolean
  text?: string
}

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
    if (result.canDeactivate) return true

    const text = result.text || $localize`All unsaved data will be lost, are you sure you want to leave this page?`

    // "Stay on page" is the primary/default button so we don't leave the page by accident
    // Only leave the page if the user explicitly clicked on "Leave page" (not on the cross, the escape key or outside the modal)
    return this.confirmService.confirmWithCancelInfo(
      text,
      $localize`Warning`,
      {
        confirmButtonText: $localize`Stay on page`,
        cancelButtonText: $localize`Leave page`
      }
    ).then(({ cancelled }) => cancelled)
  }
}

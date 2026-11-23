import debug from 'debug'
import { Observable } from 'rxjs'
import { Injectable, inject } from '@angular/core'
import { ConfirmService } from '@app/core/confirm'

export type CanComponentDeactivateResult = {
  canDeactivate: Observable<boolean> | boolean
  text?: string
}

// * leave: the component can be deactivated, or the user explicitly clicked on "Leave page"
// * stay: the user wants to stay on the page ("Stay on page", cross, escape key or click outside the modal)
// * pop-state: the modal was closed because the user navigated in the browser history (back/forward button)
export type CanDeactivateConfirmResult = 'leave' | 'stay' | 'pop-state'

const debugLogger = debug('peertube:routing:CanComponentDeactivate')

export interface CanComponentDeactivate {
  canDeactivate: () => CanComponentDeactivateResult
}

@Injectable()
export class CanDeactivateGuard {
  private confirmService = inject(ConfirmService)

  async canDeactivate (component: CanComponentDeactivate) {
    return await this.confirmDeactivate(component) === 'leave'
  }

  async confirmDeactivate (component: CanComponentDeactivate): Promise<CanDeactivateConfirmResult> {
    const result = component.canDeactivate()

    debugLogger('Checking if component can deactivate', result)
    if (result.canDeactivate) return 'leave'

    const text = result.text || $localize`All unsaved data will be lost, are you sure you want to leave this page?`

    // "Stay on page" is the primary/default button so we don't leave the page by accident
    const reason = await this.confirmService.confirmWithReason(
      text,
      $localize`Warning`,
      {
        confirmButtonText: $localize`Stay on page`,
        cancelButtonText: $localize`Leave page`
      }
    )

    if (reason === 'cancel-button') return 'leave'
    if (reason === 'pop-state') return 'pop-state'

    return 'stay'
  }
}

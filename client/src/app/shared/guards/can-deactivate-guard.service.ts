import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, CanDeactivate, RouterStateSnapshot } from '@angular/router'
import { Observable } from 'rxjs'
import { ConfirmService } from '../../core/index'

export interface CanComponentDeactivate {
  canDeactivate: () => { text?: string, canDeactivate: Observable<boolean> | boolean }
}

@Injectable()
export class CanDeactivateGuard implements CanDeactivate<CanComponentDeactivate> {
  constructor (private confirmService: ConfirmService) { }

  canDeactivate (component: CanComponentDeactivate,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ) {
    const result = component.canDeactivate()
    const text = result.text || 'All unsaved data will be lost, are you sure you want to leave this page?'

    return result.canDeactivate || this.confirmService.confirm(
      text,
      'Warning'
    )
  }

}

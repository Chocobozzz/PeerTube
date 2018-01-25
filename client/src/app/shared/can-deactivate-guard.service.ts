import { Injectable } from '@angular/core'
import { CanDeactivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router'
import { Observable } from 'rxjs/Observable'
import { ConfirmService } from '../core'

export interface CanComponentDeactivate {
  canDeactivate: () => Observable<boolean> | boolean
}

@Injectable()
export class CanDeactivateGuard implements CanDeactivate<CanComponentDeactivate> {
  constructor (private confirmService: ConfirmService) { }

  canDeactivate (component: CanComponentDeactivate,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean> | boolean {
    return component.canDeactivate() || this.confirmService.confirm(
      'All unsaved data will be lost, are you sure you want to leave ?',
      'Unsaved Data'
    )
  }

}

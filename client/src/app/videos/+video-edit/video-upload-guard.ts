import { Injectable } from '@angular/core'
import { CanDeactivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router'

import { VideoAddComponent } from './video-add.component'
import { ConfirmService } from '../../core'
import { Observable } from 'rxjs/Observable';

@Injectable()
export class VideoUploadGuard implements CanDeactivate<VideoAddComponent> {
  constructor(private confirmService: ConfirmService) { }

  canDeactivate (component: VideoAddComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): Observable<boolean> | boolean {
    return component.canDeactivate() || this.confirmService.confirm(
      'Your upload will be canceled, are you sure?',
      'Video Upload'
    )
  }
}

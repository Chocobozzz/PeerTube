import { Injectable } from '@angular/core'
import { CanDeactivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router'

import { VideoAddComponent } from './video-add.component'

@Injectable()
export class VideoUploadGuard implements CanDeactivate<VideoAddComponent> {
  canDeactivate (component: VideoAddComponent,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): boolean {
    console.log('VideoUploadGuard')
    console.log(currentRoute.params)
    console.log(currentState.url)
    return component.canDeactivate() || window.confirm('Your upload will be canceled, are you sure?')
    // return true;
  }
}

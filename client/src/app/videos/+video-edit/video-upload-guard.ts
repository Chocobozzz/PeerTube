import { CanDeactivate, ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

import { VideoAddComponent } from "./video-add.component";

class VideoUploadGuard implements CanDeactivate<VideoAddComponent> { 
    canDeactivate(component: VideoAddComponent, 
                  route: ActivatedRouteSnapshot,
                  state: RouterStateSnapshot): boolean {
      console.log("VideoUploadGuard");
      console.log(route.params);
      console.log(state.url);
      return component.canDeactivate() || window.confirm("Your upload will be canceled, are you sure?");
    }
  }
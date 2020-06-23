import { NgModule } from '@angular/core'
import { CanDeactivateGuard } from '@app/core'
import { VideoUpdateResolver } from '@app/videos/+video-edit/video-update.resolver'
import { VideoEditModule } from './shared/video-edit.module'
import { VideoUpdateRoutingModule } from './video-update-routing.module'
import { VideoUpdateComponent } from './video-update.component'

@NgModule({
  imports: [
    VideoUpdateRoutingModule,

    VideoEditModule
  ],

  declarations: [
    VideoUpdateComponent
  ],

  exports: [ ],

  providers: [
    VideoUpdateResolver,
    CanDeactivateGuard
  ]
})
export class VideoUpdateModule { }

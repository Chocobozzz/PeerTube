import { NgModule } from '@angular/core'
import { SharedModule } from '../../shared'
import { VideoEditModule } from './shared/video-edit.module'
import { VideoUpdateRoutingModule } from './video-update-routing.module'
import { VideoUpdateComponent } from './video-update.component'
import { VideoUpdateResolver } from '@app/videos/+video-edit/video-update.resolver'
import { CanDeactivateGuard } from '@app/shared/guards/can-deactivate-guard.service'

@NgModule({
  imports: [
    VideoUpdateRoutingModule,
    VideoEditModule,
    SharedModule
  ],

  declarations: [
    VideoUpdateComponent
  ],

  exports: [
    VideoUpdateComponent
  ],

  providers: [
    VideoUpdateResolver,
    CanDeactivateGuard
  ]
})
export class VideoUpdateModule { }

import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedActorImageModule } from '../shared/shared-actor-image/shared-actor-image.module'
import { SharedActorImageEditModule } from '@app/shared/shared-actor-image-edit'
import { VideoChannelCreateComponent } from './video-channel-edit/video-channel-create.component'
import { VideoChannelUpdateComponent } from './video-channel-edit/video-channel-update.component'
import { ManageRoutingModule } from './manage-routing.module'

@NgModule({
  imports: [
    ManageRoutingModule,
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,
    SharedActorImageModule,
    SharedActorImageEditModule
  ],

  declarations: [
    VideoChannelCreateComponent,
    VideoChannelUpdateComponent
  ],

  exports: [
  ],

  providers: []
})
export class ManageModule { }

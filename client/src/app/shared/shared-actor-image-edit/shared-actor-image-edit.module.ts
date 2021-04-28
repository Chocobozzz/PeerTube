
import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { SharedActorImageModule } from '../shared-actor-image/shared-actor-image.module'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main'
import { ActorAvatarEditComponent } from './actor-avatar-edit.component'
import { ActorBannerEditComponent } from './actor-banner-edit.component'

@NgModule({
  imports: [
    CommonModule,

    SharedMainModule,
    SharedActorImageModule,
    SharedGlobalIconModule
  ],

  declarations: [
    ActorAvatarEditComponent,
    ActorBannerEditComponent
  ],

  exports: [
    ActorAvatarEditComponent,
    ActorBannerEditComponent
  ],

  providers: [ ]
})
export class SharedActorImageEditModule { }

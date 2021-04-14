
import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main'
import { ActorAvatarEditComponent } from './actor-avatar-edit.component'
import { ActorBannerEditComponent } from './actor-banner-edit.component'

@NgModule({
  imports: [
    CommonModule,

    SharedMainModule,
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
export class SharedActorImageModule { }

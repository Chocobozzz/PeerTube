
import { NgModule } from '@angular/core'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { ActorAvatarComponent } from './actor-avatar.component'

@NgModule({
  imports: [
    SharedMainModule,
    SharedGlobalIconModule
  ],

  declarations: [
    ActorAvatarComponent
  ],

  exports: [
    ActorAvatarComponent
  ],

  providers: [ ]
})
export class SharedActorImageModule { }


import { NgModule } from '@angular/core'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { AccountAvatarComponent } from './account-avatar.component'

@NgModule({
  imports: [
    SharedMainModule,
    SharedGlobalIconModule
  ],

  declarations: [
    AccountAvatarComponent
  ],

  exports: [
    AccountAvatarComponent
  ],

  providers: [ ]
})
export class SharedAccountAvatarModule { }

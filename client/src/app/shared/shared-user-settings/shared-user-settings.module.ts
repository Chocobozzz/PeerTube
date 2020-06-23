
import { NgModule } from '@angular/core'
import { SharedFormModule } from '../shared-forms'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { UserInterfaceSettingsComponent } from './user-interface-settings.component'
import { UserVideoSettingsComponent } from './user-video-settings.component'

@NgModule({
  imports: [
    SharedMainModule,
    SharedFormModule
  ],

  declarations: [
    UserInterfaceSettingsComponent,
    UserVideoSettingsComponent
  ],

  exports: [
    UserInterfaceSettingsComponent,
    UserVideoSettingsComponent
  ],

  providers: [ ]
})
export class SharedUserInterfaceSettingsModule { }

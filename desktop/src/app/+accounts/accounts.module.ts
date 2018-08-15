import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { AccountsRoutingModule } from './accounts-routing.module'
import { AccountsComponent } from './accounts.component'
import { AccountVideosComponent } from './account-videos/account-videos.component'
import { AccountAboutComponent } from './account-about/account-about.component'
import { AccountVideoChannelsComponent } from './account-video-channels/account-video-channels.component'

@NgModule({
  imports: [
    AccountsRoutingModule,
    SharedModule
  ],

  declarations: [
    AccountsComponent,
    AccountVideosComponent,
    AccountVideoChannelsComponent,
    AccountAboutComponent
  ],

  exports: [
    AccountsComponent
  ],

  providers: []
})
export class AccountsModule { }

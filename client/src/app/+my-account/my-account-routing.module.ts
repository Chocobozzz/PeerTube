import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { LoginGuard } from '../core'
import { MyAccountComponent } from './my-account.component'
import { MyAccountSettingsComponent } from './my-account-settings/my-account-settings.component'
import { MyAccountVideosComponent } from './my-account-videos/my-account-videos.component'
import { MyAccountVideoChannelsComponent } from '@app/+my-account/my-account-video-channels/my-account-video-channels.component'
import { MyAccountVideoChannelCreateComponent } from '@app/+my-account/my-account-video-channels/my-account-video-channel-create.component'
import { MyAccountVideoChannelUpdateComponent } from '@app/+my-account/my-account-video-channels/my-account-video-channel-update.component'
import { MyAccountVideoImportsComponent } from '@app/+my-account/my-account-video-imports/my-account-video-imports.component'
import { MyAccountSubscriptionsComponent } from '@app/+my-account/my-account-subscriptions/my-account-subscriptions.component'
import { MyAccountOwnershipComponent } from '@app/+my-account/my-account-ownership/my-account-ownership.component'
import { MyAccountBlocklistComponent } from '@app/+my-account/my-account-blocklist/my-account-blocklist.component'
import { MyAccountServerBlocklistComponent } from '@app/+my-account/my-account-blocklist/my-account-server-blocklist.component'

const myAccountRoutes: Routes = [
  {
    path: '',
    component: MyAccountComponent,
    canActivateChild: [ MetaGuard, LoginGuard ],
    children: [
      {
        path: '',
        redirectTo: 'settings',
        pathMatch: 'full'
      },
      {
        path: 'settings',
        component: MyAccountSettingsComponent,
        data: {
          meta: {
            title: 'Account settings'
          }
        }
      },
      {
        path: 'video-channels',
        component: MyAccountVideoChannelsComponent,
        data: {
          meta: {
            title: 'Account video channels'
          }
        }
      },
      {
        path: 'video-channels/create',
        component: MyAccountVideoChannelCreateComponent,
        data: {
          meta: {
            title: 'Create new video channel'
          }
        }
      },
      {
        path: 'video-channels/update/:videoChannelId',
        component: MyAccountVideoChannelUpdateComponent,
        data: {
          meta: {
            title: 'Update video channel'
          }
        }
      },
      {
        path: 'videos',
        component: MyAccountVideosComponent,
        data: {
          meta: {
            title: 'Account videos'
          }
        }
      },
      {
        path: 'video-imports',
        component: MyAccountVideoImportsComponent,
        data: {
          meta: {
            title: 'Account video imports'
          }
        }
      },
      {
        path: 'subscriptions',
        component: MyAccountSubscriptionsComponent,
        data: {
          meta: {
            title: 'Account subscriptions'
          }
        }
      },
      {
        path: 'ownership',
        component: MyAccountOwnershipComponent,
        data: {
          meta: {
            title: 'Ownership changes'
          }
        }
      },
      {
        path: 'blocklist/accounts',
        component: MyAccountBlocklistComponent,
        data: {
          meta: {
            title: 'Muted accounts'
          }
        }
      },
      {
        path: 'blocklist/servers',
        component: MyAccountServerBlocklistComponent,
        data: {
          meta: {
            title: 'Muted instances'
          }
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(myAccountRoutes) ],
  exports: [ RouterModule ]
})
export class MyAccountRoutingModule {}

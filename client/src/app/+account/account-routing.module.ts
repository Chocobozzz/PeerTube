import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { AccountComponent } from './account.component'
import { AccountVideosComponent } from './account-videos/account-videos.component'
import { AccountAboutComponent } from './account-about/account-about.component'
import { AccountVideoChannelsComponent } from './account-video-channels/account-video-channels.component'

const accountRoutes: Routes = [
  {
    path: ':accountId',
    component: AccountComponent,
    canActivateChild: [ MetaGuard ],
    children: [
      {
        path: '',
        redirectTo: 'videos',
        pathMatch: 'full'
      },
      {
        path: 'videos',
        component: AccountVideosComponent,
        data: {
          meta: {
            title: 'Account videos'
          }
        }
      },
      {
        path: 'video-channels',
        component: AccountVideoChannelsComponent,
        data: {
          meta: {
            title: 'Account video channels'
          }
        }
      },
      {
        path: 'about',
        component: AccountAboutComponent,
        data: {
          meta: {
            title: 'About account'
          }
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(accountRoutes) ],
  exports: [ RouterModule ]
})
export class AccountRoutingModule {}

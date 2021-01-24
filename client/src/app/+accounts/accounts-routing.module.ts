import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { AccountsComponent } from './accounts.component'
import { AccountVideosComponent } from './account-videos/account-videos.component'
import { AccountAboutComponent } from './account-about/account-about.component'
import { AccountVideoChannelsComponent } from './account-video-channels/account-video-channels.component'
import { AccountSearchComponent } from './account-search/account-search.component'

const accountsRoutes: Routes = [
  {
    path: 'peertube',
    redirectTo: '/videos/local'
  },
  {
    path: ':accountId',
    component: AccountsComponent,
    canActivateChild: [ MetaGuard ],
    children: [
      {
        path: '',
        redirectTo: 'video-channels',
        pathMatch: 'full'
      },
      {
        path: 'video-channels',
        component: AccountVideoChannelsComponent,
        data: {
          meta: {
            title: $localize`Account video channels`
          }
        }
      },
      {
        path: 'about',
        component: AccountAboutComponent,
        data: {
          meta: {
            title: $localize`About account`
          }
        }
      },
      {
        path: 'videos',
        component: AccountVideosComponent,
        data: {
          meta: {
            title: $localize`Account videos`
          },
          reuse: {
            enabled: true,
            key: 'account-videos-list'
          }
        }
      },
      {
        path: 'search',
        component: AccountSearchComponent,
        data: {
          meta: {
            title: $localize`Search videos within account`
          }
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(accountsRoutes) ],
  exports: [ RouterModule ]
})
export class AccountsRoutingModule {}

import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { PreloadSelectedModulesList } from './core'

const routes: Routes = [
  {
    path: 'admin',
    loadChildren: './+admin/admin.module#AdminModule'
  },
  {
    path: 'my-account',
    loadChildren: './+my-account/my-account.module#MyAccountModule'
  },
  {
    path: 'accounts',
    loadChildren: './+accounts/accounts.module#AccountsModule'
  },
  {
    path: 'video-channels',
    loadChildren: './+video-channels/video-channels.module#VideoChannelsModule'
  }
]

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      useHash: Boolean(history.pushState) === false,
      preloadingStrategy: PreloadSelectedModulesList
    })
  ],
  providers: [
    PreloadSelectedModulesList
  ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}

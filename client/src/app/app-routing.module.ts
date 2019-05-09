import { NgModule } from '@angular/core'
import { RouteReuseStrategy, RouterModule, Routes } from '@angular/router'

import { PreloadSelectedModulesList } from './core'
import { AppComponent } from '@app/app.component'
import { CustomReuseStrategy } from '@app/core/routing/custom-reuse-strategy'

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
    path: 'verify-account',
    loadChildren: './+verify-account/verify-account.module#VerifyAccountModule'
  },
  {
    path: 'accounts',
    loadChildren: './+accounts/accounts.module#AccountsModule'
  },
  {
    path: 'video-channels',
    loadChildren: './+video-channels/video-channels.module#VideoChannelsModule'
  },
  {
    path: 'about',
    loadChildren: './+about/about.module#AboutModule'
  },
  {
    path: '',
    component: AppComponent // Avoid 404, app component will redirect dynamically
  },
  {
    path: '**',
    loadChildren: './+page-not-found/page-not-found.module#PageNotFoundModule'
  }
]

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      useHash: Boolean(history.pushState) === false,
      scrollPositionRestoration: 'disabled',
      preloadingStrategy: PreloadSelectedModulesList,
      anchorScrolling: 'disabled'
    })
  ],
  providers: [
    PreloadSelectedModulesList,
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy }
  ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}

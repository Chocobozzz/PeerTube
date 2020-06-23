import { NgModule } from '@angular/core'
import { RouteReuseStrategy, RouterModule, Routes } from '@angular/router'
import { AppComponent } from '@app/app.component'
import { CustomReuseStrategy } from '@app/core/routing/custom-reuse-strategy'
import { MenuGuards } from '@app/core/routing/menu-guard.service'
import { PreloadSelectedModulesList } from './core'
import { EmptyComponent } from './empty.component'

const routes: Routes = [
  {
    path: 'admin',
    canActivate: [ MenuGuards.close() ],
    canDeactivate: [ MenuGuards.open() ],
    loadChildren: () => import('./+admin/admin.module').then(m => m.AdminModule)
  },
  {
    path: 'my-account',
    loadChildren: () => import('./+my-account/my-account.module').then(m => m.MyAccountModule)
  },
  {
    path: 'verify-account',
    loadChildren: () => import('./+signup/+verify-account/verify-account.module').then(m => m.VerifyAccountModule)
  },
  {
    path: 'accounts',
    loadChildren: () => import('./+accounts/accounts.module').then(m => m.AccountsModule)
  },
  {
    path: 'video-channels',
    loadChildren: () => import('./+video-channels/video-channels.module').then(m => m.VideoChannelsModule)
  },
  {
    path: 'about',
    loadChildren: () => import('./+about/about.module').then(m => m.AboutModule)
  },
  {
    path: 'signup',
    loadChildren: () => import('./+signup/+register/register.module').then(m => m.RegisterModule)
  },
  {
    path: 'reset-password',
    loadChildren: () => import('./+reset-password/reset-password.module').then(m => m.ResetPasswordModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./+login/login.module').then(m => m.LoginModule)
  },
  {
    path: 'search',
    loadChildren: () => import('./+search/search.module').then(m => m.SearchModule)
  },
  {
    path: 'videos',
    loadChildren: () => import('./+videos/videos.module').then(m => m.VideosModule)
  },
  {
    path: '',
    component: EmptyComponent // Avoid 404, app component will redirect dynamically
  },
  {
    path: '**',
    loadChildren: () => import('./+page-not-found/page-not-found.module').then(m => m.PageNotFoundModule)
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
    MenuGuards.guards,
    PreloadSelectedModulesList,
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy }
  ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}

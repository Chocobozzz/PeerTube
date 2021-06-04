import { NgModule } from '@angular/core'
import { RouteReuseStrategy, RouterModule, Routes, UrlMatchResult, UrlSegment } from '@angular/router'
import { CustomReuseStrategy } from '@app/core/routing/custom-reuse-strategy'
import { MenuGuards } from '@app/core/routing/menu-guard.service'
import { POSSIBLE_LOCALES } from '@shared/core-utils/i18n'
import { HomepageRedirectComponent, MetaGuard, PreloadSelectedModulesList } from './core'
import { EmptyComponent } from './empty.component'
import { USER_USERNAME_REGEX_CHARACTERS } from './shared/form-validators/user-validators'
import { ActorRedirectGuard } from './shared/shared-main'

const routes: Routes = [
  {
    path: 'admin',
    canActivate: [ MenuGuards.close() ],
    canDeactivate: [ MenuGuards.open() ],
    loadChildren: () => import('./+admin/admin.module').then(m => m.AdminModule),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'home',
    loadChildren: () => import('./+home/home.module').then(m => m.HomeModule),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'my-account',
    loadChildren: () => import('./+my-account/my-account.module').then(m => m.MyAccountModule),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'my-library',
    loadChildren: () => import('./+my-library/my-library.module').then(m => m.MyLibraryModule),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'verify-account',
    loadChildren: () => import('./+signup/+verify-account/verify-account.module').then(m => m.VerifyAccountModule),
    canActivateChild: [ MetaGuard ]
  },

  {
    path: 'accounts',
    redirectTo: 'a'
  },
  {
    path: 'a',
    loadChildren: () => import('./+accounts/accounts.module').then(m => m.AccountsModule),
    canActivateChild: [ MetaGuard ]
  },

  {
    path: 'video-channels',
    redirectTo: 'c'
  },
  {
    path: 'c',
    loadChildren: () => import('./+video-channels/video-channels.module').then(m => m.VideoChannelsModule),
    canActivateChild: [ MetaGuard ]
  },

  {
    path: 'about',
    loadChildren: () => import('./+about/about.module').then(m => m.AboutModule),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'signup',
    loadChildren: () => import('./+signup/+register/register.module').then(m => m.RegisterModule),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'reset-password',
    loadChildren: () => import('./+reset-password/reset-password.module').then(m => m.ResetPasswordModule),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'login',
    loadChildren: () => import('./+login/login.module').then(m => m.LoginModule),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'search',
    loadChildren: () => import('./+search/search.module').then(m => m.SearchModule),
    canActivateChild: [ MetaGuard ]
  },

  {
    path: 'videos/upload',
    loadChildren: () => import('@app/+videos/+video-edit/video-add.module').then(m => m.VideoAddModule),
    data: {
      meta: {
        title: $localize`Upload a video`
      }
    }
  },
  {
    path: 'videos/update/:uuid',
    loadChildren: () => import('@app/+videos/+video-edit/video-update.module').then(m => m.VideoUpdateModule),
    data: {
      meta: {
        title: $localize`Edit a video`
      }
    }
  },

  {
    path: 'videos/watch/playlist',
    redirectTo: 'w/p'
  },
  {
    path: 'videos/watch',
    redirectTo: 'w'
  },
  {
    path: 'w',
    loadChildren: () => import('@app/+videos/+video-watch/video-watch.module').then(m => m.VideoWatchModule),
    data: {
      preload: 5000
    }
  },
  {
    path: 'videos',
    loadChildren: () => import('./+videos/videos.module').then(m => m.VideosModule),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'video-playlists/watch',
    redirectTo: 'videos/watch/playlist'
  },

  {
    path: 'remote-interaction',
    loadChildren: () => import('./+remote-interaction/remote-interaction.module').then(m => m.RemoteInteractionModule),
    canActivateChild: [ MetaGuard ]
  },

  // Matches /@:actorName
  {
    matcher: (url): UrlMatchResult => {
      const regex = new RegExp(`^@(${USER_USERNAME_REGEX_CHARACTERS}+)$`)
      if (url.length !== 1) return null

      const matchResult = url[0].path.match(regex)
      if (!matchResult) return null

      return {
        consumed: url,
        posParams: {
          actorName: new UrlSegment(matchResult[1], {})
        }
      }
    },
    pathMatch: 'full',
    canActivate: [ ActorRedirectGuard ],
    component: EmptyComponent
  },

  {
    path: '',
    component: HomepageRedirectComponent
  }
]

// Avoid 404 when changing language
for (const locale of POSSIBLE_LOCALES) {
  routes.push({
    path: locale,
    component: HomepageRedirectComponent
  })
}

routes.push({
  path: '**',
  loadChildren: () => import('./+page-not-found/page-not-found.module').then(m => m.PageNotFoundModule)
})

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

import { Routes, UrlMatchResult, UrlSegment } from '@angular/router'
import { MenuGuards } from '@app/core/routing/menu-guard.service'
import { POSSIBLE_LOCALES } from '@peertube/peertube-core-utils'
import { MetaGuard } from './core'
import { EmptyComponent } from './empty.component'
import { HomepageRedirectComponent } from './homepage-redirect.component'
import { USER_USERNAME_REGEX_CHARACTERS } from './shared/form-validators/user-validators'
import { ActorRedirectGuard } from './shared/shared-main/router/actor-redirect-guard.service'

const routes: Routes = [
  {
    path: 'admin',
    canActivate: [ MenuGuards.close() ],
    canDeactivate: [ MenuGuards.open() ],
    loadChildren: () => import('./+admin/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'home',
    loadChildren: () => import('./+home/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'my-account',
    loadChildren: () => import('./+my-account/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'my-library',
    loadChildren: () => import('./+my-library/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'verify-account',
    loadChildren: () => import('./+signup/+verify-account/routes'),
    canActivateChild: [ MetaGuard ]
  },

  {
    path: 'accounts',
    redirectTo: 'a'
  },
  {
    path: 'a',
    loadChildren: () => import('./+accounts/routes'),
    canActivateChild: [ MetaGuard ]
  },

  {
    path: 'video-channels',
    redirectTo: 'c'
  },
  {
    path: 'c',
    loadChildren: () => import('./+video-channels/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'manage',
    loadChildren: () => import('./+manage/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'p',
    loadChildren: () => import('./shared/shared-plugin-pages/routes'),
    canActivateChild: [ MetaGuard ],
    data: {
      parentRoute: '/'
    }
  },

  {
    path: 'about',
    loadChildren: () => import('./+about/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'signup',
    loadChildren: () => import('./+signup/+register/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'reset-password',
    loadChildren: () => import('./+reset-password/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'login',
    loadChildren: () => import('./+login/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'search',
    loadChildren: () => import('./+search/routes'),
    canActivateChild: [ MetaGuard ]
  },

  {
    path: 'videos/upload',
    loadChildren: () => import('@app/+videos/+video-edit/add-routes'),
    canActivateChild: [ MetaGuard ],
    data: {
      meta: {
        title: $localize`Upload a video`
      }
    }
  },
  {
    path: 'videos/update/:uuid',
    loadChildren: () => import('@app/+videos/+video-edit/update-routes'),
    canActivateChild: [ MetaGuard ],
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
    loadChildren: () => import('@app/+videos/+video-watch/routes'),
    data: {
      preload: 5000
    }
  },
  {
    path: 'videos',
    loadChildren: () => import('./+videos/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'video-playlists/watch',
    redirectTo: 'videos/watch/playlist'
  },

  {
    path: 'remote-interaction',
    loadChildren: () => import('./+remote-interaction/routes'),
    canActivateChild: [ MetaGuard ]
  },

  {
    path: 'studio',
    loadChildren: () => import('./+video-studio/routes'),
    canActivateChild: [ MetaGuard ]
  },

  {
    path: 'stats',
    loadChildren: () => import('./+stats/routes'),
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
  loadChildren: () => import('./+error-page/routes')
})

export default routes

import { Routes, UrlMatchResult, UrlSegment } from '@angular/router'
import { AVAILABLE_LOCALES } from '@peertube/peertube-core-utils'
import { MetaGuard } from './core'
import { EmptyComponent } from './empty.component'
import { HomepageRedirectComponent } from './homepage-redirect.component'
import { USER_USERNAME_REGEX_CHARACTERS } from './shared/form-validators/user-validators'
import { ActorRedirectGuard } from './shared/shared-main/router/actor-redirect-guard.service'
import { VideosParentComponent } from './videos-parent.component'

const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./+admin/routes'),
    canActivateChild: [ MetaGuard ]
  },

  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------

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
    path: 'manage/create',
    redirectTo: '/my-library/video-channels/create',
    pathMatch: 'full'
  },

  {
    path: 'manage/update/:channel',
    pathMatch: 'full',
    redirectTo: '/my-library/video-channels/update/:channel'
  },

  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------

  {
    path: 'studio/edit/:videoId',
    redirectTo: '/videos/manage/:videoId/studio',
    pathMatch: 'full'
  },

  {
    path: 'stats/videos/:videoId',
    redirectTo: '/videos/manage/:videoId/stats',
    pathMatch: 'full'
  },

  {
    path: 'videos/upload',
    redirectTo: '/videos/publish',
    pathMatch: 'full'
  },
  {
    path: 'videos/update/:uuid',
    pathMatch: 'full',
    redirectTo: '/videos/manage/:uuid'
  },

  {
    path: 'videos/manage/:uuid',
    loadChildren: () => import('./+videos-publish-manage/+video-manage/routes'),
    canActivateChild: [ MetaGuard ],
    data: {
      meta: {
        title: $localize`Manage your video`
      }
    }
  },

  {
    path: 'videos/publish',
    loadChildren: () => import('./+videos-publish-manage/+video-publish/routes'),
    canActivateChild: [ MetaGuard ],
    data: {
      meta: {
        title: $localize`Publish your video`
      }
    }
  },

  // ---------------------------------------------------------------------------

  {
    path: 'video-playlists/watch',
    redirectTo: 'w/p'
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
    loadChildren: () => import('./+video-watch/routes'),
    data: {
      preload: 5000
    }
  },

  // ---------------------------------------------------------------------------
  // /home and other /videos routes
  // ---------------------------------------------------------------------------
  {
    matcher: (url): UrlMatchResult => {
      if (url.length < 1) return null

      const matchResult = url[0].path === 'home' || url[0].path === 'videos'
      if (!matchResult) return null

      // So the children can detect the appropriate route
      return { consumed: [] }
    },
    component: VideosParentComponent,
    children: [
      {
        path: 'home',
        loadChildren: () => import('./+home/routes'),
        canActivateChild: [ MetaGuard ]
      },
      {
        path: 'videos',
        loadChildren: () => import('./+video-list/routes'),
        canActivateChild: [ MetaGuard ]
      }
    ]
  },

  // ---------------------------------------------------------------------------

  {
    path: 'remote-interaction',
    loadChildren: () => import('./+remote-interaction/routes'),
    canActivateChild: [ MetaGuard ]
  },

  // ---------------------------------------------------------------------------
  // /@:actorName
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------

  {
    path: '',
    component: HomepageRedirectComponent
  }
]

// Avoid 404 when changing language
for (const locale of AVAILABLE_LOCALES) {
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

import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, ResolveFn, RouterStateSnapshot, Routes } from '@angular/router'
import { CanDeactivateGuard, ServerService, UserRightGuard } from '@app/core'
import { CustomPageService } from '@app/shared/shared-main/custom-page/custom-page.service'
import { CustomConfig, UserRight, VideoConstant } from '@peertube/peertube-models'
import { map } from 'rxjs'
import { AdminConfigComponent } from './admin-config.component'
import {
  AdminConfigAdvancedComponent,
  AdminConfigGeneralComponent,
  AdminConfigHomepageComponent,
  AdminConfigInformationComponent,
  AdminConfigLiveComponent,
  AdminConfigVODComponent
} from './pages'
import { AdminConfigCustomizationComponent } from './pages/admin-config-customization.component'
import { AdminConfigService } from './shared/admin-config.service'

export const customConfigResolver: ResolveFn<CustomConfig> = (_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
  return inject(AdminConfigService).getCustomConfig()
}

export const homepageResolver: ResolveFn<string> = (_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
  return inject(CustomPageService).getInstanceHomepage()
    .pipe(map(({ content }) => content))
}

export const categoriesResolver: ResolveFn<VideoConstant<number>[]> = (_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
  return inject(ServerService).getVideoCategories()
}

export const languagesResolver: ResolveFn<VideoConstant<string>[]> = (_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
  return inject(ServerService).getVideoLanguages()
}

export const configRoutes: Routes = [
  {
    path: 'config',
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_CONFIGURATION
    },
    resolve: {
      customConfig: customConfigResolver
    },
    component: AdminConfigComponent,
    children: [
      {
        // Old path with PeerTube < 7.3
        path: 'edit-custom',
        redirectTo: 'information',
        pathMatch: 'full'
      },
      {
        path: '',
        redirectTo: 'information',
        pathMatch: 'full'
      },
      {
        path: 'homepage',
        component: AdminConfigHomepageComponent,
        canDeactivate: [ CanDeactivateGuard ],
        resolve: {
          homepageContent: homepageResolver
        },
        data: {
          meta: {
            title: $localize`Edit your platform homepage`
          }
        }
      },
      {
        path: 'customization',
        component: AdminConfigCustomizationComponent,
        canDeactivate: [ CanDeactivateGuard ],
        data: {
          meta: {
            title: $localize`Platform customization`
          }
        }
      },
      {
        path: 'information',
        component: AdminConfigInformationComponent,
        canDeactivate: [ CanDeactivateGuard ],
        resolve: {
          categories: categoriesResolver,
          languages: languagesResolver
        },
        data: {
          meta: {
            title: $localize`Platform information`
          }
        }
      },
      {
        path: 'general',
        component: AdminConfigGeneralComponent,
        canDeactivate: [ CanDeactivateGuard ],
        data: {
          meta: {
            title: $localize`General configuration`
          }
        }
      },
      {
        path: 'vod',
        component: AdminConfigVODComponent,
        canDeactivate: [ CanDeactivateGuard ],
        data: {
          meta: {
            title: $localize`VOD configuration`
          }
        }
      },
      {
        path: 'live',
        component: AdminConfigLiveComponent,
        canDeactivate: [ CanDeactivateGuard ],
        data: {
          meta: {
            title: $localize`Live configuration`
          }
        }
      },
      {
        path: 'advanced',
        component: AdminConfigAdvancedComponent,
        canDeactivate: [ CanDeactivateGuard ],
        data: {
          meta: {
            title: $localize`Advanced configuration`
          }
        }
      }
    ]
  }
]

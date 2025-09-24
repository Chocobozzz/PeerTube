import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, ResolveFn, RouterStateSnapshot, Routes } from '@angular/router'
import { CanDeactivateGuard, ServerService, UserRightGuard } from '@app/core'
import { CustomPageService } from '@app/shared/shared-main/custom-page/custom-page.service'
import { CustomConfig, UserRight, VideoCommentPolicyType, VideoConstant, VideoPrivacyType } from '@peertube/peertube-models'
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
import { AdminConfigService } from '../../shared/shared-admin/admin-config.service'
import { AdminConfigLogoComponent } from './pages/admin-config-logo.component'
import { InstanceLogoService } from '../../shared/shared-instance/instance-logo.service'
import { PlayerSettingsService } from '@app/shared/shared-video/player-settings.service'

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

export const licencesResolver: ResolveFn<VideoConstant<number>[]> = (_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
  return inject(ServerService).getVideoLicences()
}

export const privaciesResolver: ResolveFn<VideoConstant<VideoPrivacyType>[]> = (
  _route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot
) => {
  return inject(ServerService).getVideoPrivacies()
}

export const commentPoliciesResolver: ResolveFn<VideoConstant<VideoCommentPolicyType>[]> = (
  _route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot
) => {
  return inject(ServerService).getCommentPolicies()
}

export const logosResolver: ResolveFn<ReturnType<InstanceLogoService['getAllLogos']>> = (
  _route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot
) => {
  return inject(InstanceLogoService).getAllLogos()
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
    providers: [
      InstanceLogoService,
      PlayerSettingsService
    ],
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
        path: 'logo',
        component: AdminConfigLogoComponent,
        canDeactivate: [ CanDeactivateGuard ],
        resolve: {
          logos: logosResolver
        },
        data: {
          meta: {
            title: $localize`Platform logos`
          }
        }
      },
      {
        path: 'general',
        component: AdminConfigGeneralComponent,
        canDeactivate: [ CanDeactivateGuard ],
        resolve: {
          privacies: privaciesResolver,
          licences: licencesResolver,
          commentPolicies: commentPoliciesResolver
        },
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

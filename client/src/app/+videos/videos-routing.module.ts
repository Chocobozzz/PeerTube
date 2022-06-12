import { NgModule } from '@angular/core'
import { RouterModule, Routes, UrlSegment } from '@angular/router'
import { LoginGuard } from '@app/core'
import { VideosListCommonPageComponent } from './video-list'
import { VideoOverviewComponent } from './video-list/overview/video-overview.component'
import { VideoUserSubscriptionsComponent } from './video-list/video-user-subscriptions.component'

const videosRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'overview',
        component: VideoOverviewComponent,
        data: {
          meta: {
            title: $localize`Discover videos`
          }
        }
      },

      {
        // Old URL redirection
        path: 'most-liked',
        redirectTo: 'trending?sort=most-liked'
      },
      {
        matcher: (url: UrlSegment[]) => {
          if (url.length === 1 && [ 'recently-added', 'trending', 'local' ].includes(url[0].path)) {
            return {
              consumed: url,
              posParams: {
                page: new UrlSegment(url[0].path, {})
              }
            }
          }

          return null
        },

        component: VideosListCommonPageComponent,
        data: {
          reuse: {
            enabled: true,
            key: 'videos-list'
          }
        }
      },

      {
        path: 'subscriptions',
        canActivate: [ LoginGuard ],
        component: VideoUserSubscriptionsComponent,
        data: {
          meta: {
            title: $localize`Subscriptions`
          },
          reuse: {
            enabled: true,
            key: 'subscription-videos-list'
          }
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videosRoutes) ],
  exports: [ RouterModule ]
})
export class VideosRoutingModule {}

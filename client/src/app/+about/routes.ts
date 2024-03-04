import { Routes } from '@angular/router'
import { AboutFollowsComponent } from '@app/+about/about-follows/about-follows.component'
import { AboutInstanceComponent } from '@app/+about/about-instance/about-instance.component'
import { AboutInstanceResolver } from '@app/+about/about-instance/about-instance.resolver'
import { AboutPeertubeComponent } from '@app/+about/about-peertube/about-peertube.component'
import { AboutComponent } from './about.component'
import { InstanceFollowService } from '@app/shared/shared-instance'
import { CustomMarkupService, DynamicElementService } from '@app/shared/shared-custom-markup'

export default [
  {
    path: '',
    component: AboutComponent,
    providers: [
      AboutInstanceResolver,
      InstanceFollowService,
      CustomMarkupService,
      DynamicElementService
    ],
    children: [
      {
        path: '',
        redirectTo: 'instance',
        pathMatch: 'full'
      },
      {
        path: 'instance',
        component: AboutInstanceComponent,
        data: {
          meta: {
            title: $localize`About this instance`
          }
        },
        resolve: {
          instanceData: AboutInstanceResolver
        }
      },
      {
        path: 'contact',
        component: AboutInstanceComponent,
        data: {
          meta: {
            title: $localize`Contact`
          },
          isContact: true
        },
        resolve: {
          instanceData: AboutInstanceResolver
        }
      },
      {
        path: 'peertube',
        component: AboutPeertubeComponent,
        data: {
          meta: {
            title: $localize`About PeerTube`
          }
        }
      },
      {
        path: 'follows',
        component: AboutFollowsComponent,
        data: {
          meta: {
            title: $localize`About this instance's network`
          }
        }
      }
    ]
  }
] satisfies Routes

import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { AboutComponent } from './about.component'
import { AboutInstanceComponent } from '@app/+about/about-instance/about-instance.component'
import { AboutPeertubeComponent } from '@app/+about/about-peertube/about-peertube.component'
import { AboutFollowsComponent } from '@app/+about/about-follows/about-follows.component'
import { AboutInstanceResolver } from '@app/+about/about-instance/about-instance.resolver'

const aboutRoutes: Routes = [
  {
    path: '',
    component: AboutComponent,
    canActivateChild: [ MetaGuard ],
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
            title: 'About this instance'
          }
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
            title: 'About PeerTube'
          }
        }
      },
      {
        path: 'follows',
        component: AboutFollowsComponent,
        data: {
          meta: {
            title: 'About follows'
          }
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(aboutRoutes) ],
  exports: [ RouterModule ]
})
export class AboutRoutingModule {}

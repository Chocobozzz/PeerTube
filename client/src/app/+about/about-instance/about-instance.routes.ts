import { Routes } from '@angular/router'
import { AboutInstanceComponent } from './about-instance.component'
import { AboutInstanceResolver } from './about-instance.resolver'
import { AboutInstanceHomeComponent } from './children/about-instance-home.component'
import { AboutInstanceModerationComponent } from './children/about-instance-moderation.component'
import { AboutInstanceTeamComponent } from './children/about-instance-team.component'
import { AboutInstanceTechComponent } from './children/about-instance-tech.component'

export const aboutInstanceRoutes: Routes = [
  {
    path: 'instance',
    providers: [ AboutInstanceResolver ],
    component: AboutInstanceComponent,
    data: {
      meta: {
        title: $localize`About this platform`
      }
    },
    resolve: {
      instanceData: AboutInstanceResolver
    },
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        component: AboutInstanceHomeComponent
      },
      {
        path: 'support',
        component: AboutInstanceHomeComponent,
        data: {
          isSupport: true
        }
      },
      {
        path: 'team',
        component: AboutInstanceTeamComponent
      },
      {
        path: 'tech',
        component: AboutInstanceTechComponent
      },
      {
        path: 'moderation',
        component: AboutInstanceModerationComponent
      }
    ]
  }
]

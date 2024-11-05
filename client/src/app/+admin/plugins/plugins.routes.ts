import { Routes } from '@angular/router'
import { PluginListInstalledComponent } from '@app/+admin/plugins/plugin-list-installed/plugin-list-installed.component'
import { PluginSearchComponent } from '@app/+admin/plugins/plugin-search/plugin-search.component'
import { PluginShowInstalledComponent } from '@app/+admin/plugins/plugin-show-installed/plugin-show-installed.component'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@peertube/peertube-models'

export const pluginsRoutes: Routes = [
  {
    path: 'plugins',
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_PLUGINS
    },
    children: [
      {
        path: '',
        redirectTo: 'list-installed?pluginType=1',
        pathMatch: 'full'
      },
      {
        path: 'list-installed',
        component: PluginListInstalledComponent,
        data: {
          meta: {
            title: $localize`List installed plugins`
          }
        }
      },
      {
        path: 'search',
        component: PluginSearchComponent,
        data: {
          meta: {
            title: $localize`Search plugins`
          }
        }
      },
      {
        path: 'show/:npmName',
        component: PluginShowInstalledComponent,
        data: {
          meta: {
            title: $localize`Show plugin`
          }
        }
      }
    ]
  }
]

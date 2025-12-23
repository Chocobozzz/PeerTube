import { Routes, UrlSegment } from '@angular/router'
import { VideoCommentListComponent } from './comments'
import { UserCreateComponent, UserListComponent, UserUpdateComponent } from './users'
import { VideoListComponent } from './videos'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@peertube/peertube-models'

function basePathRedirect ({ url }: { url: UrlSegment[] }) {
  return `/admin/overview/${url.map(u => u.path).join('/')}`
}

export const overviewRoutes: Routes = [
  {
    path: 'comments',
    pathMatch: 'prefix',
    redirectTo: basePathRedirect
  },

  {
    path: 'videos',
    pathMatch: 'prefix',
    redirectTo: basePathRedirect
  },

  {
    path: 'users',
    pathMatch: 'prefix',
    redirectTo: basePathRedirect
  },

  {
    path: 'overview',

    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'users'
      },

      {
        path: 'comments',
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.SEE_ALL_COMMENTS
        },
        children: [
          {
            path: '',
            redirectTo: 'list',
            pathMatch: 'full'
          },
          {
            path: 'list',
            component: VideoCommentListComponent,
            data: {
              meta: {
                title: $localize`Comments list`
              }
            }
          }
        ]
      },

      {
        path: 'users',
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.MANAGE_USERS
        },
        children: [
          {
            path: '',
            redirectTo: 'list',
            pathMatch: 'full'
          },
          {
            path: 'list',
            component: UserListComponent,
            data: {
              meta: {
                title: $localize`Users list`
              }
            }
          },
          {
            path: 'create',
            component: UserCreateComponent,
            data: {
              meta: {
                title: $localize`Create a user`
              }
            }
          },
          {
            path: 'update/:id',
            component: UserUpdateComponent,
            data: {
              meta: {
                title: $localize`Update a user`
              }
            }
          }
        ]
      },

      {
        path: 'videos',
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.SEE_ALL_VIDEOS
        },
        children: [
          {
            path: '',
            redirectTo: 'list',
            pathMatch: 'full'
          },
          {
            path: 'list',
            component: VideoListComponent,
            data: {
              meta: {
                title: $localize`Videos list`
              }
            }
          }
        ]
      }
    ]
  }
]

import { Routes } from '@angular/router'
import { commentRoutes } from './comments'
import { usersRoutes } from './users'
import { videosRoutes } from './videos'

export const OverviewRoutes: Routes = [
  ...commentRoutes,
  ...usersRoutes,
  ...videosRoutes
]

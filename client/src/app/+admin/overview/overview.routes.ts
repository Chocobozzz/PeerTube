import { Routes } from '@angular/router'
import { UsersRoutes } from './users'
import { VideosRoutes } from './videos'

export const OverviewRoutes: Routes = [
  ...UsersRoutes,
  ...VideosRoutes
]

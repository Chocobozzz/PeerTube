import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { VideoWatchComponent } from './video-watch.component'

const videoWatchRoutes: Routes = [
  {
    path: 'playlist/:playlistId',
    component: VideoWatchComponent,
    canActivate: [ MetaGuard ]
  },
  {
    path: ':videoId/comments/:commentId',
    redirectTo: ':videoId'
  },
  {
    path: ':videoId',
    component: VideoWatchComponent,
    canActivate: [ MetaGuard ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoWatchRoutes) ],
  exports: [ RouterModule ]
})
export class VideoWatchRoutingModule {}

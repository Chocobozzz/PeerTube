import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { VideoWatchComponent } from './video-watch.component'

const videoWatchRoutes: Routes = [
  {
    path: 'p/:playlistId',
    component: VideoWatchComponent
  },
  {
    path: ':videoId/comments/:commentId',
    redirectTo: ':videoId'
  },
  {
    path: ':videoId',
    component: VideoWatchComponent
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoWatchRoutes) ],
  exports: [ RouterModule ]
})
export class VideoWatchRoutingModule {}

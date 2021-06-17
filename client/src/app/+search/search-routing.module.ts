import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { SearchComponent } from './search.component'
import { ChannelLazyLoadResolver, PlaylistLazyLoadResolver, VideoLazyLoadResolver } from './shared'

const searchRoutes: Routes = [
  {
    path: '',
    component: SearchComponent,
    data: {
      meta: {
        title: $localize`Search`
      }
    }
  },
  {
    path: 'lazy-load-video',
    component: SearchComponent,
    resolve: {
      data: VideoLazyLoadResolver
    }
  },
  {
    path: 'lazy-load-channel',
    component: SearchComponent,
    resolve: {
      data: ChannelLazyLoadResolver
    }
  },
  {
    path: 'lazy-load-playlist',
    component: SearchComponent,
    resolve: {
      data: PlaylistLazyLoadResolver
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(searchRoutes) ],
  exports: [ RouterModule ]
})
export class SearchRoutingModule {}

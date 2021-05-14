import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { ChannelLazyLoadResolver } from './channel-lazy-load.resolver'
import { SearchComponent } from './search.component'
import { VideoLazyLoadResolver } from './video-lazy-load.resolver'

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
  }
]

@NgModule({
  imports: [ RouterModule.forChild(searchRoutes) ],
  exports: [ RouterModule ]
})
export class SearchRoutingModule {}

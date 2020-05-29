import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { SearchComponent } from '@app/search/search.component'
import { MetaGuard } from '@ngx-meta/core'
import { VideoLazyLoadResolver } from './video-lazy-load.resolver'
import { ChannelLazyLoadResolver } from './channel-lazy-load.resolver'

const searchRoutes: Routes = [
  {
    path: 'search',
    component: SearchComponent,
    canActivate: [ MetaGuard ],
    data: {
      meta: {
        title: 'Search'
      }
    }
  },
  {
    path: 'search/lazy-load-video',
    component: SearchComponent,
    canActivate: [ MetaGuard ],
    resolve: {
      data: VideoLazyLoadResolver
    }
  },
  {
    path: 'search/lazy-load-channel',
    component: SearchComponent,
    canActivate: [ MetaGuard ],
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

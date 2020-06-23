import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { ChannelLazyLoadResolver } from './channel-lazy-load.resolver'
import { SearchComponent } from './search.component'
import { VideoLazyLoadResolver } from './video-lazy-load.resolver'

const searchRoutes: Routes = [
  {
    path: '',
    component: SearchComponent,
    canActivate: [ MetaGuard ],
    data: {
      meta: {
        title: 'Search'
      }
    }
  },
  {
    path: 'lazy-load-video',
    component: SearchComponent,
    canActivate: [ MetaGuard ],
    resolve: {
      data: VideoLazyLoadResolver
    }
  },
  {
    path: 'lazy-load-channel',
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

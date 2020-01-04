import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { SearchComponent } from '@app/search/search.component'
import { PrivateGuard } from '../core/routing/private-guard.service'

const searchRoutes: Routes = [
  {
    path: 'search',
    component: SearchComponent,
    canActivate: [ MetaGuard, PrivateGuard ],
    data: {
      meta: {
        title: 'Search'
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(searchRoutes) ],
  exports: [ RouterModule ]
})
export class SearchRoutingModule {}

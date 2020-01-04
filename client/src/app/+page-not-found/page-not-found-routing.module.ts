import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { PageNotFoundComponent } from './page-not-found.component'
import { MetaGuard } from '@ngx-meta/core'
import { PrivateGuard } from '../core/routing/private-guard.service'

const pageNotFoundRoutes: Routes = [
  {
    path: '',
    component: PageNotFoundComponent,
    canActivate: [ MetaGuard, PrivateGuard ],
    data: {
      meta: {
        title: 'Not found'
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(pageNotFoundRoutes) ],
  exports: [ RouterModule ]
})
export class PageNotFoundRoutingModule {}

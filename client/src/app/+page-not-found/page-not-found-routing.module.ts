import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { PageNotFoundComponent } from './page-not-found.component'
import { MenuGuards } from '@app/core'

const pageNotFoundRoutes: Routes = [
  {
    path: '',
    component: PageNotFoundComponent,
    canActivate: [ MenuGuards.close(true) ],
    canDeactivate: [ MenuGuards.open(true) ],
    data: {
      meta: {
        title: $localize`Not found`
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(pageNotFoundRoutes) ],
  exports: [ RouterModule ]
})
export class PageNotFoundRoutingModule {}

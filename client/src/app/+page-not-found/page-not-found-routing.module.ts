import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { PageNotFoundComponent } from './page-not-found.component'

const pageNotFoundRoutes: Routes = [
  {
    path: '',
    component: PageNotFoundComponent
  }
]

@NgModule({
  imports: [ RouterModule.forChild(pageNotFoundRoutes) ],
  exports: [ RouterModule ]
})
export class PageNotFoundRoutingModule {}

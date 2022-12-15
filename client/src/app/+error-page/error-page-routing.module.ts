import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { ErrorPageComponent } from './error-page.component'
import { MenuGuards } from '@app/core'

const errorPageRoutes: Routes = [
  {
    path: '',
    component: ErrorPageComponent,
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
  imports: [ RouterModule.forChild(errorPageRoutes) ],
  exports: [ RouterModule ]
})
export class ErrorPageRoutingModule {}

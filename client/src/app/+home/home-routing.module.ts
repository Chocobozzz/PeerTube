import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { HomeComponent } from './home.component'

const homeRoutes: Routes = [
  {
    path: '',
    component: HomeComponent,
    data: {
      meta: {
        title: $localize`Homepage`
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(homeRoutes) ],
  exports: [ RouterModule ]
})
export class HomeRoutingModule {}

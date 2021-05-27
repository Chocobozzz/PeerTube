import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { HomeComponent } from './home.component'

const homeRoutes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivateChild: [ MetaGuard ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(homeRoutes) ],
  exports: [ RouterModule ]
})
export class HomeRoutingModule {}

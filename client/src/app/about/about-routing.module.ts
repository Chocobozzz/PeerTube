import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { AboutComponent } from './about.component'

const aboutRoutes: Routes = [
  {
    path: 'about',
    component: AboutComponent,
    canActivate: [ MetaGuard ],
    data: {
      meta: {
        title: 'About'
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(aboutRoutes) ],
  exports: [ RouterModule ]
})
export class AboutRoutingModule {}

import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { PageNotFoundRoutingModule } from './page-not-found-routing.module'
import { PageNotFoundComponent } from './page-not-found.component'

@NgModule({
  imports: [
    CommonModule,

    PageNotFoundRoutingModule
  ],

  declarations: [
    PageNotFoundComponent
  ],

  exports: [
    PageNotFoundComponent
  ],

  providers: []
})
export class PageNotFoundModule { }

import { NgModule } from '@angular/core'
import { SharedModule } from '../shared'
import { PageNotFoundComponent } from '@app/+page-not-found/page-not-found.component'
import { PageNotFoundRoutingModule } from '@app/+page-not-found/page-not-found-routing.module'

@NgModule({
  imports: [
    PageNotFoundRoutingModule,
    SharedModule
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

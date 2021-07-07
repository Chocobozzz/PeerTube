import { NgModule } from '@angular/core'
import { SharedCustomMarkupModule } from '@app/shared/shared-custom-markup'
import { SharedMainModule } from '@app/shared/shared-main'
import { HomeRoutingModule } from './home-routing.module'
import { HomeComponent } from './home.component'

@NgModule({
  imports: [
    HomeRoutingModule,

    SharedMainModule,
    SharedCustomMarkupModule
  ],

  declarations: [
    HomeComponent
  ],

  exports: [
    HomeComponent
  ],

  providers: [ ]
})
export class HomeModule { }

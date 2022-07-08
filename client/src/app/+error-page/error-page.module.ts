import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { ErrorPageRoutingModule } from './error-page-routing.module'
import { ErrorPageComponent } from './error-page.component'

@NgModule({
  imports: [
    CommonModule,

    ErrorPageRoutingModule
  ],

  declarations: [
    ErrorPageComponent
  ],

  exports: [
    ErrorPageComponent
  ],

  providers: []
})
export class ErrorPageModule { }

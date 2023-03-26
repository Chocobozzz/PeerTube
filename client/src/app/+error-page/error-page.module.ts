import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { SharedMainModule } from '@app/shared/shared-main'
import { ErrorPageRoutingModule } from './error-page-routing.module'
import { ErrorPageComponent } from './error-page.component'

@NgModule({
  imports: [
    CommonModule,
    SharedMainModule,

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

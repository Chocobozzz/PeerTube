import { NgModule } from '@angular/core'

import { SignupRoutingModule } from './signup-routing.module'
import { SignupComponent } from './signup.component'
import { SharedModule } from '../shared'

@NgModule({
  imports: [
    SignupRoutingModule,
    SharedModule
  ],

  declarations: [
    SignupComponent
  ],

  exports: [
    SignupComponent
  ],

  providers: [
  ]
})
export class SignupModule { }

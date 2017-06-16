import { NgModule } from '@angular/core'

import { LoginRoutingModule } from './login-routing.module'
import { LoginComponent } from './login.component'
import { SharedModule } from '../shared'

@NgModule({
  imports: [
    LoginRoutingModule,
    SharedModule
  ],

  declarations: [
    LoginComponent
  ],

  exports: [
    LoginComponent
  ],

  providers: [
  ]
})
export class LoginModule { }

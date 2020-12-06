import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedInstanceModule } from '@app/shared/shared-instance'
import { SharedMainModule } from '@app/shared/shared-main'
import { LoginRoutingModule } from './login-routing.module'
import { LoginComponent } from './login.component'

@NgModule({
  imports: [
    LoginRoutingModule,

    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,

    SharedInstanceModule
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

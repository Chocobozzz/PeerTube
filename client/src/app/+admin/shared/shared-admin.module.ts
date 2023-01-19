import { NgModule } from '@angular/core'
import { SharedMainModule } from '../../shared/shared-main/shared-main.module'
import { UserEmailInfoComponent } from './user-email-info.component'
import { UserRealQuotaInfoComponent } from './user-real-quota-info.component'

@NgModule({
  imports: [
    SharedMainModule
  ],

  declarations: [
    UserRealQuotaInfoComponent,
    UserEmailInfoComponent
  ],

  exports: [
    UserRealQuotaInfoComponent,
    UserEmailInfoComponent
  ],

  providers: []
})
export class SharedAdminModule { }

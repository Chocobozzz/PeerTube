import { NgModule } from '@angular/core'
import { SharedMainModule } from '../../shared/shared-main/shared-main.module'
import { UserRealQuotaInfoComponent } from './user-real-quota-info.component'

@NgModule({
  imports: [
    SharedMainModule
  ],

  declarations: [
    UserRealQuotaInfoComponent
  ],

  exports: [
    UserRealQuotaInfoComponent
  ],

  providers: []
})
export class SharedAdminModule { }

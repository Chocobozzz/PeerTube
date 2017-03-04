import { NgModule } from '@angular/core';

import { AccountRoutingModule } from './account-routing.module';
import { AccountComponent } from './account.component';
import { AccountService } from './account.service';
import { SharedModule } from '../shared';

@NgModule({
  imports: [
    AccountRoutingModule,
    SharedModule
  ],

  declarations: [
    AccountComponent
  ],

  exports: [
    AccountComponent
  ],

  providers: []
})
export class AccountModule { }

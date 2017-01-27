import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpModule } from '@angular/http';
import { RouterModule } from '@angular/router';

import { SimpleNotificationsModule } from 'angular2-notifications';

import { AuthService } from './auth';
import { MenuComponent, MenuAdminComponent } from './menu';
import { throwIfAlreadyLoaded } from './module-import-guard';

@NgModule({
  imports: [
    CommonModule,
    HttpModule,
    RouterModule,

    SimpleNotificationsModule
  ],
  declarations: [
    MenuComponent,
    MenuAdminComponent
  ],
  exports: [
    SimpleNotificationsModule,

    MenuComponent,
    MenuAdminComponent
  ],
  providers: [ AuthService ]
})
export class CoreModule {
   constructor( @Optional() @SkipSelf() parentModule: CoreModule) {
    throwIfAlreadyLoaded(parentModule, 'CoreModule');
  }
}

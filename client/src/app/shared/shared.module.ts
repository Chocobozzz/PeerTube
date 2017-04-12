import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpModule } from '@angular/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { BytesPipe } from 'angular-pipes/src/math/bytes.pipe';
import { KeysPipe } from 'angular-pipes/src/object/keys.pipe';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { ProgressbarModule } from 'ngx-bootstrap/progressbar';
import { PaginationModule } from 'ngx-bootstrap/pagination';
import { ModalModule } from 'ngx-bootstrap/modal';
import { FileUploadModule } from 'ng2-file-upload/ng2-file-upload';
import { Ng2SmartTableModule } from 'ng2-smart-table';

import { AUTH_HTTP_PROVIDERS } from './auth';
import { RestExtractor, RestService } from './rest';
import { SearchComponent, SearchService } from './search';
import { UserService } from './users';
import { VideoAbuseService } from './video-abuse';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpModule,
    RouterModule,

    BsDropdownModule.forRoot(),
    ModalModule.forRoot(),
    PaginationModule.forRoot(),
    ProgressbarModule.forRoot(),

    FileUploadModule,
    Ng2SmartTableModule
  ],

  declarations: [
    BytesPipe,
    KeysPipe,
    SearchComponent
  ],

  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpModule,
    RouterModule,

    BsDropdownModule,
    FileUploadModule,
    ModalModule,
    PaginationModule,
    ProgressbarModule,
    Ng2SmartTableModule,
    BytesPipe,
    KeysPipe,

    SearchComponent
  ],

  providers: [
    AUTH_HTTP_PROVIDERS,
    RestExtractor,
    RestService,
    SearchService,
    VideoAbuseService,
    UserService
  ]
})
export class SharedModule { }

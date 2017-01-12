import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpModule } from '@angular/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { BytesPipe } from 'angular-pipes/src/math/bytes.pipe';
import { DropdownModule } from 'ng2-bootstrap/dropdown';
import { ProgressbarModule } from 'ng2-bootstrap/progressbar';
import { PaginationModule } from 'ng2-bootstrap/pagination';
import { ModalModule } from 'ng2-bootstrap/modal';
import { FileUploadModule } from 'ng2-file-upload/ng2-file-upload';

import { AUTH_HTTP_PROVIDERS } from './auth';
import { RestExtractor, RestService } from './rest';
import { SearchComponent, SearchService } from './search';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpModule,
    RouterModule,

    DropdownModule.forRoot(),
    ModalModule.forRoot(),
    PaginationModule.forRoot(),
    ProgressbarModule.forRoot(),

    FileUploadModule
  ],

  declarations: [
    BytesPipe,
    SearchComponent
  ],

  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpModule,
    RouterModule,

    DropdownModule,
    FileUploadModule,
    ModalModule,
    PaginationModule,
    ProgressbarModule,
    BytesPipe,

    SearchComponent
  ],

  providers: [
    AUTH_HTTP_PROVIDERS,
    RestExtractor,
    RestService,
    SearchService
  ]
})
export class SharedModule { }

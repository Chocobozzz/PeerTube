import { NgModule } from '@angular/core'
import { HttpClientModule } from '@angular/common/http'
import { CommonModule } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'

import { BytesPipe } from 'angular-pipes/src/math/bytes.pipe'
import { KeysPipe } from 'angular-pipes/src/object/keys.pipe'
import { BsDropdownModule } from 'ngx-bootstrap/dropdown'
import { ProgressbarModule } from 'ngx-bootstrap/progressbar'
import { PaginationModule } from 'ngx-bootstrap/pagination'
import { ModalModule } from 'ngx-bootstrap/modal'
import { FileUploadModule } from 'ng2-file-upload/ng2-file-upload'
import { DataTableModule, SharedModule as PrimeSharedModule } from 'primeng/primeng'

import { AUTH_INTERCEPTOR_PROVIDER } from './auth'
import { RestExtractor, RestService } from './rest'
import { SearchComponent, SearchService } from './search'
import { UserService } from './users'
import { VideoAbuseService } from './video-abuse'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    BsDropdownModule.forRoot(),
    ModalModule.forRoot(),
    PaginationModule.forRoot(),
    ProgressbarModule.forRoot(),

    FileUploadModule,

    DataTableModule,
    PrimeSharedModule
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
    RouterModule,
    HttpClientModule,

    BsDropdownModule,
    FileUploadModule,
    ModalModule,
    PaginationModule,
    ProgressbarModule,
    DataTableModule,
    PrimeSharedModule,
    BytesPipe,
    KeysPipe,

    SearchComponent
  ],

  providers: [
    AUTH_INTERCEPTOR_PROVIDER,
    RestExtractor,
    RestService,
    SearchService,
    VideoAbuseService,
    UserService
  ]
})
export class SharedModule { }

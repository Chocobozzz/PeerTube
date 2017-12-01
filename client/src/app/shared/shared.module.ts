import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'

import { BsDropdownModule } from 'ngx-bootstrap/dropdown'
import { ModalModule } from 'ngx-bootstrap/modal'
import { ProgressbarModule } from 'ngx-bootstrap/progressbar'
import { BytesPipe, KeysPipe } from 'ngx-pipes'
import { SharedModule as PrimeSharedModule } from 'primeng/components/common/shared'
import { DataTableModule } from 'primeng/components/datatable/datatable'

import { AUTH_INTERCEPTOR_PROVIDER } from './auth'
import { FromNowPipe } from './misc/from-now.pipe'
import { LoaderComponent } from './misc/loader.component'
import { NumberFormatterPipe } from './misc/number-formatter.pipe'
import { RestExtractor, RestService } from './rest'
import { SearchComponent, SearchService } from './search'
import { UserService } from './users'
import { VideoAbuseService } from './video-abuse'
import { VideoBlacklistService } from './video-blacklist'
import { VideoThumbnailComponent } from './video/video-thumbnail.component'
import { VideoService } from './video/video.service'
import { InfiniteScrollModule } from 'ngx-infinite-scroll'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    BsDropdownModule.forRoot(),
    ModalModule.forRoot(),
    ProgressbarModule.forRoot(),

    DataTableModule,
    PrimeSharedModule,
    InfiniteScrollModule
  ],

  declarations: [
    BytesPipe,
    KeysPipe,
    SearchComponent,
    LoaderComponent,
    VideoThumbnailComponent,
    NumberFormatterPipe,
    FromNowPipe
  ],

  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    BsDropdownModule,
    ModalModule,
    ProgressbarModule,
    DataTableModule,
    PrimeSharedModule,
    InfiniteScrollModule,
    BytesPipe,
    KeysPipe,

    SearchComponent,
    LoaderComponent,
    VideoThumbnailComponent,

    NumberFormatterPipe,
    FromNowPipe
  ],

  providers: [
    AUTH_INTERCEPTOR_PROVIDER,
    RestExtractor,
    RestService,
    SearchService,
    VideoAbuseService,
    VideoBlacklistService,
    UserService,
    VideoService
  ]
})
export class SharedModule { }

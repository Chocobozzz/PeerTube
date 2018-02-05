import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { MarkdownTextareaComponent } from '@app/shared/forms/markdown-textarea.component'
import { MarkdownService } from '@app/videos/shared'
import { LoadingBarHttpClientModule } from '@ngx-loading-bar/http-client'

import { BsDropdownModule } from 'ngx-bootstrap/dropdown'
import { ModalModule } from 'ngx-bootstrap/modal'
import { TabsModule } from 'ngx-bootstrap/tabs'
import { InfiniteScrollModule } from 'ngx-infinite-scroll'
import { BytesPipe, KeysPipe, NgPipesModule } from 'ngx-pipes'
import { SharedModule as PrimeSharedModule } from 'primeng/components/common/shared'

import { AUTH_INTERCEPTOR_PROVIDER } from './auth'
import { DeleteButtonComponent } from './misc/delete-button.component'
import { EditButtonComponent } from './misc/edit-button.component'
import { FromNowPipe } from './misc/from-now.pipe'
import { LoaderComponent } from './misc/loader.component'
import { NumberFormatterPipe } from './misc/number-formatter.pipe'
import { RestExtractor, RestService } from './rest'
import { UserService } from './users'
import { VideoAbuseService } from './video-abuse'
import { VideoBlacklistService } from './video-blacklist'
import { VideoMiniatureComponent } from './video/video-miniature.component'
import { VideoThumbnailComponent } from './video/video-thumbnail.component'
import { VideoService } from './video/video.service'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    LoadingBarHttpClientModule,

    BsDropdownModule.forRoot(),
    ModalModule.forRoot(),

    PrimeSharedModule,
    InfiniteScrollModule,
    NgPipesModule,
    TabsModule.forRoot()
  ],

  declarations: [
    LoaderComponent,
    VideoThumbnailComponent,
    VideoMiniatureComponent,
    DeleteButtonComponent,
    EditButtonComponent,
    NumberFormatterPipe,
    FromNowPipe,
    MarkdownTextareaComponent
  ],

  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    LoadingBarHttpClientModule,

    BsDropdownModule,
    ModalModule,
    PrimeSharedModule,
    InfiniteScrollModule,
    BytesPipe,
    KeysPipe,

    LoaderComponent,
    VideoThumbnailComponent,
    VideoMiniatureComponent,
    DeleteButtonComponent,
    EditButtonComponent,
    MarkdownTextareaComponent,

    NumberFormatterPipe,
    FromNowPipe
  ],

  providers: [
    AUTH_INTERCEPTOR_PROVIDER,
    RestExtractor,
    RestService,
    VideoAbuseService,
    VideoBlacklistService,
    UserService,
    VideoService,
    MarkdownService
  ]
})
export class SharedModule { }

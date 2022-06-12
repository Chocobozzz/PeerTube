import { SharedModule as PrimeSharedModule } from 'primeng/api'
import { ClipboardModule } from '@angular/cdk/clipboard'
import { CommonModule, DatePipe } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import {
  NgbButtonsModule,
  NgbCollapseModule,
  NgbDropdownModule,
  NgbModalModule,
  NgbNavModule,
  NgbPopoverModule,
  NgbTooltipModule
} from '@ng-bootstrap/ng-bootstrap'
import { LoadingBarModule } from '@ngx-loading-bar/core'
import { LoadingBarHttpClientModule } from '@ngx-loading-bar/http-client'
import { SharedGlobalIconModule } from '../shared-icons'
import { AccountService } from './account'
import {
  AutofocusDirective,
  BytesPipe,
  DurationFormatterPipe,
  FromNowPipe,
  InfiniteScrollerDirective,
  LinkComponent,
  NumberFormatterPipe,
  PeerTubeTemplateDirective
} from './angular'
import { AUTH_INTERCEPTOR_PROVIDER } from './auth'
import { ActionDropdownComponent, ButtonComponent, DeleteButtonComponent, EditButtonComponent } from './buttons'
import { CustomPageService } from './custom-page'
import { DateToggleComponent } from './date'
import { FeedComponent } from './feeds'
import { LoaderComponent, SmallLoaderComponent } from './loaders'
import {
  ChannelsSetupMessageComponent,
  HelpComponent,
  ListOverflowComponent,
  SimpleSearchInputComponent,
  TopMenuDropdownComponent
} from './misc'
import { PluginPlaceholderComponent, PluginSelectorDirective } from './plugins'
import { ActorRedirectGuard } from './router'
import { UserHistoryService, UserNotificationsComponent, UserNotificationService, UserQuotaComponent } from './users'
import { EmbedComponent, RedundancyService, VideoImportService, VideoOwnershipService, VideoService } from './video'
import { VideoCaptionService } from './video-caption'
import { VideoChannelService } from './video-channel'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    LoadingBarHttpClientModule,
    LoadingBarModule,

    NgbDropdownModule,
    NgbModalModule,
    NgbPopoverModule,
    NgbNavModule,
    NgbTooltipModule,
    NgbCollapseModule,
    NgbButtonsModule,

    ClipboardModule,

    PrimeSharedModule,

    SharedGlobalIconModule
  ],

  declarations: [
    FromNowPipe,
    NumberFormatterPipe,
    BytesPipe,
    DurationFormatterPipe,
    AutofocusDirective,

    InfiniteScrollerDirective,
    PeerTubeTemplateDirective,
    LinkComponent,

    ActionDropdownComponent,
    ButtonComponent,
    DeleteButtonComponent,
    EditButtonComponent,

    DateToggleComponent,

    FeedComponent,

    LoaderComponent,
    SmallLoaderComponent,

    ChannelsSetupMessageComponent,
    HelpComponent,
    ListOverflowComponent,
    TopMenuDropdownComponent,
    SimpleSearchInputComponent,

    UserQuotaComponent,
    UserNotificationsComponent,

    EmbedComponent,

    PluginPlaceholderComponent,
    PluginSelectorDirective
  ],

  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,

    LoadingBarHttpClientModule,
    LoadingBarModule,

    NgbDropdownModule,
    NgbModalModule,
    NgbPopoverModule,
    NgbNavModule,
    NgbTooltipModule,
    NgbCollapseModule,
    NgbButtonsModule,

    ClipboardModule,

    PrimeSharedModule,

    FromNowPipe,
    BytesPipe,
    NumberFormatterPipe,
    DurationFormatterPipe,
    AutofocusDirective,

    InfiniteScrollerDirective,
    PeerTubeTemplateDirective,
    LinkComponent,

    ActionDropdownComponent,
    ButtonComponent,
    DeleteButtonComponent,
    EditButtonComponent,

    DateToggleComponent,

    FeedComponent,

    LoaderComponent,
    SmallLoaderComponent,

    ChannelsSetupMessageComponent,
    HelpComponent,
    ListOverflowComponent,
    TopMenuDropdownComponent,
    SimpleSearchInputComponent,

    UserQuotaComponent,
    UserNotificationsComponent,

    EmbedComponent,

    PluginPlaceholderComponent,
    PluginSelectorDirective
  ],

  providers: [
    DatePipe,

    FromNowPipe,

    AUTH_INTERCEPTOR_PROVIDER,

    AccountService,

    UserHistoryService,
    UserNotificationService,

    RedundancyService,
    VideoImportService,
    VideoOwnershipService,
    VideoService,

    VideoCaptionService,

    VideoChannelService,

    CustomPageService,

    ActorRedirectGuard
  ]
})
export class SharedMainModule { }

import { AutoCompleteModule } from 'primeng/autocomplete'
import { TableModule } from 'primeng/table'
import { DragDropModule } from '@angular/cdk/drag-drop'
import { NgModule } from '@angular/core'
import { SharedAbuseListModule } from '@app/shared/shared-abuse-list'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedModerationModule } from '@app/shared/shared-moderation'
import { SharedShareModal } from '@app/shared/shared-share-modal'
import { SharedTablesModule } from '@app/shared/shared-tables'
import { SharedUserInterfaceSettingsModule } from '@app/shared/shared-user-settings'
import { SharedUserSubscriptionModule } from '@app/shared/shared-user-subscription/shared-user-subscription.module'
import { SharedVideoLiveModule } from '@app/shared/shared-video-live'
import { SharedVideoMiniatureModule } from '@app/shared/shared-video-miniature'
import { SharedVideoPlaylistModule } from '@app/shared/shared-video-playlist/shared-video-playlist.module'
import { SharedActorImageModule } from '../shared/shared-actor-image/shared-actor-image.module'
import { MyFollowersComponent } from './my-follows/my-followers.component'
import { MySubscriptionsComponent } from './my-follows/my-subscriptions.component'
import { MyHistoryComponent } from './my-history/my-history.component'
import { MyLibraryRoutingModule } from './my-library-routing.module'
import { MyLibraryComponent } from './my-library.component'
import { MyAcceptOwnershipComponent } from './my-ownership/my-accept-ownership/my-accept-ownership.component'
import { MyOwnershipComponent } from './my-ownership/my-ownership.component'
import { MyVideoImportsComponent } from './my-video-imports/my-video-imports.component'
import { MyVideoPlaylistCreateComponent } from './my-video-playlists/my-video-playlist-create.component'
import { MyVideoPlaylistElementsComponent } from './my-video-playlists/my-video-playlist-elements.component'
import { MyVideoPlaylistUpdateComponent } from './my-video-playlists/my-video-playlist-update.component'
import { MyVideoPlaylistsComponent } from './my-video-playlists/my-video-playlists.component'
import { VideoChangeOwnershipComponent } from './my-videos/modals/video-change-ownership.component'
import { MyVideosComponent } from './my-videos/my-videos.component'
import { MyVideoChannelSyncsComponent } from './my-video-channel-syncs/my-video-channel-syncs.component'
import { VideoChannelSyncEditComponent } from './my-video-channel-syncs/video-channel-sync-edit/video-channel-sync-edit.component'

@NgModule({
  imports: [
    MyLibraryRoutingModule,

    AutoCompleteModule,
    TableModule,
    DragDropModule,

    SharedMainModule,
    SharedFormModule,
    SharedModerationModule,
    SharedVideoMiniatureModule,
    SharedUserSubscriptionModule,
    SharedVideoPlaylistModule,
    SharedUserInterfaceSettingsModule,
    SharedGlobalIconModule,
    SharedAbuseListModule,
    SharedShareModal,
    SharedVideoLiveModule,
    SharedActorImageModule,
    SharedTablesModule
  ],

  declarations: [
    MyLibraryComponent,

    MyVideosComponent,

    VideoChangeOwnershipComponent,

    MyOwnershipComponent,
    MyAcceptOwnershipComponent,
    MyVideoImportsComponent,
    MyVideoChannelSyncsComponent,
    VideoChannelSyncEditComponent,
    MySubscriptionsComponent,
    MyFollowersComponent,
    MyHistoryComponent,

    MyVideoPlaylistCreateComponent,
    MyVideoPlaylistUpdateComponent,
    MyVideoPlaylistsComponent,
    MyVideoPlaylistElementsComponent
  ],

  exports: [
    MyLibraryComponent
  ],

  providers: []
})
export class MyLibraryModule {
}

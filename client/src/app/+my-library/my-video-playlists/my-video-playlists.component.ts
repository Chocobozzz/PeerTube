import { Subject } from 'rxjs'
import { mergeMap } from 'rxjs/operators'
import { Component } from '@angular/core'
import { AuthService, ComponentPagination, ConfirmService, Notifier } from '@app/core'
import { VideoPlaylistType } from '@peertube/peertube-models'
import { EditButtonComponent } from '../../shared/shared-main/buttons/edit-button.component'
import { DeleteButtonComponent } from '../../shared/shared-main/buttons/delete-button.component'
import { VideoPlaylistMiniatureComponent } from '../../shared/shared-video-playlist/video-playlist-miniature.component'
import { InfiniteScrollerDirective } from '../../shared/shared-main/angular/infinite-scroller.directive'
import { RouterLink } from '@angular/router'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { ChannelsSetupMessageComponent } from '../../shared/shared-main/misc/channels-setup-message.component'
import { NgIf, NgFor } from '@angular/common'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'

@Component({
  templateUrl: './my-video-playlists.component.html',
  styleUrls: [ './my-video-playlists.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    NgIf,
    ChannelsSetupMessageComponent,
    AdvancedInputFilterComponent,
    RouterLink,
    InfiniteScrollerDirective,
    NgFor,
    VideoPlaylistMiniatureComponent,
    DeleteButtonComponent,
    EditButtonComponent
  ]
})
export class MyVideoPlaylistsComponent {
  videoPlaylists: VideoPlaylist[] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: null
  }

  onDataSubject = new Subject<any[]>()

  search: string

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private videoPlaylistService: VideoPlaylistService
  ) {}

  async deleteVideoPlaylist (videoPlaylist: VideoPlaylist) {
    const res = await this.confirmService.confirm(
      $localize`Do you really want to delete ${videoPlaylist.displayName}?`,
      $localize`Delete`
    )
    if (res === false) return

    this.videoPlaylistService.removeVideoPlaylist(videoPlaylist)
      .subscribe({
        next: () => {
          this.videoPlaylists = this.videoPlaylists
                                    .filter(p => p.id !== videoPlaylist.id)

          this.notifier.success($localize`Playlist ${videoPlaylist.displayName} deleted.`)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  isRegularPlaylist (playlist: VideoPlaylist) {
    return playlist.type.id === VideoPlaylistType.REGULAR
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadVideoPlaylists()
  }

  onSearch (search: string) {
    this.search = search
    this.loadVideoPlaylists(true)
  }

  private loadVideoPlaylists (reset = false) {
    this.authService.userInformationLoaded
        .pipe(mergeMap(() => {
          const user = this.authService.getUser()

          return this.videoPlaylistService.listAccountPlaylists(user.account, this.pagination, '-updatedAt', this.search)
        })).subscribe(res => {
          if (reset) this.videoPlaylists = []

          this.videoPlaylists = this.videoPlaylists.concat(res.data)
          this.pagination.totalItems = res.total

          this.onDataSubject.next(res.data)
        })
  }
}

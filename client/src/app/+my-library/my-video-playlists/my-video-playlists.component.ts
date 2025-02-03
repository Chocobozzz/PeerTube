import { NgFor, NgIf } from '@angular/common'
import { Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AuthService, ComponentPagination, ConfirmService, Notifier, resetCurrentPage, updatePaginationOnDelete } from '@app/core'
import { formatICU } from '@app/helpers'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { VideoPlaylistType } from '@peertube/peertube-models'
import { Subject } from 'rxjs'
import { mergeMap } from 'rxjs/operators'
import { AdvancedInputFilterComponent } from '../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { DeleteButtonComponent } from '../../shared/shared-main/buttons/delete-button.component'
import { EditButtonComponent } from '../../shared/shared-main/buttons/edit-button.component'
import { InfiniteScrollerDirective } from '../../shared/shared-main/common/infinite-scroller.directive'
import { VideoPlaylistMiniatureComponent } from '../../shared/shared-video-playlist/video-playlist-miniature.component'

@Component({
  templateUrl: './my-video-playlists.component.html',
  styleUrls: [ './my-video-playlists.component.scss' ],
  imports: [
    GlobalIconComponent,
    NgIf,
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
          this.videoPlaylists = this.videoPlaylists.filter(p => p.id !== videoPlaylist.id)
          updatePaginationOnDelete(this.pagination)

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
    resetCurrentPage(this.pagination)

    this.loadVideoPlaylists(true)
  }

  getTotalTitle () {
    return formatICU(
      $localize`${this.pagination.totalItems} {total, plural, =1 {playlist} other {playlists}}`,
      { total: this.pagination.totalItems }
    )
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

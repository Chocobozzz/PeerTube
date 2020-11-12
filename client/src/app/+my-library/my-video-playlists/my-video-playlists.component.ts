import { Subject } from 'rxjs'
import { debounceTime, mergeMap } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { AuthService, ComponentPagination, ConfirmService, Notifier, User } from '@app/core'
import { VideoPlaylist, VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { VideoPlaylistType } from '@shared/models'

@Component({
  templateUrl: './my-video-playlists.component.html',
  styleUrls: [ './my-video-playlists.component.scss' ]
})
export class MyVideoPlaylistsComponent implements OnInit {
  videoPlaylistsSearch: string
  videoPlaylists: VideoPlaylist[] = []
  videoPlaylistSearchChanged = new Subject<string>()

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalItems: null
  }

  onDataSubject = new Subject<any[]>()

  private user: User

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private videoPlaylistService: VideoPlaylistService
    ) {}

  ngOnInit () {
    this.user = this.authService.getUser()

    this.loadVideoPlaylists()

    this.videoPlaylistSearchChanged
      .pipe(
        debounceTime(500))
      .subscribe(() => {
        this.loadVideoPlaylists(true)
      })
  }

  async deleteVideoPlaylist (videoPlaylist: VideoPlaylist) {
    const res = await this.confirmService.confirm(
      $localize`Do you really want to delete ${videoPlaylist.displayName}?`,
      $localize`Delete`
    )
    if (res === false) return

    this.videoPlaylistService.removeVideoPlaylist(videoPlaylist)
      .subscribe(
        () => {
          this.videoPlaylists = this.videoPlaylists
                                    .filter(p => p.id !== videoPlaylist.id)

          this.notifier.success($localize`Playlist ${videoPlaylist.displayName}} deleted.`)
        },

        error => this.notifier.error(error.message)
      )
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

  resetSearch () {
    this.videoPlaylistsSearch = ''
    this.onVideoPlaylistSearchChanged()
  }

  onVideoPlaylistSearchChanged () {
    this.videoPlaylistSearchChanged.next()
  }

  private loadVideoPlaylists (reset = false) {
    this.authService.userInformationLoaded
        .pipe(mergeMap(() => {
          return this.videoPlaylistService.listAccountPlaylists(this.user.account, this.pagination, '-updatedAt', this.videoPlaylistsSearch)
        }))
        .subscribe(res => {
          if (reset) this.videoPlaylists = []
          this.videoPlaylists = this.videoPlaylists.concat(res.data)
          this.pagination.totalItems = res.total

          this.onDataSubject.next(res.data)
        })
  }
}

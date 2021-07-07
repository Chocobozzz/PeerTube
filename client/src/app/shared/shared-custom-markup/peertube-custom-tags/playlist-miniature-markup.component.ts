import { finalize } from 'rxjs/operators'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { Notifier } from '@app/core'
import { MiniatureDisplayOptions } from '../../shared-video-miniature'
import { VideoPlaylist, VideoPlaylistService } from '../../shared-video-playlist'
import { CustomMarkupComponent } from './shared'

/*
 * Markup component that creates a playlist miniature only
*/

@Component({
  selector: 'my-playlist-miniature-markup',
  templateUrl: 'playlist-miniature-markup.component.html',
  styleUrls: [ 'playlist-miniature-markup.component.scss' ]
})
export class PlaylistMiniatureMarkupComponent implements CustomMarkupComponent, OnInit {
  @Input() uuid: string

  @Output() loaded = new EventEmitter<boolean>()

  playlist: VideoPlaylist

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: false,
    privacyLabel: false,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }

  constructor (
    private playlistService: VideoPlaylistService,
    private notifier: Notifier
  ) { }

  ngOnInit () {
    this.playlistService.getVideoPlaylist(this.uuid)
      .pipe(finalize(() => this.loaded.emit(true)))
      .subscribe(
        playlist => this.playlist = playlist,

        err => this.notifier.error('Error in playlist miniature component: ' + err.message)
      )
  }
}

import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
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
    private playlistService: VideoPlaylistService
  ) { }

  ngOnInit () {
    this.playlistService.getVideoPlaylist(this.uuid)
      .subscribe({
        next: playlist => this.playlist = playlist,

        complete: () => this.loaded.emit(true)
      })
  }
}

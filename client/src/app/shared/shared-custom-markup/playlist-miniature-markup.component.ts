import { Component, Input, OnInit } from '@angular/core'
import { AuthService } from '@app/core'
import { MiniatureDisplayOptions } from '../shared-video-miniature'
import { VideoPlaylist, VideoPlaylistService } from '../shared-video-playlist'

/*
 * Markup component that creates a playlist miniature only
*/

@Component({
  selector: 'my-playlist-miniature-markup',
  templateUrl: 'playlist-miniature-markup.component.html',
  styleUrls: [ 'playlist-miniature-markup.component.scss' ]
})
export class PlaylistMiniatureMarkupComponent implements OnInit {
  @Input() uuid: string

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
    private auth: AuthService,
    private playlistService: VideoPlaylistService
  ) { }

  ngOnInit () {
    this.playlistService.getVideoPlaylist(this.uuid)
      .subscribe(playlist => this.playlist = playlist)
  }
}

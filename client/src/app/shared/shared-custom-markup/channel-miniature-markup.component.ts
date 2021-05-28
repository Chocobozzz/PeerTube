import { Component, Input, OnInit } from '@angular/core'
import { VideoChannel, VideoChannelService } from '../shared-main'

/*
 * Markup component that creates a channel miniature only
*/

@Component({
  selector: 'my-channel-miniature-markup',
  templateUrl: 'channel-miniature-markup.component.html',
  styleUrls: [ 'channel-miniature-markup.component.scss' ]
})
export class ChannelMiniatureMarkupComponent implements OnInit {
  @Input() name: string

  channel: VideoChannel

  constructor (
    private channelService: VideoChannelService
  ) { }

  ngOnInit () {
    this.channelService.getVideoChannel(this.name)
      .subscribe(channel => this.channel = channel)
  }
}


import { Component, input, OnInit } from '@angular/core'
import { RouterModule } from '@angular/router'
import { FromNowPipe } from '@app/shared/shared-main/date/from-now.pipe'
import { VideoChannelActivity } from '@peertube/peertube-models'

@Component({
  selector: 'my-video-channel-activity',
  templateUrl: './video-channel-activity.component.html',
  styleUrls: [ './video-channel-activity.component.scss' ],
  imports: [
    RouterModule,
    FromNowPipe
]
})
export class VideoChannelActivityComponent implements OnInit {
  activity = input<VideoChannelActivity>()

  a: VideoChannelActivity
  account: string

  ngOnInit () {
    this.a = this.activity()

    this.account = this.a.account
      ? this.a.account.displayName
      : $localize`Deleted account`
  }
}

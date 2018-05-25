import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Account } from '@app/shared/account/account.model'
import { AccountService } from '@app/shared/account/account.service'
import { VideoChannel } from '../../../../../shared/models/videos'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { flatMap, map, tap } from 'rxjs/operators'

@Component({
  selector: 'my-account-video-channels',
  templateUrl: './account-video-channels.component.html',
  styleUrls: [ './account-video-channels.component.scss' ]
})
export class AccountVideoChannelsComponent implements OnInit {
  account: Account
  videoChannels: VideoChannel[] = []

  constructor (
    protected route: ActivatedRoute,
    private accountService: AccountService,
    private videoChannelService: VideoChannelService
  ) { }

  ngOnInit () {
    // Parent get the account for us
    this.accountService.accountLoaded
        .pipe(
          tap(account => this.account = account),
          flatMap(account => this.videoChannelService.listAccountVideoChannels(account)),
          map(res => res.data)
        )
        .subscribe(videoChannels => this.videoChannels = videoChannels)
  }
}

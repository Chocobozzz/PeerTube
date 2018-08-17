import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Account } from '@app/shared/account/account.model'
import { AccountService } from '@app/shared/account/account.service'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { flatMap, map, tap } from 'rxjs/operators'
import { Subscription } from 'rxjs'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'

@Component({
  selector: 'my-account-video-channels',
  templateUrl: './account-video-channels.component.html',
  styleUrls: [ './account-video-channels.component.scss' ]
})
export class AccountVideoChannelsComponent implements OnInit, OnDestroy {
  account: Account
  videoChannels: VideoChannel[] = []

  private accountSub: Subscription

  constructor (
    protected route: ActivatedRoute,
    private accountService: AccountService,
    private videoChannelService: VideoChannelService
  ) { }

  ngOnInit () {
    // Parent get the account for us
    this.accountSub = this.accountService.accountLoaded
        .pipe(
          tap(account => this.account = account),
          flatMap(account => this.videoChannelService.listAccountVideoChannels(account)),
          map(res => res.data)
        )
        .subscribe(videoChannels => this.videoChannels = videoChannels)
  }

  ngOnDestroy () {
    if (this.accountSub) this.accountSub.unsubscribe()
  }
}

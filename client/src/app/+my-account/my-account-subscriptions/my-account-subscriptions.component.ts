import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { UserSubscriptionService } from '@app/shared/user-subscription'

@Component({
  selector: 'my-account-subscriptions',
  templateUrl: './my-account-subscriptions.component.html',
  styleUrls: [ './my-account-subscriptions.component.scss' ]
})
export class MyAccountSubscriptionsComponent implements OnInit {
  videoChannels: VideoChannel[] = []

  constructor (
    private userSubscriptionService: UserSubscriptionService,
    private notificationsService: NotificationsService,
    private i18n: I18n
  ) {}

  ngOnInit () {
    this.userSubscriptionService.listSubscriptions()
      .subscribe(
        res => { console.log(res); this.videoChannels = res.data },

        error => this.notificationsService.error(this.i18n('Error'), error.message)
      )
  }

}

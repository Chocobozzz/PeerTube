import { Component, OnInit } from '@angular/core'
import { ServerService } from '@app/core'
import { Actor } from '@app/shared/shared-main/account/actor.model'

@Component({
  selector: 'my-subscription-image',
  templateUrl: './subscription-image.component.html',
  styleUrls: [ './subscription-image.component.scss' ],
  standalone: true
})
export class SubscriptionImageComponent implements OnInit {
  avatarUrl: string

  constructor (private server: ServerService) {}

  ngOnInit () {
    this.avatarUrl = Actor.GET_ACTOR_AVATAR_URL(this.server.getHTMLConfig().instance, 30)
  }
}

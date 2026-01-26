import { Component, OnInit, inject } from '@angular/core'
import { ServerService } from '@app/core'
import { Actor } from '@app/shared/shared-main/account/actor.model'

@Component({
  selector: 'my-subscription-image',
  templateUrl: './subscription-image.component.html',
  styleUrls: [ './subscription-image.component.scss' ],
  standalone: true,
  imports: []
})
export class SubscriptionImageComponent implements OnInit {
  private server = inject(ServerService)

  avatarUrl: string

  ngOnInit () {
    this.avatarUrl = Actor.GET_ACTOR_AVATAR_URL(this.server.getHTMLConfig().instance, 30)
  }
}

import { Component, OnInit, inject } from '@angular/core'
import { ServerService } from '@app/core'
import { findAppropriateImageFileUrl } from '@root-helpers/images'

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
    this.avatarUrl = findAppropriateImageFileUrl(this.server.getHTMLConfig().instance.avatars, 30)
  }
}

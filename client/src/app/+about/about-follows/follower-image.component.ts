import { Component, OnInit, inject } from '@angular/core'
import { ServerService } from '@app/core'
import { findAppropriateImageFileUrl } from '@root-helpers/images'

@Component({
  selector: 'my-follower-image',
  templateUrl: './follower-image.component.html',
  styleUrls: [ './follower-image.component.scss' ],
  standalone: true,
  imports: []
})
export class FollowerImageComponent implements OnInit {
  private server = inject(ServerService)

  avatarUrl: string

  ngOnInit () {
    this.avatarUrl = findAppropriateImageFileUrl(this.server.getHTMLConfig().instance.avatars, 30)
  }
}

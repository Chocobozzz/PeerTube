import { Component, Input } from '@angular/core'
import { Syndication } from '@app/shared/video/syndication.model'

@Component({
  selector: 'my-feed',
  styleUrls: [ './feed.component.scss' ],
  templateUrl: './feed.component.html'
})
export class FeedComponent {
  @Input() syndicationItems: Syndication[]
}

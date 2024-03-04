import { Component, Input } from '@angular/core'
import { Syndication } from './syndication.model'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { NgIf, NgFor } from '@angular/common'

@Component({
  selector: 'my-feed',
  styleUrls: [ './feed.component.scss' ],
  templateUrl: './feed.component.html',
  standalone: true,
  imports: [ NgIf, NgbPopover, GlobalIconComponent, NgFor ]
})
export class FeedComponent {
  @Input() syndicationItems: Syndication[]
}

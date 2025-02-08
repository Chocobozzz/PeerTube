import { NgFor, NgIf } from '@angular/common'
import { Component, Input, ViewChild } from '@angular/core'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { Syndication } from './syndication.model'

@Component({
  selector: 'my-feed',
  styleUrls: [ './feed.component.scss' ],
  templateUrl: './feed.component.html',
  imports: [ NgIf, NgbPopover, GlobalIconComponent, NgFor ]
})
export class FeedComponent {
  @ViewChild('popover') popover: NgbPopover

  @Input() syndicationItems: Syndication[]

  getTitle () {
    if (this.popover?.isOpen()) {
      return $localize`Close syndication dropdown`
    }

    return $localize`Open syndication dropdown`
  }
}

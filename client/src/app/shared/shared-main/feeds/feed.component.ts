import { Component, input, viewChild } from '@angular/core'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'
import { Syndication } from './syndication.model'

@Component({
  selector: 'my-feed',
  styleUrls: [ './feed.component.scss' ],
  templateUrl: './feed.component.html',
  imports: [ NgbPopover, GlobalIconComponent ]
})
export class FeedComponent {
  readonly popover = viewChild<NgbPopover>('popover')

  readonly syndicationItems = input<Syndication[]>(undefined)

  getTitle () {
    if (this.popover()?.isOpen()) {
      return $localize`Close syndication dropdown`
    }

    return $localize`Open syndication dropdown`
  }
}

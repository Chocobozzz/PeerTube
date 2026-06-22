import { Component, OnChanges, inject, input, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AuthService, ServerService } from '@app/core'
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { SearchTargetType } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'

@Component({
  selector: 'my-actor-host',
  templateUrl: 'actor-host.component.html',
  styleUrls: [ 'actor-host.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ NgbDropdownModule, GlobalIconComponent, ButtonComponent, RouterLink ]
})
export class ActorHostComponent implements OnChanges {
  readonly auth = inject(AuthService)
  readonly server = inject(ServerService)

  readonly dropdown = viewChild('dropdown')

  readonly host = input.required<string>()

  title: string
  searchTarget: SearchTargetType

  ngOnChanges () {
    this.title = $localize`Get more information on ${this.host()}`

    const config = this.server.getHTMLConfig()

    this.searchTarget = config.search.searchIndex.enabled
      ? 'search-index'
      : 'local'
  }
}

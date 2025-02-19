import { CommonModule } from '@angular/common'
import { Component, OnChanges, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'

@Component({
  selector: 'my-actor-host',
  templateUrl: 'actor-host.component.html',
  styleUrls: [ 'actor-host.component.scss' ],
  imports: [ CommonModule, NgbDropdownModule, GlobalIconComponent, ButtonComponent, RouterLink ]
})
export class ActorHostComponent implements OnChanges {
  readonly host = input.required<string>()

  title: string

  ngOnChanges () {
    this.title = $localize`Get more information on ${this.host()}`
  }
}

import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { ButtonComponent } from '../shared-main/buttons/button.component'

@Component({
  selector: 'my-actor-host',
  templateUrl: 'actor-host.component.html',
  styleUrls: [ 'actor-host.component.scss' ],
  standalone: true,
  imports: [ CommonModule, NgbDropdownModule, GlobalIconComponent, ButtonComponent, RouterLink ]
})
export class ActorHostComponent {
  @Input({ required: true }) host: string
}

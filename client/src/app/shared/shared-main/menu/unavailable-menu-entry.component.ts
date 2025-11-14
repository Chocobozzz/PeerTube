
import { Component, input } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { HelpComponent } from '../buttons/help.component'

@Component({
  selector: 'my-unavailable-menu-entry',
  templateUrl: './unavailable-menu-entry.component.html',
  styleUrls: [ './unavailable-menu-entry.component.scss' ],
  imports: [
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    NgbTooltipModule,
    HelpComponent
]
})
export class UnavailableMenuEntryComponent {
  readonly help = input.required<string>()
}

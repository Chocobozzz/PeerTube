import { Component, input } from '@angular/core'
import { NgClass } from '@angular/common'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-table-expander-icon',
  template: `
<button type="button" class="expander border-0 p-0" [ngbTooltip]="tooltip()" [ariaLabel]="tooltip()">
  <i [ngClass]="expanded() ? 'chevron-down' : 'chevron-right'"></i>
</button>`,
  imports: [ NgbTooltip, NgClass ]
})
export class TableExpanderIconComponent {
  readonly expanded = input<boolean>(undefined)
  readonly tooltip = input($localize`Get more information`)
}

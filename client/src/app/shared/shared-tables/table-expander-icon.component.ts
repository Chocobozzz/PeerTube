import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-table-expander-icon',
  template: `
<button class="expander border-0 p-0" [ngbTooltip]="tooltip">
  <i [ngClass]="expanded ? 'chevron-down' : 'chevron-right'"></i>
</button>`
})
export class TableExpanderIconComponent {
  @Input() expanded: boolean
  @Input() tooltip = $localize`Get more information`
}

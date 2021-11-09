import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-table-expander-icon',
  template: `
<span class="expander">
    <i [ngClass]="expanded ? 'glyphicon glyphicon-menu-down' : 'glyphicon glyphicon-menu-right'"></i>
</span>`
})
export class TableExpanderIconComponent {
  @Input() expanded: boolean
}

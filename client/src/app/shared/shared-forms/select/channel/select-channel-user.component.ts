import { ChangeDetectionStrategy, Component, forwardRef, input, output } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { CollaboratorStateComponent } from '@app/shared/shared-main/channel/collaborator-state.component'
import { SelectChannelItem } from '../../../../../types/select-options-item.model'
import { SelectOptionsComponent } from '../select-options.component'

@Component({
  selector: 'my-select-channel-user',
  template: `
  <my-select-options
    [inputId]="inputId()"

    [items]="items()"

    [(ngModel)]="selectedId"
    (ngModelChange)="onModelChange()"

    [filter]="items() && items().length > 5"
  >
    <ng-template #itemExtra let-item>
      @if (item.collaborate) {
        @if (item.editor) {
          <my-collaborator-state class="lh-1 ms-2" type="accepted" disableTooltip="true"></my-collaborator-state>
        } @else if (item.owner) {
          <my-collaborator-state class="lh-1 ms-2" type="owner" disableTooltip="true"></my-collaborator-state>
        }
      }
    </ng-template>
  </my-select-options>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectChannelUserComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, SelectOptionsComponent, CollaboratorStateComponent ]
})
export class SelectChannelUserComponent implements ControlValueAccessor {
  readonly inputId = input.required<string>()
  readonly items = input<SelectChannelItem[]>([])

  readonly channelChanged = output<SelectChannelItem>()

  selectedId: number

  propagateChange = (_: any) => {
    // empty
  }

  writeValue (id: number | string) {
    this.selectedId = typeof id === 'string'
      ? parseInt(id, 10)
      : id
  }

  registerOnChange (fn: (_: any) => void) {
    this.propagateChange = fn
  }

  registerOnTouched () {
    // Unused
  }

  onModelChange () {
    this.propagateChange(this.selectedId)

    const channel = this.items().find(c => c.id === this.selectedId)
    if (channel) this.channelChanged.emit(channel)
  }
}

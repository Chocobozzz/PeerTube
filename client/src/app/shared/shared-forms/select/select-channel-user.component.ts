import { ChangeDetectionStrategy, Component, forwardRef, input, OnChanges } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { CollaboratorStateComponent } from '@app/shared/shared-main/channel/collaborator-state.component'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { SelectChannelItem, SelectOptionsItem } from '../../../../types/select-options-item.model'
import { SelectOptionsComponent } from './select-options.component'

@Component({
  selector: 'my-select-channel-user',
  template: `
  <my-select-options
    [inputId]="inputId()"

    [items]="channels"

    [(ngModel)]="selectedId"
    (ngModelChange)="onModelChange()"

    [filter]="channels && channels.length > 5"
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
export class SelectChannelUserComponent implements ControlValueAccessor, OnChanges {
  readonly inputId = input.required<string>()
  readonly items = input<SelectChannelItem[]>([])

  channels: SelectOptionsItem[]
  selectedId: number

  ngOnChanges () {
    this.channels = this.items().map(c => {
      const avatarFileUrl = c.avatarFileUrl
        ? c.avatarFileUrl
        : VideoChannel.GET_DEFAULT_AVATAR_URL(21)

      return Object.assign({}, c, { imageUrl: avatarFileUrl })
    })
  }

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
  }
}

import { CommonModule } from '@angular/common'
import { Component, forwardRef, Input, OnChanges } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { DropdownModule } from 'primeng/dropdown'
import { SelectChannelItem, SelectOptionsItem } from '../../../../types/select-options-item.model'
import { SelectOptionsComponent } from './select-options.component'

@Component({
  selector: 'my-select-channel',
  template: `
  <my-select-options
    [inputId]="inputId"

    [items]="channels"

    [(ngModel)]="selectedId"
    (ngModelChange)="onModelChange()"

    [filter]="channels && channels.length > 5"
  ></my-select-options>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectChannelComponent),
      multi: true
    }
  ],
  imports: [ DropdownModule, FormsModule, CommonModule, SelectOptionsComponent ]
})
export class SelectChannelComponent implements ControlValueAccessor, OnChanges {
  @Input({ required: true }) inputId: string
  @Input() items: SelectChannelItem[] = []

  channels: SelectOptionsItem[]
  selectedId: number

  ngOnChanges () {
    this.channels = this.items.map(c => {
      const avatarPath = c.avatarPath
        ? c.avatarPath
        : VideoChannel.GET_DEFAULT_AVATAR_URL(21)

      return Object.assign({}, c, { imageUrl: avatarPath })
    })
  }

  propagateChange = (_: any) => { /* empty */ }

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

  getSelectedChannel () {
    return (this.channels || []).find(c => c.id + '' === this.selectedId + '')
  }
}

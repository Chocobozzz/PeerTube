import { ChangeDetectionStrategy, Component, forwardRef, inject, input, OnChanges, OnDestroy, output } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { AuthService } from '@app/core'
import { buildUserChannelsForSelect } from '@app/shared/shared-forms/select/channel/select-channel-helpers'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { Account } from '@peertube/peertube-models'
import { first, Subscription } from 'rxjs'
import { SelectChannelItem } from '../../../../../types/select-options-item.model'
import { SelectChannelAdminComponent } from './select-channel-admin.component'
import { SelectChannelUserComponent } from './select-channel-user.component'

/**
 * Loads the admin channel selector (with instance-wide search) if the user is NOT the owner or editor of the current channel
 * Typically the case when an administrator is editing another user's content.
 * Otherwise loads the simpler user-only selector.
 */

@Component({
  selector: 'my-select-channel-auto',
  template: `
  @if (shouldLoadAdminSelect) {
    <my-select-channel-admin
      [inputId]="inputId()"
      [ownerAccountName]="ownerAccount().name"
      [(ngModel)]="selectedId"
      (ngModelChange)="onModelChange()"
      (channelChanged)="channelChanged.emit($event)"
    ></my-select-channel-admin>
  } @else {
    <my-select-channel-user
      [inputId]="inputId()"
      [items]="userChannels"
      [(ngModel)]="selectedId"
      (ngModelChange)="onModelChange()"
      (channelChanged)="channelChanged.emit($event)"
    ></my-select-channel-user>
  }
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectChannelAutoComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, SelectChannelAdminComponent, SelectChannelUserComponent ]
})
export class SelectChannelAutoComponent implements ControlValueAccessor, OnChanges, OnDestroy {
  private readonly auth = inject(AuthService)

  readonly inputId = input.required<string>()
  readonly ownerChannel = input.required<Pick<VideoChannel, 'id'>>()
  readonly ownerAccount = input.required<Pick<Account, 'name'>>()

  readonly channelChanged = output<SelectChannelItem>()

  userChannels: SelectChannelItem[]
  selectedId: number
  shouldLoadAdminSelect: boolean

  private loadSub: Subscription

  ngOnChanges () {
    this.loadSub?.unsubscribe()
    this.loadSub = this.auth.userInformationLoaded.pipe(first())
      .subscribe({
        next: () => {
          const user = this.auth.getUser()

          const ownerChannelId = this.ownerChannel().id
          if (user.isOwnerOfChannel({ id: ownerChannelId }) || user.isEditorOfChannel({ id: ownerChannelId })) {
            this.shouldLoadAdminSelect = false

            this.userChannels = buildUserChannelsForSelect({ authService: this.auth, includeCollaborations: true })
          } else {
            this.shouldLoadAdminSelect = true

            // Admin channels are automatically loaded by the component
            this.userChannels = []
          }
        }
      })
  }

  ngOnDestroy () {
    this.loadSub?.unsubscribe()
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

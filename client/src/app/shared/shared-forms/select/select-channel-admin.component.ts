import { ChangeDetectionStrategy, Component, forwardRef, inject, input, OnChanges, OnDestroy, output } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { AuthService, Notifier } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { SearchService } from '@app/shared/shared-search/search.service'
import { pick } from '@peertube/peertube-core-utils'
import { VideoChannel as VideoChannelServer } from '@peertube/peertube-models'
import { SelectOptionsItem } from '@pt-types'
import { findAppropriateImageFileUrl } from '@root-helpers/images'
import { first, forkJoin, map, Subscription } from 'rxjs'
import { ChannelMetadata } from './select-channel-metadata.model'
import { SelectOptionsComponent } from './select-options.component'

interface ChannelOption extends SelectOptionsItem, ChannelMetadata {
}

@Component({
  selector: 'my-select-channel-admin',
  template: `
<my-select-options
  [inputId]="inputId()"

  [items]="options"
  group="true"
  filter="true"
  resetFilterOnHide="true"

  [(ngModel)]="selectedId"
  (ngModelChange)="onModelChange()"

  [emptyFilterMessage]="getEmptyFilterMessage()"
  (onFilter)="onFilter($event)"

  (onHide)="onHide()"
>
</my-select-options>
  `,
  styleUrls: [ 'select-options.component.scss' ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectChannelAdminComponent),
      multi: true
    },
    SearchService
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ FormsModule, SelectOptionsComponent ]
})
export class SelectChannelAdminComponent implements ControlValueAccessor, OnChanges, OnDestroy {
  private auth = inject(AuthService)
  private channelService = inject(VideoChannelService)
  private searchService = inject(SearchService)
  private notifier = inject(Notifier)

  readonly inputId = input.required<string>()
  readonly ownerAccountName = input.required<string>()

  readonly channelChanged = output<ChannelMetadata>()

  selectedId: number

  options: { label: string, value: string, items: ChannelOption[] }[] = []

  baseOptions: { label: string, value: string, items: ChannelOption[] }[] = []

  loading = false

  private loadingSub: Subscription

  ngOnChanges () {
    this.loading = true
    this.loadingSub?.unsubscribe()

    this.loadingSub = forkJoin([
      this.buildUserChannelObs(),
      this.buildOwnerChannelObs()
    ]).subscribe({
      next: ([ userChannels, ownerChannels ]) => {
        this.options = [
          {
            label: $localize`Owner channels`,
            value: 'owner',
            items: ownerChannels
          },
          {
            label: $localize`Your channels`,
            value: 'yours',
            items: userChannels
          }
        ]

        this.baseOptions = [ ...this.options ]

        this.loading = false
      },

      error: err => {
        this.loading = false

        this.notifier.error(err.message)
      }
    })
  }

  ngOnDestroy () {
    this.loadingSub?.unsubscribe()
  }

  getEmptyFilterMessage () {
    if (this.loading) return $localize`Loading...`

    return $localize`No results found`
  }

  private buildUserChannelObs () {
    return this.auth.userInformationLoaded.pipe(first())
      .pipe(map(() => this.auth.getUser().videoChannels.map(c => this.formatChannel({ channel: c, displayOwner: false }))))
  }

  private buildOwnerChannelObs () {
    return this.channelService.listAccountChannels({
      account: { nameWithHost: this.ownerAccountName() }
    }).pipe(map(({ data }) => data.map(c => this.formatChannel({ channel: c, displayOwner: false }))))
  }

  onHide () {
    this.options = [ ...this.baseOptions ]
  }

  onFilter ({ filter }: { filter: string }) {
    if (!filter) {
      this.options = [ ...this.baseOptions ]
      return
    }

    this.options = []

    this.loading = true

    this.loadingSub?.unsubscribe()

    this.loadingSub = this.searchService.searchVideoChannels({ search: filter })
      .subscribe({
        next: ({ data }) => {
          this.options = [
            {
              label: $localize`Searched channels`,
              value: 'search',
              items: data.map(c => this.formatChannel({ channel: c, displayOwner: true }))
            }
          ]

          this.loading = false
        },

        error: err => {
          this.loading = false

          this.notifier.error(err.message)
        }
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

    const item = this.options.flatMap(o => o.items)
      .find(c => c.id === this.selectedId)

    this.channelChanged.emit(pick(item, [ 'ownerAccountName', 'channelDisplayName', 'channelName' ]))
  }

  private formatChannel (options: {
    channel: VideoChannelServer
    displayOwner: boolean
  }): ChannelOption {
    const { channel, displayOwner } = options

    return {
      id: channel.id,
      label: channel.displayName,
      description: displayOwner
        ? channel.ownerAccount.displayName
        : undefined,

      imageUrl: channel.avatars.length
        ? findAppropriateImageFileUrl(channel.avatars, 21)
        : VideoChannel.GET_DEFAULT_AVATAR_URL(21),

      ownerAccountName: channel.ownerAccount.name,
      channelDisplayName: channel.displayName,
      channelName: channel.name
    }
  }
}

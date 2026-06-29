import { ChangeDetectionStrategy, Component, forwardRef, inject, input, OnChanges, OnDestroy, output } from '@angular/core'
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { AuthService, Notifier } from '@app/core'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { SearchService } from '@app/shared/shared-search/search.service'
import { SelectChannelItem } from '@pt-types'
import { first, forkJoin, map, Subscription } from 'rxjs'
import { SelectOptionsComponent } from '../select-options.component'
import { formatChannelForSelect } from './select-channel-helpers'

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
  styleUrls: [ '../select-options.component.scss' ],
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

  readonly channelChanged = output<SelectChannelItem>()

  selectedId: number

  options: { label: string, value: string, items: SelectChannelItem[] }[] = []

  baseOptions: { label: string, value: string, items: SelectChannelItem[] }[] = []

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
      .pipe(map(() => {
        return this.auth.getUser().videoChannels
          .map(c => formatChannelForSelect(c, { editor: false, owner: false, collaborate: false }))
      }))
  }

  private buildOwnerChannelObs () {
    return this.channelService.listAccountChannels({
      account: { nameWithHost: this.ownerAccountName() }
    }).pipe(map(({ data }) => {
      return data.map(c => {
        const channel = { ...c, ownerAccountId: c.ownerAccount.id, ownerAccountName: c.ownerAccount.name }

        return formatChannelForSelect(channel, { editor: false, owner: false, collaborate: false })
      })
    }))
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
              items: data.map(c => {
                const userChannel = { ...c, ownerAccountId: c.ownerAccount.id, ownerAccountName: c.ownerAccount.name }

                return {
                  ...formatChannelForSelect(userChannel, { editor: false, owner: false, collaborate: false }),

                  description: c.ownerAccount.displayName
                }
              })
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

    this.channelChanged.emit(item)
  }
}

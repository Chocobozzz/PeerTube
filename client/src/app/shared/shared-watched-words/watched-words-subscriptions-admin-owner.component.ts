import { CommonModule } from '@angular/common'
import { Component, ElementRef, inject, input, signal, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { form, FormField, pattern, required } from '@angular/forms/signals'
import { AuthService, ConfirmService, Notifier } from '@app/core'
import { urlPattern } from '@app/shared/form-validators/common-validators'
import { FormErrorComponent } from '@app/shared/shared-forms/form-error.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { NumberFormatterPipe } from '@app/shared/shared-main/common/number-formatter.pipe'
import { getStateBadgeClasses } from '@app/shared/shared-tables/state-badge'
import { DataLoaderOptionsBase, TableColumnInfo, TableComponent } from '@app/shared/shared-tables/table.component'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { StreamSyncStateType, WatchedWordsSubscription } from '@peertube/peertube-models'
import { first, switchMap } from 'rxjs'
import { WatchedWordsSubscriptionService } from './watched-words-subscription.service'

type AddSubscriptionFormModel = {
  url: string
}

@Component({
  selector: 'my-watched-words-subscriptions-admin-owner',
  templateUrl: './watched-words-subscriptions-admin-owner.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    FormErrorComponent,
    TableComponent,
    NumberFormatterPipe,
    PTDatePipe,
    GlobalIconComponent,
    FormField,
    ButtonComponent
  ]
})
export class WatchedWordsSubscriptionsAdminOwnerComponent {
  private auth = inject(AuthService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private modalService = inject(NgbModal)
  private watchedWordsSubscriptionService = inject(WatchedWordsSubscriptionService)

  readonly mode = input.required<'user' | 'admin'>()

  readonly table = viewChild<TableComponent<WatchedWordsSubscription>>('table')
  readonly addModal = viewChild<ElementRef>('addModal')

  readonly addSubscriptionModel = signal<AddSubscriptionFormModel>({ url: '' })
  readonly addSubscriptionForm = form(this.addSubscriptionModel, f => {
    required(f.url, { message: $localize`Watched words URL is required.` })
    pattern(f.url, urlPattern, { message: $localize`Please enter a valid URL.` })
  })
  addingSubscription = false

  private addModalOpened: NgbModalRef

  columns: TableColumnInfo<string>[] = [
    {
      id: 'name',
      label: $localize`List name`,
      selected: true,
      sortable: true
    },
    {
      id: 'url',
      label: $localize`URL`,
      selected: true,
      sortable: false
    },
    {
      id: 'syncStatus',
      label: $localize`Status`,
      selected: true,
      sortable: false
    },
    {
      id: 'importedWordsCount',
      label: $localize`Words`,
      selected: true,
      sortable: false
    },
    {
      id: 'lastSyncAt',
      label: $localize`Last synced`,
      selected: true,
      sortable: true
    },
    {
      id: 'createdAt',
      label: $localize`Subscribed at`,
      selected: true,
      sortable: true
    }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  openAddModal () {
    this.addSubscriptionModel.set({ url: '' })
    this.addSubscriptionForm().reset()

    this.addModalOpened = this.modalService.open(this.addModal(), { centered: true })
  }

  submitAddModal () {
    const url = this.addSubscriptionModel().url.trim()

    this.addingSubscription = true

    this.watchedWordsSubscriptionService.addSubscription({ url, accountName: this.getAccountNameParam() })
      .subscribe({
        next: () => {
          this.notifier.success($localize`Subscription to ${url} added.`)

          this.addModalOpened.close()
          this.table().loadData()
          this.addingSubscription = false
        },

        error: err => {
          this.notifier.handleError(err)
          this.addingSubscription = false
        }
      })
  }

  async removeSubscription (subscription: WatchedWordsSubscription) {
    const message = this.mode() === 'admin'
      ? $localize`Deleting this subscription will remove <strong>${subscription.name}</strong> auto tags assigned to comments and videos.`
      : $localize`Deleting this subscription will remove <strong>${subscription.name}</strong> auto tags assigned to comments.`

    const res = await this.confirmService.confirm(message, $localize`Delete subscription`)
    if (res === false) return

    this.watchedWordsSubscriptionService.deleteSubscription({
      id: subscription.id,
      accountName: this.getAccountNameParam()
    }).subscribe({
      next: () => {
        this.notifier.success($localize`Subscription to <strong>${subscription.name}</strong> deleted.`)
        this.table().loadData()
      },

      error: err => this.notifier.handleError(err)
    })
  }

  getStateClass (stateId: StreamSyncStateType) {
    return getStateBadgeClasses(stateId)
  }

  private getAccountNameParam () {
    if (this.mode() === 'admin') return undefined

    return this.auth.getUser().account.name
  }

  private _dataLoader (options: DataLoaderOptionsBase) {
    const { pagination, sort, search } = options

    return this.auth.userInformationLoaded
      .pipe(
        first(),
        switchMap(() =>
          this.watchedWordsSubscriptionService.listSubscriptions({
            pagination,
            sort,
            search,
            accountName: this.getAccountNameParam()
          })
        )
      )
  }
}

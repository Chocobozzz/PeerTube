import { CommonModule } from '@angular/common'
import { Component, ElementRef, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { form, FormField, pattern, required } from '@angular/forms/signals'
import { RouterLink } from '@angular/router'
import { ConfirmService, Notifier } from '@app/core'
import { urlPattern } from '@app/shared/form-validators/common-validators'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { NumberFormatterPipe } from '@app/shared/shared-main/common/number-formatter.pipe'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { getStateBadgeClasses } from '@app/shared/shared-tables/state-badge'
import { DataLoaderOptionsBase, TableComponent } from '@app/shared/shared-tables/table.component'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { BlocklistSubscription, StreamSyncStateType } from '@peertube/peertube-models'
import { FormErrorComponent } from '../../../shared/shared-forms/form-error.component'

type AddSubscriptionFormModel = {
  url: string
}

@Component({
  selector: 'my-instance-blocklist-subscriptions',
  templateUrl: './instance-blocklist-subscriptions.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    FormErrorComponent,
    TableComponent,
    NumberFormatterPipe,
    PTDatePipe,
    GlobalIconComponent,
    FormField,
    ButtonComponent,
    RouterLink
  ]
})
export class InstanceBlocklistSubscriptionsComponent {
  private blocklistService = inject(BlocklistService)
  private notifier = inject(Notifier)
  private confirmService = inject(ConfirmService)
  private modalService = inject(NgbModal)

  readonly table = viewChild<TableComponent<BlocklistSubscription>>('table')
  readonly addModal = viewChild<ElementRef>('addModal')

  readonly addSubscriptionModel = signal<AddSubscriptionFormModel>({ url: '' })
  readonly addSubscriptionForm = form(this.addSubscriptionModel, f => {
    required(f.url, { message: $localize`Blocklist URL is required.` })
    pattern(f.url, urlPattern, { message: $localize`Please enter a valid URL.` })
  })
  addingSubscription = false

  private addModalOpened: NgbModalRef

  columns = [
    { id: 'name', label: $localize`Name`, sortable: true },
    { id: 'url', label: $localize`URL`, sortable: false },
    { id: 'syncStatus', label: $localize`Status`, sortable: false },
    { id: 'lastSyncAt', label: $localize`Last synced`, sortable: true },
    { id: 'blockedHosts', label: $localize`Blocked hosts`, sortable: false },
    { id: 'blockedAccounts', label: $localize`Blocked accounts`, sortable: false },
    { id: 'createdAt', label: $localize`Subscribed at`, sortable: true }
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

    this.blocklistService.addBlocklistSubscription(url)
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

  async removeSubscription (subscription: BlocklistSubscription) {
    const res = await this.confirmService.confirm(
      // eslint-disable-next-line max-len
      $localize`Deleting this subscription will unblock all accounts and servers that were muted because of it. Are you sure you want to delete the subscription to "${subscription.name}"?`,
      $localize`Delete subscription`
    )

    if (res === false) return

    this.blocklistService.removeBlocklistSubscription(subscription.id)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Subscription to "${subscription.name}" deleted.`)
          this.table().loadData()
        },
        error: err => this.notifier.handleError(err)
      })
  }

  getStateClass (stateId: StreamSyncStateType) {
    return getStateBadgeClasses(stateId)
  }

  getServerBlocklistUrl () {
    return '/admin/moderation/blocklist/servers'
  }

  getAccountBlocklistUrl () {
    return '/admin/moderation/blocklist/accounts'
  }

  private _dataLoader (options: DataLoaderOptionsBase) {
    return this.blocklistService.listBlocklistSubscriptions(options)
  }
}

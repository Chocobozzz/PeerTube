import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ConfirmService, MarkdownService, Notifier, ServerService } from '@app/core'
import { formatICU } from '@app/helpers'
import { buildDropdownSimpleAndBulkActions } from '@app/shared/shared-main/buttons/action-dropdown-helpers'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { ResultList, UserRegistration as UserRegistrationServer, UserRegistrationState } from '@peertube/peertube-models'
import { switchMap } from 'rxjs'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptionsBase, TableColumnInfo, TableComponent } from '../../../shared/shared-tables/table.component'
import { UserEmailInfoComponent } from '../../shared/user-email-info.component'
import { AdminRegistrationService } from './admin-registration.service'
import { ProcessRegistrationModalComponent } from './process-registration-modal.component'

type UserRegistration = UserRegistrationServer & { registrationReasonHTML?: string, moderationResponseHTML?: string }
type ColumnName = 'account' | 'email' | 'channel' | 'registrationReason' | 'state' | 'moderationResponse' | 'createdAt'

@Component({
  selector: 'my-registration-list',
  templateUrl: './registration-list.component.html',
  styleUrls: [ '../../../shared/shared-moderation/moderation.scss', './registration-list.component.scss' ],
  imports: [
    GlobalIconComponent,
    ActionDropdownComponent,
    NgbTooltip,
    UserEmailInfoComponent,
    ProcessRegistrationModalComponent,
    PTDatePipe,
    NumberFormatterPipe,
    TableComponent
  ]
})
export class RegistrationListComponent implements OnInit {
  private server = inject(ServerService)
  private notifier = inject(Notifier)
  private markdownRenderer = inject(MarkdownService)
  private confirmService = inject(ConfirmService)
  private adminRegistrationService = inject(AdminRegistrationService)

  readonly processRegistrationModal = viewChild<ProcessRegistrationModalComponent>('processRegistrationModal')
  readonly table = viewChild<TableComponent<UserRegistration, DataLoaderOptionsBase, ColumnName>>('table')

  registrationActions: DropdownAction<UserRegistration>[][] = []
  bulkActions: DropdownAction<UserRegistration[]>[][] = []

  requiresEmailVerification: boolean

  columns: TableColumnInfo<ColumnName>[] = [
    { id: 'account', label: $localize`Account`, sortable: false },
    { id: 'email', label: $localize`Email`, sortable: false },
    { id: 'channel', label: $localize`Channel`, sortable: false },
    { id: 'registrationReason', label: $localize`Registration reason`, sortable: false },
    { id: 'state', label: $localize`State`, sortable: true },
    { id: 'moderationResponse', label: $localize`Moderation response`, sortable: false },
    { id: 'createdAt', label: $localize`Requested on`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)

    const { simpleActions, bulkActions } = buildDropdownSimpleAndBulkActions<UserRegistration>([
      [
        {
          label: $localize`Accept`,
          handler: registrations => this.openRegistrationRequestProcessModal(registrations, 'accept'),
          isDisplayed: registration => registration.state.id === UserRegistrationState.PENDING,
          enableBulk: true
        },
        {
          label: $localize`Reject`,
          handler: registrations => this.openRegistrationRequestProcessModal(registrations, 'reject'),
          isDisplayed: registration => registration.state.id === UserRegistrationState.PENDING,
          enableBulk: true
        }
      ],
      [
        {
          label: $localize`Remove`,
          description: $localize`Remove the request from the list. User can register again.`,
          handler: registrations => this.removeRegistrations(registrations),
          enableBulk: true
        }
      ]
    ])

    this.registrationActions = simpleActions
    this.bulkActions = bulkActions
  }

  ngOnInit () {
    this.server.getConfig()
      .subscribe(config => {
        this.requiresEmailVerification = config.signup.requiresEmailVerification
      })
  }

  isRegistrationAccepted (registration: UserRegistration) {
    return registration.state.id === UserRegistrationState.ACCEPTED
  }

  isRegistrationRejected (registration: UserRegistration) {
    return registration.state.id === UserRegistrationState.REJECTED
  }

  onRegistrationProcessed () {
    this.table().reloadData({ field: 'createdAt', order: -1 })
  }

  private _dataLoader (options: DataLoaderOptionsBase) {
    return this.adminRegistrationService.listRegistrations(options)
      .pipe(
        switchMap(async (resultList: ResultList<UserRegistration>) => {
          for (const registration of resultList.data) {
            registration.registrationReasonHTML = await this.toHtml(registration.registrationReason)
            registration.moderationResponseHTML = await this.toHtml(registration.moderationResponse)
          }

          return resultList
        })
      )
  }

  private openRegistrationRequestProcessModal (registrations: UserRegistration | UserRegistration[], mode: 'accept' | 'reject') {
    this.processRegistrationModal().openModal(registrations, mode)
  }

  private async removeRegistrations (registrations: UserRegistration[]) {
    const icuParams = { count: registrations.length, username: registrations[0].username }

    const message = formatICU(
      $localize`Do you really want to delete {count, plural, =1 {{username} registration request?} other {{count} registration requests?}}`,
      icuParams
    )

    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    this.adminRegistrationService.removeRegistrations(registrations)
      .subscribe({
        next: () => {
          const message = formatICU(
            $localize`Removed {count, plural, =1 {{username} registration request} other {{count} registration requests}}`,
            icuParams
          )

          this.notifier.success(message)
          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  private toHtml (text: string) {
    return this.markdownRenderer.textMarkdownToHTML({ markdown: text })
  }
}

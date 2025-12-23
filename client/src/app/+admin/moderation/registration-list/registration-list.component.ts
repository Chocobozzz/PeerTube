import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfirmService, MarkdownService, Notifier, ServerService } from '@app/core'
import { formatICU } from '@app/helpers'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { ResultList, UserRegistration as UserRegistrationServer, UserRegistrationState } from '@peertube/peertube-models'
import { switchMap } from 'rxjs'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../../shared/shared-tables/table.component'
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
    AdvancedInputFilterComponent,
    NgbTooltip,
    UserEmailInfoComponent,
    ProcessRegistrationModalComponent,
    PTDatePipe,
    NumberFormatterPipe,
    TableComponent
  ]
})
export class RegistrationListComponent implements OnInit {
  protected route = inject(ActivatedRoute)
  protected router = inject(Router)
  private server = inject(ServerService)
  private notifier = inject(Notifier)
  private markdownRenderer = inject(MarkdownService)
  private confirmService = inject(ConfirmService)
  private adminRegistrationService = inject(AdminRegistrationService)

  readonly processRegistrationModal = viewChild<ProcessRegistrationModalComponent>('processRegistrationModal')
  readonly table = viewChild<TableComponent<UserRegistration, ColumnName>>('table')

  registrationActions: DropdownAction<UserRegistration>[][] = []
  bulkActions: DropdownAction<UserRegistration[]>[] = []

  inputFilters: AdvancedInputFilter[] = []

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

    this.registrationActions = [
      [
        {
          label: $localize`Accept this request`,
          handler: registration => this.openRegistrationRequestProcessModal(registration, 'accept'),
          isDisplayed: registration => registration.state.id === UserRegistrationState.PENDING
        },
        {
          label: $localize`Reject this request`,
          handler: registration => this.openRegistrationRequestProcessModal(registration, 'reject'),
          isDisplayed: registration => registration.state.id === UserRegistrationState.PENDING
        },
        {
          label: $localize`Remove this request`,
          description: $localize`Remove the request from the list. The user can register again.`,
          handler: registration => this.removeRegistrations([ registration ])
        }
      ]
    ]

    this.bulkActions = [
      {
        label: $localize`Delete`,
        handler: registrations => this.removeRegistrations(registrations)
      }
    ]
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

  private _dataLoader (options: DataLoaderOptions) {
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

  private openRegistrationRequestProcessModal (registration: UserRegistration, mode: 'accept' | 'reject') {
    this.processRegistrationModal().openModal(registration, mode)
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

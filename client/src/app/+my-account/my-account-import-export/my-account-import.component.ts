import { NgIf } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { Component, Input, OnDestroy, OnInit } from '@angular/core'
import { AuthService, CanComponentDeactivate, Notifier, ServerService } from '@app/core'
import { buildHTTPErrorResponse, genericUploadErrorHandler, getUploadXRetryConfig } from '@app/helpers'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { BytesPipe } from '@app/shared/shared-main/common/bytes.pipe'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { HttpStatusCode, UserImport, UserImportState } from '@peertube/peertube-models'
import { UploadState, UploaderX, UploadxService } from 'ngx-uploadx'
import { Subscription } from 'rxjs'
import { UploadProgressComponent } from '../../shared/standalone-upload/upload-progress.component'
import { UserImportExportService } from './user-import-export.service'

@Component({
  selector: 'my-account-import',
  templateUrl: './my-account-import.component.html',
  styleUrls: [ './my-account-import.component.scss' ],
  imports: [ NgIf, UploadProgressComponent, NgbTooltip, PTDatePipe, AlertComponent ]
})
export class MyAccountImportComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  @Input() videoQuotaUsed: number

  uploadingArchive = false
  archiveUploadFinished = false

  error: string
  enableRetryAfterError: boolean
  uploadPercents = 0

  latestImport: UserImport

  private fileToUpload: File
  private uploadServiceSubscription: Subscription
  private alreadyRefreshedToken = false

  constructor (
    private authService: AuthService,
    private server: ServerService,
    private userImportExportService: UserImportExportService,
    private resumableUploadService: UploadxService,
    private notifier: Notifier
  ) {}

  ngOnInit () {
    this.userImportExportService.getLatestImport({ userId: this.authService.getUser().id })
      .subscribe(res => this.latestImport = res)

    this.uploadServiceSubscription = this.resumableUploadService.events
      .subscribe(state => this.onUploadOngoing(state))
  }

  ngOnDestroy () {
    this.resumableUploadService.disconnect()

    if (this.uploadServiceSubscription) this.uploadServiceSubscription.unsubscribe()
  }

  canDeactivate () {
    return {
      canDeactivate: !this.uploadingArchive,
      text: $localize`Your archive file is not uploaded yet, are you sure you want to leave this page?`
    }
  }

  isImportEnabled () {
    return this.server.getHTMLConfig().import.users.enabled
  }

  isEmailEnabled () {
    return this.server.getHTMLConfig().email.enabled
  }

  onUploadOngoing (state: UploadState) {
    switch (state.status) {
      case 'error': {
        if (!this.alreadyRefreshedToken && state.responseStatus === HttpStatusCode.UNAUTHORIZED_401) {
          this.alreadyRefreshedToken = true

          return this.refreshTokenAndRetryUpload()
        }

        this.handleUploadError(buildHTTPErrorResponse(state))
        break
      }

      case 'cancelled':
        this.uploadingArchive = false
        this.uploadPercents = 0

        this.enableRetryAfterError = false
        this.error = ''
        break

      case 'uploading':
        this.uploadPercents = state.progress
        break

      case 'complete':
        this.archiveUploadFinished = true
        this.uploadPercents = 100
        this.uploadingArchive = false

        break
    }
  }

  onFileChange (event: Event | { target: HTMLInputElement }) {
    const inputEl = event.target as HTMLInputElement
    const file = inputEl.files[0]
    if (!file) return

    const user = this.authService.getUser()

    if (user.videoQuota !== -1 && this.videoQuotaUsed + file.size > user.videoQuota) {
      const bytePipes = new BytesPipe()
      const fileSizeBytes = bytePipes.transform(file.size, 0)
      const videoQuotaUsedBytes = bytePipes.transform(this.videoQuotaUsed, 0)
      const videoQuotaBytes = bytePipes.transform(user.videoQuota, 0)

      this.notifier.error(
        // eslint-disable-next-line max-len
        $localize`Cannot import this file as your video quota would be exceeded (import size: ${fileSizeBytes}, used: ${videoQuotaUsedBytes}, quota: ${videoQuotaBytes})`
      )

      inputEl.value = ''

      return
    }

    this.fileToUpload = file

    this.uploadFile(file)
  }

  cancelUpload () {
    this.resumableUploadService.control({ action: 'cancel' })
  }

  retryUpload () {
    this.enableRetryAfterError = false
    this.error = ''
    this.uploadFile(this.fileToUpload)
  }

  hasPendingImport () {
    if (!this.latestImport) return false

    const state = this.latestImport.state.id
    return state === UserImportState.PENDING || state === UserImportState.PROCESSING
  }

  private uploadFile (file: File) {
    this.resumableUploadService.handleFiles(file, {
      endpoint: `${UserImportExportService.BASE_USER_IMPORTS_URL}${this.authService.getUser().id}/imports/import-resumable`,
      multiple: false,

      maxChunkSize: this.server.getHTMLConfig().client.videos.resumableUpload.maxChunkSize,

      token: this.authService.getAccessToken(),

      uploaderClass: UploaderX,

      retryConfig: getUploadXRetryConfig(),

      metadata: {
        filename: file.name
      }
    })

    this.uploadingArchive = true
  }

  private handleUploadError (err: HttpErrorResponse) {
    // Reset progress
    this.uploadPercents = 0
    this.enableRetryAfterError = true

    this.error = genericUploadErrorHandler({
      err,
      name: $localize`archive`,
      notifier: this.notifier,
      sticky: false
    })

    if (err.status === HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415) {
      this.cancelUpload()
    }
  }

  private refreshTokenAndRetryUpload () {
    this.authService.refreshAccessToken()
      .subscribe(() => this.retryUpload())
  }
}

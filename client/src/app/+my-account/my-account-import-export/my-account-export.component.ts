import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { AuthService, ServerService } from '@app/core'
import { PeerTubeProblemDocument, ServerErrorCode, UserExport, UserExportState } from '@peertube/peertube-models'
import { UserImportExportService } from './user-import-export.service'
import { concatMap, first, from, of, switchMap, toArray } from 'rxjs'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-account-export',
  templateUrl: './my-account-export.component.html',
  styleUrls: [ './my-account-export.component.scss' ]
})
export class MyAccountExportComponent implements OnInit {
  @ViewChild('exportModal', { static: true }) exportModal: NgbModal

  @Input() videoQuotaUsed: number

  userExports: UserExport[] = []

  exportWithVideosFiles: boolean
  errorInModal: string

  archiveWeightEstimation: number

  private exportModalOpened: NgbModalRef
  private requestingArchive = false

  constructor (
    private authService: AuthService,
    private server: ServerService,
    private userImportExportService: UserImportExportService,
    private modalService: NgbModal
  ) {}

  ngOnInit () {
    this.archiveWeightEstimation = this.videoQuotaUsed
    this.authService.userInformationLoaded
      .pipe(first())
      .subscribe(() => this.reloadUserExports())
  }

  isExportEnabled () {
    return this.server.getHTMLConfig().export.users.enabled
  }

  isEmailEnabled () {
    return this.server.getHTMLConfig().email.enabled
  }

  isRequestArchiveDisabled () {
    return this.userExports.some(e => {
      const id = e.state.id

      return id === UserExportState.PENDING || id === UserExportState.PROCESSING
    })
  }

  hasAlreadyACompletedArchive () {
    return this.userExports.some(e => e.state.id === UserExportState.COMPLETED)
  }

  openNewArchiveModal () {
    this.exportWithVideosFiles = false
    this.errorInModal = undefined

    this.exportModalOpened = this.modalService.open(this.exportModal, { centered: true })
  }

  requestNewArchive () {
    if (this.requestingArchive) return
    this.requestingArchive = true

    let baseObs = of<any>(true)

    if (this.userExports.length !== 0) {
      baseObs = from(this.userExports.map(e => e.id))
        .pipe(
          concatMap(id => this.userImportExportService.deleteUserExport({ userId: this.getUserId(), userExportId: id })),
          toArray()
        )
    }

    baseObs.pipe(
      switchMap(() => {
        return this.userImportExportService.requestNewUserExport({ withVideoFiles: this.exportWithVideosFiles, userId: this.getUserId() })
      })
    ).subscribe({
      next: () => {
        this.reloadUserExports()

        this.exportModalOpened.close()
        this.requestingArchive = false
      },

      error: err => {
        this.requestingArchive = false

        const error = err.body as PeerTubeProblemDocument

        if (error.code === ServerErrorCode.MAX_USER_VIDEO_QUOTA_EXCEEDED_FOR_USER_EXPORT) {
          // eslint-disable-next-line max-len
          this.errorInModal = $localize`Video files cannot be included in the export because you have exceeded the maximum video quota allowed by your administrator to export this archive.`
          return
        }

        this.errorInModal = err.message
      }
    })
  }

  private reloadUserExports () {
    if (!this.isExportEnabled()) return

    this.userImportExportService.listUserExports({ userId: this.authService.getUser().id })
      .subscribe(({ data }) => this.userExports = data)
  }

  private getUserId () {
    return this.authService.getUser().id
  }
}

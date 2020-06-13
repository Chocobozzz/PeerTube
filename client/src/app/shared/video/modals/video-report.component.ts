import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { FormReactive } from '../../../shared/forms'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { VideoAbuseValidatorsService } from '@app/shared/forms/form-validators/video-abuse-validators.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { VideoAbuseService, VideoAbusePredefinedReasons, PredefinedReasons } from '@app/shared/video-abuse'
import { Video } from '@app/shared/video/video.model'
import { buildVideoEmbed } from 'src/assets/player/utils'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'

@Component({
  selector: 'my-video-report',
  templateUrl: './video-report.component.html',
  styleUrls: [ './video-report.component.scss' ]
})
export class VideoReportComponent extends FormReactive implements OnInit {
  @Input() video: Video = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  error: string = null
  predefinedReasons: { id: PredefinedReasons, label: string, description?: string, help?: string }[] = []
  embedHtml: SafeHtml

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private videoAbuseValidatorsService: VideoAbuseValidatorsService,
    private videoAbuseService: VideoAbuseService,
    private notifier: Notifier,
    private sanitizer: DomSanitizer,
    private i18n: I18n
  ) {
    super()
  }

  get currentHost () {
    return window.location.host
  }

  get originHost () {
    if (this.isRemoteVideo()) {
      return this.video.account.host
    }

    return ''
  }

  get timestamp () {
    return this.form.get('timestamp').value
  }

  getVideoEmbed () {
    return this.sanitizer.bypassSecurityTrustHtml(
      buildVideoEmbed(this.video.embedUrl)
    )
  }

  ngOnInit () {
    const predefinedReasons: Required<VideoAbusePredefinedReasons> = {
      violentOrRepulsive: null,
      hatefulOrAbusive: null,
      spamOrMisleading: null,
      privacy: null,
      rights: null,
      serverRules: null,
      captions: null,
      thumbnails: null
    }

    this.buildForm({
      reason: this.videoAbuseValidatorsService.VIDEO_ABUSE_REASON,
      predefinedReasons: predefinedReasons as {[key: string]: null},
      timestamp: {
        hasStart: null,
        startAt: null,
        hasEnd: null,
        endAt: null
      }
    })

    this.predefinedReasons = [
      {
        id: PredefinedReasons.violentOrRepulsive,
        label: this.i18n('Violent or repulsive'),
        help: this.i18n('Contains offensive, violent, or coarse language or iconography.')
      },
      {
        id: PredefinedReasons.hatefulOrAbusive,
        label: this.i18n('Hateful or abusive'),
        help: this.i18n('Contains abusive, racist or sexist language or iconography.')
      },
      {
        id: PredefinedReasons.spamOrMisleading,
        label: this.i18n('Spam, ad or false news'),
        help: this.i18n('Contains marketing, spam, purposefully deceitful news, or otherwise misleading thumbnail/text/tags. Please provide reputable sources to report hoaxes.')
      },
      {
        id: PredefinedReasons.privacy,
        label: this.i18n('Privacy breach or doxxing'),
        help: this.i18n('Contains personal information that could be used to track, identify, contact or impersonate someone (e.g. name, address, phone number, email, or credit card details).')
      },
      {
        id: PredefinedReasons.rights,
        label: this.i18n('Intellectual property violation'),
        help: this.i18n('Infringes my intellectual property or copyright, wrt. the regional rules with which the server must comply.')
      },
      {
        id: PredefinedReasons.serverRules,
        label: this.i18n('Breaks server rules'),
        description: this.i18n('Anything not included in the above that breaks the terms of service, code of conduct, or general rules in place on the server.')
      },
      {
        id: PredefinedReasons.thumbnails,
        label: this.i18n('Thumbnails'),
        help: this.i18n('The above can only be seen in thumbnails.')
      },
      {
        id: PredefinedReasons.captions,
        label: this.i18n('Captions'),
        help: this.i18n('The above can only be seen in captions (please describe which).')
      }
    ]

    this.embedHtml = this.getVideoEmbed()
  }

  show () {
    this.openedModal = this.modalService.open(this.modal, { centered: true, keyboard: false, size: 'lg' })
  }

  hide () {
    this.openedModal.close()
    this.openedModal = null
  }

  report () {
    this.videoAbuseService.reportVideo({ id: this.video.id, ...this.form.value })
                          .subscribe(
                            () => {
                              this.notifier.success(this.i18n('Video reported.'))
                              this.hide()
                            },

                            err => this.notifier.error(err.message)
                           )
  }

  isRemoteVideo () {
    return !this.video.isLocal
  }
}

import { mapValues, pickBy } from 'lodash-es'
import { buildVideoEmbed, buildVideoLink } from 'src/assets/player/utils'
import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { Notifier } from '@app/core'
import { FormReactive, FormValidatorService, VideoAbuseValidatorsService } from '@app/shared/shared-forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { videoAbusePredefinedReasonsMap, VideoAbusePredefinedReasonsString } from '@shared/models/videos/abuse/video-abuse-reason.model'
import { Video } from '../shared-main'
import { VideoAbuseService } from './video-abuse.service'

@Component({
  selector: 'my-video-report',
  templateUrl: './video-report.component.html',
  styleUrls: [ './video-report.component.scss' ]
})
export class VideoReportComponent extends FormReactive implements OnInit {
  @Input() video: Video = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  error: string = null
  predefinedReasons: { id: VideoAbusePredefinedReasonsString, label: string, description?: string, help?: string }[] = []
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
      buildVideoEmbed(
        buildVideoLink({
          baseUrl: this.video.embedUrl,
          title: false,
          warningTitle: false
        })
      )
    )
  }

  ngOnInit () {
    this.buildForm({
      reason: this.videoAbuseValidatorsService.VIDEO_ABUSE_REASON,
      predefinedReasons: mapValues(videoAbusePredefinedReasonsMap, r => null),
      timestamp: {
        hasStart: null,
        startAt: null,
        hasEnd: null,
        endAt: null
      }
    })

    this.predefinedReasons = [
      {
        id: 'violentOrRepulsive',
        label: this.i18n('Violent or repulsive'),
        help: this.i18n('Contains offensive, violent, or coarse language or iconography.')
      },
      {
        id: 'hatefulOrAbusive',
        label: this.i18n('Hateful or abusive'),
        help: this.i18n('Contains abusive, racist or sexist language or iconography.')
      },
      {
        id: 'spamOrMisleading',
        label: this.i18n('Spam, ad or false news'),
        help: this.i18n('Contains marketing, spam, purposefully deceitful news, or otherwise misleading thumbnail/text/tags. Please provide reputable sources to report hoaxes.')
      },
      {
        id: 'privacy',
        label: this.i18n('Privacy breach or doxxing'),
        help: this.i18n('Contains personal information that could be used to track, identify, contact or impersonate someone (e.g. name, address, phone number, email, or credit card details).')
      },
      {
        id: 'rights',
        label: this.i18n('Intellectual property violation'),
        help: this.i18n('Infringes my intellectual property or copyright, wrt. the regional rules with which the server must comply.')
      },
      {
        id: 'serverRules',
        label: this.i18n('Breaks server rules'),
        description: this.i18n('Anything not included in the above that breaks the terms of service, code of conduct, or general rules in place on the server.')
      },
      {
        id: 'thumbnails',
        label: this.i18n('Thumbnails'),
        help: this.i18n('The above can only be seen in thumbnails.')
      },
      {
        id: 'captions',
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
    const reason = this.form.get('reason').value
    const predefinedReasons = Object.keys(pickBy(this.form.get('predefinedReasons').value)) as VideoAbusePredefinedReasonsString[]
    const { hasStart, startAt, hasEnd, endAt } = this.form.get('timestamp').value

    this.videoAbuseService.reportVideo({
      id: this.video.id,
      reason,
      predefinedReasons,
      startAt: hasStart && startAt ? startAt : undefined,
      endAt: hasEnd && endAt ? endAt : undefined
    }).subscribe(
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

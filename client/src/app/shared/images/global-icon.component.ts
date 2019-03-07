import { Component, ElementRef, Input, OnInit } from '@angular/core'

const icons = {
  'add': require('../../../assets/images/global/add.html'),
  'syndication': require('../../../assets/images/global/syndication.html'),
  'help': require('../../../assets/images/global/help.html'),
  'sparkle': require('../../../assets/images/global/sparkle.html'),
  'alert': require('../../../assets/images/global/alert.html'),
  'cloud-error': require('../../../assets/images/global/cloud-error.html'),
  'user-add': require('../../../assets/images/global/user-add.html'),
  'no': require('../../../assets/images/global/no.html'),
  'cloud-download': require('../../../assets/images/global/cloud-download.html'),
  'undo': require('../../../assets/images/global/undo.html'),
  'circle-tick': require('../../../assets/images/global/circle-tick.html'),
  'cog': require('../../../assets/images/global/cog.html'),
  'download': require('../../../assets/images/global/download.html'),
  'edit': require('../../../assets/images/global/edit.html'),
  'im-with-her': require('../../../assets/images/global/im-with-her.html'),
  'delete': require('../../../assets/images/global/delete.html'),
  'cross': require('../../../assets/images/global/cross.html'),
  'validate': require('../../../assets/images/global/validate.html'),
  'tick': require('../../../assets/images/global/tick.html'),
  'dislike': require('../../../assets/images/video/dislike.html'),
  'heart': require('../../../assets/images/video/heart.html'),
  'like': require('../../../assets/images/video/like.html'),
  'more': require('../../../assets/images/video/more.html'),
  'share': require('../../../assets/images/video/share.html'),
  'upload': require('../../../assets/images/video/upload.html'),
  'playlist-add': require('../../../assets/images/video/playlist-add.html')
}

export type GlobalIconName = keyof typeof icons

@Component({
  selector: 'my-global-icon',
  template: '',
  styleUrls: [ './global-icon.component.scss' ]
})
export class GlobalIconComponent implements OnInit {
  @Input() iconName: GlobalIconName

  constructor (private el: ElementRef) {}

  ngOnInit () {
    const nativeElement = this.el.nativeElement

    nativeElement.innerHTML = icons[this.iconName]
  }
}

import { ChangeDetectionStrategy, Component, ElementRef, Input, OnInit } from '@angular/core'
import { HooksService } from '@app/core/plugins/hooks.service'

const icons = {
  'add': require('!!raw-loader?!../../../assets/images/global/add.svg'),
  'user': require('!!raw-loader?!../../../assets/images/global/user.svg'),
  'sign-out': require('!!raw-loader?!../../../assets/images/global/sign-out.svg'),
  'syndication': require('!!raw-loader?!../../../assets/images/global/syndication.svg'),
  'help': require('!!raw-loader?!../../../assets/images/global/help.svg'),
  'sparkle': require('!!raw-loader?!../../../assets/images/global/sparkle.svg'),
  'alert': require('!!raw-loader?!../../../assets/images/global/alert.svg'),
  'cloud-error': require('!!raw-loader?!../../../assets/images/global/cloud-error.svg'),
  'clock': require('!!raw-loader?!../../../assets/images/global/clock.svg'),
  'user-add': require('!!raw-loader?!../../../assets/images/global/user-add.svg'),
  'no': require('!!raw-loader?!../../../assets/images/global/no.svg'),
  'cloud-download': require('!!raw-loader?!../../../assets/images/global/cloud-download.svg'),
  'undo': require('!!raw-loader?!../../../assets/images/global/undo.svg'),
  'history': require('!!raw-loader?!../../../assets/images/global/history.svg'),
  'circle-tick': require('!!raw-loader?!../../../assets/images/global/circle-tick.svg'),
  'cog': require('!!raw-loader?!../../../assets/images/global/cog.svg'),
  'download': require('!!raw-loader?!../../../assets/images/global/download.svg'),
  'go': require('!!raw-loader?!../../../assets/images/menu/go.svg'),
  'edit': require('!!raw-loader?!../../../assets/images/global/edit.svg'),
  'im-with-her': require('!!raw-loader?!../../../assets/images/global/im-with-her.svg'),
  'delete': require('!!raw-loader?!../../../assets/images/global/delete.svg'),
  'server': require('!!raw-loader?!../../../assets/images/global/server.svg'),
  'cross': require('!!raw-loader?!../../../assets/images/global/cross.svg'),
  'validate': require('!!raw-loader?!../../../assets/images/global/validate.svg'),
  'tick': require('!!raw-loader?!../../../assets/images/global/tick.svg'),
  'repeat': require('!!raw-loader?!../../../assets/images/global/repeat.svg'),
  'inbox-full': require('!!raw-loader?!../../../assets/images/global/inbox-full.svg'),
  'dislike': require('!!raw-loader?!../../../assets/images/video/dislike.svg'),
  'support': require('!!raw-loader?!../../../assets/images/video/support.svg'),
  'like': require('!!raw-loader?!../../../assets/images/video/like.svg'),
  'more-horizontal': require('!!raw-loader?!../../../assets/images/global/more-horizontal.svg'),
  'more-vertical': require('!!raw-loader?!../../../assets/images/global/more-vertical.svg'),
  'share': require('!!raw-loader?!../../../assets/images/video/share.svg'),
  'upload': require('!!raw-loader?!../../../assets/images/video/upload.svg'),
  'playlist-add': require('!!raw-loader?!../../../assets/images/video/playlist-add.svg'),
  'play': require('!!raw-loader?!../../../assets/images/global/play.svg'),
  'playlists': require('!!raw-loader?!../../../assets/images/global/playlists.svg'),
  'globe': require('!!raw-loader?!../../../assets/images/menu/globe.svg'),
  'home': require('!!raw-loader?!../../../assets/images/menu/home.svg'),
  'recently-added': require('!!raw-loader?!../../../assets/images/menu/recently-added.svg'),
  'trending': require('!!raw-loader?!../../../assets/images/menu/trending.svg'),
  'video-lang': require('!!raw-loader?!../../../assets/images/global/video-lang.svg'),
  'videos': require('!!raw-loader?!../../../assets/images/global/videos.svg'),
  'folder': require('!!raw-loader?!../../../assets/images/global/folder.svg'),
  'subscriptions': require('!!raw-loader?!../../../assets/images/menu/subscriptions.svg'),
  'language': require('!!raw-loader?!../../../assets/images/menu/language.svg'),
  'unsensitive': require('!!raw-loader?!../../../assets/images/menu/eye.svg'),
  'sensitive': require('!!raw-loader?!../../../assets/images/menu/eye-closed.svg'),
  'p2p': require('!!raw-loader?!../../../assets/images/menu/p2p.svg'),
  'users': require('!!raw-loader?!../../../assets/images/global/users.svg'),
  'search': require('!!raw-loader?!../../../assets/images/global/search.svg'),
  'refresh': require('!!raw-loader?!../../../assets/images/global/refresh.svg')
}

export type GlobalIconName = keyof typeof icons

@Component({
  selector: 'my-global-icon',
  template: '',
  styleUrls: [ './global-icon.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GlobalIconComponent implements OnInit {
  @Input() iconName: GlobalIconName

  constructor (
    private el: ElementRef,
    private hooks: HooksService
  ) { }

  async ngOnInit () {
    const nativeElement = this.el.nativeElement as HTMLElement
    nativeElement.innerHTML = await this.hooks.wrapFun(
      this.getSVGContent.bind(this),
      { name: this.iconName },
      'common',
      'filter:internal.common.svg-icons.get-content.params',
      'filter:internal.common.svg-icons.get-content.result'
    )
  }

  private getSVGContent (options: { name: string }) {
    return icons[options.name]
  }
}

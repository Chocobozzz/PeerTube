import { ChangeDetectionStrategy, Component, ElementRef, Input, OnInit } from '@angular/core'
import { HooksService } from '@app/core/plugins/hooks.service'

const icons = {
  // misc icons
  'npm': require('../../../assets/images/misc/npm.svg'),
  'markdown': require('../../../assets/images/misc/markdown.svg'),
  'language': require('../../../assets/images/misc/language.svg'),
  'video-lang': require('../../../assets/images/misc/video-lang.svg'),
  'support': require('../../../assets/images/misc/support.svg'),
  'peertube-x': require('../../../assets/images/misc/peertube-x.svg'),
  'robot': require('../../../assets/images/misc/miscellaneous-services.svg'), // material ui
  'videos': require('../../../assets/images/misc/video-library.svg'), // material ui
  'history': require('../../../assets/images/misc/history.svg'), // material ui
  'subscriptions': require('../../../assets/images/misc/subscriptions.svg'), // material ui
  'playlist-add': require('../../../assets/images/misc/playlist-add.svg'), // material ui
  'follower': require('../../../assets/images/misc/account-arrow-left.svg'), // material ui
  'following': require('../../../assets/images/misc/account-arrow-right.svg'), // material ui
  'tip': require('../../../assets/images/misc/tip.svg'), // material ui
  'flame': require('../../../assets/images/misc/flame.svg'),
  'local': require('../../../assets/images/misc/local.svg'),

  // feather/lucide icons
  'copy': require('../../../assets/images/feather/copy.svg'),
  'flag': require('../../../assets/images/feather/flag.svg'),
  'playlists': require('../../../assets/images/feather/list.svg'),
  'syndication': require('../../../assets/images/feather/syndication.svg'),
  'help': require('../../../assets/images/feather/help.svg'),
  'alert': require('../../../assets/images/feather/alert.svg'),
  'globe': require('../../../assets/images/feather/globe.svg'),
  'home': require('../../../assets/images/feather/home.svg'),
  'trending': require('../../../assets/images/feather/trending.svg'),
  'search': require('../../../assets/images/feather/search.svg'),
  'upload': require('../../../assets/images/feather/upload.svg'),
  'dislike': require('../../../assets/images/feather/dislike.svg'),
  'like': require('../../../assets/images/feather/like.svg'),
  'no': require('../../../assets/images/feather/no.svg'),
  'cloud-download': require('../../../assets/images/feather/cloud-download.svg'),
  'clock': require('../../../assets/images/feather/clock.svg'),
  'cog': require('../../../assets/images/feather/cog.svg'),
  'delete': require('../../../assets/images/feather/delete.svg'),
  'bell': require('../../../assets/images/feather/bell.svg'),
  'sign-out': require('../../../assets/images/feather/log-out.svg'),
  'sign-in': require('../../../assets/images/feather/log-in.svg'),
  'download': require('../../../assets/images/feather/download.svg'),
  'ownership-change': require('../../../assets/images/feather/share.svg'),
  'share': require('../../../assets/images/feather/share-2.svg'),
  'channel': require('../../../assets/images/feather/tv.svg'),
  'user': require('../../../assets/images/feather/user.svg'),
  'user-x': require('../../../assets/images/feather/user-x.svg'),
  'users': require('../../../assets/images/feather/users.svg'),
  'user-add': require('../../../assets/images/feather/user-plus.svg'),
  'add': require('../../../assets/images/feather/plus-circle.svg'),
  'cloud-error': require('../../../assets/images/feather/cloud-off.svg'),
  'undo': require('../../../assets/images/feather/corner-up-left.svg'),
  'circle-tick': require('../../../assets/images/feather/check-circle.svg'),
  'more-horizontal': require('../../../assets/images/feather/more-horizontal.svg'),
  'more-vertical': require('../../../assets/images/feather/more-vertical.svg'),
  'play': require('../../../assets/images/feather/play.svg'),
  'p2p': require('../../../assets/images/feather/airplay.svg'),
  'fullscreen': require('../../../assets/images/feather/maximize.svg'),
  'exit-fullscreen': require('../../../assets/images/feather/minimize.svg'),
  'film': require('../../../assets/images/feather/film.svg'),
  'edit': require('../../../assets/images/feather/edit-2.svg'),
  'external-link': require('../../../assets/images/feather/external-link.svg'),
  'eye-open': require('../../../assets/images/feather/eye.svg'),
  'eye-close': require('../../../assets/images/feather/eye-off.svg'),
  'refresh': require('../../../assets/images/feather/refresh-cw.svg'),
  'command': require('../../../assets/images/feather/command.svg'),
  'go': require('../../../assets/images/feather/arrow-up-right.svg'),
  'cross': require('../../../assets/images/feather/x.svg'),
  'tick': require('../../../assets/images/feather/check.svg'),
  'columns': require('../../../assets/images/feather/columns.svg'),
  'live': require('../../../assets/images/feather/live.svg'),
  'repeat': require('../../../assets/images/feather/repeat.svg'),
  'chevrons-up': require('../../../assets/images/feather/chevrons-up.svg'),
  'message-circle': require('../../../assets/images/feather/message-circle.svg'),
  'codesandbox': require('../../../assets/images/feather/codesandbox.svg'),
  'award': require('../../../assets/images/feather/award.svg'),
  'stats': require('../../../assets/images/feather/stats.svg'),
  'filter': require('../../../assets/images/feather/filter.svg'),
  'shield': require('../../../assets/images/misc/shield.svg')
}

export type GlobalIconName = keyof typeof icons

@Component({
  selector: 'my-global-icon',
  template: '',
  styleUrls: [ './global-icon.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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
    nativeElement.ariaHidden = 'true'
  }

  private getSVGContent (options: { name: GlobalIconName }) {
    return icons[options.name]
  }
}

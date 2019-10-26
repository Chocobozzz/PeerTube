peertube(8) -- companion CLI for PeerTube
=========================================

SYNOPSIS
--------

```
peertube [command] [options]
```

DESCRIPTION
-----------

`peertube` wraps various utilities around PeerTube that are used either on a running local, running remote, or cold local instance.

COMMANDS
--------

Unless otherwise specified, every command can be queried for its own help or manual by passing its name to the `help` command, or by using the `--help` option.

`auth [action]`: stores credentials for your accounts on remote instances, so that you don't need to pass them at every command

`upload|up`: upload a video to a remote instance

    $ peertube upload \
        -u "PEERTUBE_URL" \
        -U "PEERTUBE_USER" \
        --password "PEERTUBE_PASSWORD"

`import-videos|import`: import a video from a streaming platform to a remote instance

    $ peertube import \
        -u "PEERTUBE_URL" \
        -U "PEERTUBE_USER" \
        --password "PEERTUBE_PASSWORD" \
        -t "TARGET_URL"

    The target URL can be directly the video file, or any of the supported sites of youtube-dl. The video is downloaded locally and then uploaded. Already downloaded videos will not be uploaded twice, so you can run and re-run the script in case of crash, disconnection…

`watch|w`: watch a video in the terminal ✩°｡⋆

    -g, --gui <player>      player type (default: ascii)
    -i, --invert            invert colors (ascii player only)
    -r, --resolution <res>  video resolution (default: 720)

    It provides support for different players:

    - ascii (default ; plays in ascii art in your terminal!)
    - mpv
    - mplayer
    - vlc
    - stdout
    - xbmc
    - airplay
    - chromecast

`repl`: interact with the application libraries and objects even when PeerTube is not running

    Type .help to see the repl-only functions, or to see the available PeerTube core functions:
   
    repl> lodash.keys(context)

`help [cmd]`: display help for [cmd]

EXAMPLES
--------

    $ peertube auth add -u "PEERTUBE_URL" -U "PEERTUBE_USER" --password "PEERTUBE_PASSWORD"
    $ peertube up <videoFile>
    $ peertube watch https://peertube.cpy.re/videos/watch/e8a1af4e-414a-4d58-bfe6-2146eed06d10

SEE ALSO
--------

[PeerTube Tools Documentation](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/tools.md)

[PeerTube Admin Documentation](https://docs.joinpeertube.org/lang/en/docs/)

REPORTING BUGS
--------------

See [PeerTube repository](https://github.com/Chocobozzz/PeerTube).

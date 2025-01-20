# PeerTube Embed API

PeerTube lets you embed videos and programmatically control their playback. This documentation covers how to interact with the PeerTube Embed API.

## Playground

Any PeerTube embed URL (ie `https://my-instance.example.com/videos/embed/52a10666-3a18-4e73-93da-e8d3c12c305a`) can be viewed as an embedding playground which
allows you to test various aspects of PeerTube embeds. Simply replace `/embed` with `/test-embed` and visit the URL in a browser.
For instance, the playground URL for the above embed URL is `https://my-instance.example.com/videos/test-embed/52a10666-3a18-4e73-93da-e8d3c12c305a`.

## Quick Start

Given an existing PeerTube embed `<iframe>` **with API enabled** (`https://my-instance.example.com/videos/embed/52a10666-3a18-4e73-93da-e8d3c12c305a?api=1`),
one can use the PeerTube Embed API to control it by first including the library. You can include it via Yarn with:

```
yarn add @peertube/embed-api
```

Now just use the `PeerTubePlayer` class exported by the module:

```typescript
import { PeerTubePlayer } from '@peertube/embed-api.js'

...
```

Or use the minified build from NPM CDN in your HTML file:

```
<script src="https://unpkg.com/@peertube/embed-api/build/player.min.js"></script>

<script>
  const PeerTubePlayer = window['PeerTubePlayer']

  ...
</script>
```

Then you can instantiate the player:

```typescript
let player = new PeerTubePlayer(document.querySelector('iframe'))
await player.ready // wait for the player to be ready

// now you can use it!
player.play()
player.seek(32)
player.pause()
```

## Embed URL parameters

You can customize PeerTube player by specifying URL query parameters.
For example `https://my-instance.example.com/videos/embed/52a10666-3a18-4e73-93da-e8d3c12c305a?start=1s&stop=18s&loop=1&autoplay=1&muted=1&warningTitle=0&controlBar=0&peertubeLink=0&p2p=0`

### start

Start the video at a specific time.
Value must be raw seconds or a duration (`3m4s`)
Default: starts at `0`

### stop

Stop the video at a specific time.
Value must be raw seconds or a duration (`54s`)
Default: ends at content end

### controls

Mimics video HTML element `controls` attribute, meaning that all controls (including big play button, control bar, etc.) will be removed.
It can be useful if you want to have a full control of the PeerTube player.

Value must be `0` or `1`.
Default: `1`

### controlBar

Hide control bar when the video is played.

Value must be `0` or `1`.
Default: `1`

### peertubeLink

Hide PeerTube instance link in control bar.

Value must be `0` or `1`.
Default: `1`

### muted

Mute the video by default.

Value must be `0` or `1`.
Default: tries to restore the last muted setting set by the user

### loop

Automatically start again the video when it ends.

Value must be `0` or `1`.
Default: `0`

### subtitle

Auto select a subtitle by default.

Value must be a valid subtitle ISO code (`fr`, `en`, etc.).
Default: no subtitle selected and then tries to restore the last subtitle set by the user

### autoplay

Try to automatically play the video.
Most web browsers disable video autoplay if the user did not interact with the video. You can try to bypass this limitation by muting the video

Value must be `0` or `1`.
Default: `0`

### playbackRate

Force the default playback rate (`0.75`, `1.5` etc).
Default: `1`

### title

Show/Hide embed title.

Value must be `0` or `1`.
Default: `1`

### warningTitle

Show/Hide P2P warning title.

Value must be `0` or `1`.
Default: `1`

### p2p

Enable/Disable P2P.

Value must be `0` or `1`.
Default: tries to use the user setting and fallbacks to instance setting if user setting is not found

### bigPlayBackgroundColor

Customize big play button background color.

Value must be a valid color (`red` or `rgba(100, 100, 100, 0.5)`).
Default: rgba(0, 0, 0, 0.8)

### foregroundColor

Customize embed font color.

Value must be a valid color (`red` or `rgba(100, 100, 100, 0.5)`).

Default: `white`

### mode

Force a specific player engine.

Value must be a valid mode (`web-video` or `p2p-media-loader`).

See behaviour description [here](https://docs.joinpeertube.org/admin/configuration#vod-transcoding)

Default: `p2p-media-loader` and fallback to `web-video` mode.


### playlistPosition

If you are embedding a playlist, select the video to play by specifying its position.

Value must be a number.

Default: `1`

### api

Enable/Disable embed JavaScript API (see methods below).

Value must be `0` or `1`.

Default: `0`

### waitPasswordFromEmbedAPI

**PeerTube >= 6.0**

If the video requires a password, PeerTube will wait a password provided by `setVideoPassword` method before loading the video.

Until you provide a password, `player.ready` is not resolved.

Value must be `0` or `1`.

Default: `0`


## Embed attributes

### `ready: Promise<void>`

This promise is resolved when the video is loaded and the player is ready.


## Embed methods

### `isPlaying(): Promise<boolean>`

**PeerTube >= 7.0**

Check if the player is playing the media.

### `play(): Promise<void>`

Starts playback, or resumes playback if it is paused.

### `pause(): Promise<void>`

Pauses playback.

### `getCurrentTime(): Promise<number>`

**PeerTube >= 7.0**

Get player current time in seconds.

### `seek(positionInSeconds : number): Promise<void>`

Seek to the given position, as specified in seconds into the video.

### `addEventListener(eventName : string, handler : Function)`

Add a listener for a specific event. See below for the available events.

### `removeEventListener(eventName : string, handler : Function)`

Remove a listener.

### `getResolutions() : Promise<PeerTubeResolution[]>`

Get the available resolutions. A `PeerTubeResolution` looks like:

```json
{
    "id": 3,
    "label": "720p",
    "height": "720",
    "active": true
}
```

`active` is true if the resolution is the currently selected resolution.

### `setResolution(resolutionId : number): Promise<void>`

Change the current resolution. Pass `-1` for automatic resolution (when available).
Otherwise, `resolutionId` should be the ID of an object returned by `getResolutions()`

### `getPlaybackRates() : Promise<number[]>`

Get the available playback rates, where `1` represents normal speed, `0.5` is half speed, `2` is double speed, etc.

### `getPlaybackRate() : Promise<number>`

Get the current playback rate. See `getPlaybackRates()` for more information.

### `setPlaybackRate(rate: number) : Promise<void>`

Set the current playback rate. The passed rate should be a value as returned by `getPlaybackRates()`.

### `setVolume(factor: number) : Promise<void>`

Set the playback volume. Value should be between `0` and `1`.

### `getVolume(): Promise<number>`

Get the playback volume. Returns a value between `0` and `1`.

### `setCaption(id: string) : Promise<void>`

Update current caption using the caption id.

### `getCaptions(): Promise<{ id: string, label: string, src: string, mode: 'disabled' | 'showing' }>`

Get video captions.

### `playNextVideo(): Promise<void>`

Play next video in playlist.

### `playPreviousVideo(): Promise<void>`

Play previous video in playlist.

### `getCurrentPosition(): Promise<void>`

Get current position in playlist (starts from 1).


### `setVideoPassword(): Promise<void>`

**PeerTube >= 6.0**

Set the video password so the user doesn't have to manually fill it.
`waitPasswordFromEmbedAPI=1` is required in embed URL.


### `getImageDataUrl(): Promise<string>`

**PeerTube >= 6.2**

Get the current frame as JPEG image data URL.


## Embed events

You can subscribe to events by using `addEventListener()`. See above for details.

### Event `playbackStatusUpdate`

Fired every half second to provide the current status of playback.
The parameter of the callback will resemble:

```json
{
  "position": 22.3,
  "volume": 0.9,
  "duration": "171.37499",
  "playbackState": "playing"
}
```

`duration` field and `ended` `playbackState` are available in PeerTube >= 2.2.

The `volume` field contains the volume from `0` (silent) to `1` (full volume).
The `playbackState` can be `unstarted`, `playing`, `paused` or `ended`. More states may be added later.

### Event `playbackStatusChange`

Fired when playback transitions between states, such as `paused` and `playing`. More states may be added later.

### Event `resolutionUpdate`

Fired when the available resolutions have changed, or when the currently selected resolution has changed. Listener should call `getResolutions()` to get the updated information.

### Event `volumeChange`

Fired when the player volume changed.

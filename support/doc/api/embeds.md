# PeerTube Embed API

PeerTube lets you embed videos and programmatically control their playback. This documentation covers how to interact with the PeerTube Embed API.

## Playground

Any PeerTube embed URL (ie `https://my-instance.example.com/videos/embed/52a10666-3a18-4e73-93da-e8d3c12c305a`) can be viewed as an embedding playground which 
allows you to test various aspects of PeerTube embeds. Simply replace `/embed` with `/test-embed` and visit the URL in a browser. 
For instance, the playground URL for the above embed URL is `https://my-instance.example.com/videos/test-embed/52a10666-3a18-4e73-93da-e8d3c12c305a`.

## Quick Start

Given an existing PeerTube embed `<iframe>`, one can use the PeerTube Embed API to control it by first including the library. You can include it via Yarn with:

```
yarn add @peertube/embed-api
```

Now just use the `PeerTubePlayer` class exported by the module:

```typescript
import { PeerTubePlayer } from '@peertube/embed-api'

let player = new PeerTubePlayer(document.querySelector('iframe'))
await player.ready // wait for the player to be ready

// now you can use it!
player.play()
player.seek(32)
player.stop()
```

# Methods

## `play() : Promise<void>`

Starts playback, or resumes playback if it is paused.

## `pause() : Promise<void>`

Pauses playback.

## `seek(positionInSeconds : number)`

Seek to the given position, as specified in seconds into the video.

## `addEventListener(eventName : string, handler : Function)`

Add a listener for a specific event. See below for the available events.

## `getResolutions() : Promise<PeerTubeResolution[]>`

Get the available resolutions. A `PeerTubeResolution` looks like:

```json
{
    "id": 3,
    "label": "720p",
    "src": "//src-url-here",
    "active": true
}
```

`active` is true if the resolution is the currently selected resolution.

## `setResolution(resolutionId : number): Promise<void>`

Change the current resolution. Pass `-1` for automatic resolution (when available).
Otherwise, `resolutionId` should be the ID of an object returned by `getResolutions()`

## `getPlaybackRates() : Promise<number[]>`

Get the available playback rates, where `1` represents normal speed, `0.5` is half speed, `2` is double speed, etc.

## `getPlaybackRates() : Promise<number>`

Get the current playback rate. See `getPlaybackRates()` for more information.

## `setPlaybackRate(rate : number) : Promise<void>`

Set the current playback rate. The passed rate should be a value as returned by `getPlaybackRates()`.

## `setVolume(factor : number) : Promise<void>`

Set the playback volume. Value should be between `0` and `1`.

## `getVolume(): Promise<number>`

Get the playback volume. Returns a value between `0` and `1`.
# Events

You can subscribe to events by using `addEventListener()`. See above for details.

## Event `play`

Fired when playback begins or is resumed after pausing.

## Event `pause`

Fired when playback is paused.

## Event `playbackStatusUpdate`

Fired every half second to provide the current status of playback. The parameter of the callback will resemble:

```json
{
  "position": 22.3,
  "volume": 0.9,
  "playbackState": "playing"
}
```

The `volume` field contains the volume from `0` (silent) to `1` (full volume). The `playbackState` can be `playing` or `paused`. More states may be added later.

## Event `playbackStatusChange`

Fired when playback transitions between states, such as `pausing` and `playing`. More states may be added later.

## Event `resolutionUpdate`

Fired when the available resolutions have changed, or when the currently selected resolution has changed. Listener should call `getResolutions()` to get the updated information.
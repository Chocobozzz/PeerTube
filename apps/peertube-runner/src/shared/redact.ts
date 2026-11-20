import { redactRTMPStreamKeys } from '@peertube/peertube-core-utils'

// The RTMP URL of a live job contains the stream key: anyone knowing it can stream on the live
export function redactJobPayload (payload: any) {
  if (!payload?.input?.rtmpUrl) return payload

  return {
    ...payload,

    input: {
      ...payload.input,

      rtmpUrl: redactRTMPStreamKeys(payload.input.rtmpUrl)
    }
  }
}

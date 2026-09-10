-- Add or refresh a viewer in the counter of a video.
--
-- Doing it in Redis is faster and makes the whole decision atomic
--
-- The total of the video is kept in the `TOTAL` field of the same hash
--
-- KEYS[1] viewers of the video
-- KEYS[2] set of the video ids having viewers
--
-- ARGV[1] video id
-- ARGV[2] viewer id
-- ARGV[3] expiration
-- ARGV[4] viewer scope
-- ARGV[5] video scope
-- ARGV[6] viewer count
-- ARGV[7] now
-- ARGV[8] the date before which the viewer must be federated again or 0 to never federate it
-- ARGV[9] "1" to replace the viewers currently known
--
-- Returns { is new viewer, must federate, total viewers of the video }

local viewersKey = KEYS[1]
local videosKey = KEYS[2]

local videoId = ARGV[1]
local viewerId = ARGV[2]
local expires = tonumber(ARGV[3])
local viewerScope = ARGV[4]
local videoScope = ARGV[5]
local viewerCount = tonumber(ARGV[6])
local now = tonumber(ARGV[7])
local federateBefore = tonumber(ARGV[8])
local replaceCurrentViewers = ARGV[9] == '1'

-- The origin instance sends a summary of all of its viewers, so ours are replaced
if replaceCurrentViewers then
  redis.call('del', viewersKey)
end

local raw = redis.call('hget', viewersKey, viewerId)
local viewer
local isNew = 0

if raw then
  viewer = cjson.decode(raw)
  viewer.expires = expires
else
  isNew = 1
  viewer = {
    id = viewerId,
    expires = expires,
    viewerScope = viewerScope,
    videoScope = videoScope,
    viewerCount = viewerCount
  }
end

-- Whoever writes the federation date owns the federation of that viewer until the next window
local mustFederate = 0
if federateBefore > 0 and (viewer.lastFederation == nil or viewer.lastFederation <= federateBefore) then
  mustFederate = 1
  viewer.lastFederation = now
end

redis.call('hset', viewersKey, viewerId, cjson.encode(viewer))
redis.call('sadd', videosKey, videoId)

local total = redis.call('hget', viewersKey, 'TOTAL')

-- Viewers written before the total was introduced
-- TODO: remove in v11 of PeerTube
if not total then
  total = 0

  for _, value in ipairs(redis.call('hvals', viewersKey)) do
    local other = cjson.decode(value)

    if other.expires > now then total = total + other.viewerCount end
  end

  redis.call('hset', viewersKey, 'TOTAL', total)
elseif isNew == 1 then
  total = redis.call('hincrby', viewersKey, 'TOTAL', viewerCount)
else
  total = tonumber(total)
end

return { isNew, mustFederate, total }

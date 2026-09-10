-- Merge a viewer heartbeat into its Redis hash
--
--
-- KEYS[1] viewer key
-- KEYS[2] set of the viewer keys
--
-- ARGV[1] viewer key as stored in the set (without the Redis prefix)
-- ARGV[2] now
-- ARGV[3] current time
-- ARGV[4] "1" if the player seeked
-- ARGV[5] max watch sections
-- ARGV[...] then the field/value pairs to create an unknown viewer with, or nothing if the caller does not have them yet
--
-- Returns { status, watch time } where status:
--   * -1 if the viewer is unknown and no creation fields were given
--   * 0 if the viewer has too many watch sections and nothing was written
--   * 1 if the heartbeat has been merged

local viewerKey = KEYS[1]
local setKey = KEYS[2]

local setMember = ARGV[1]
local now = tonumber(ARGV[2])
local currentTime = tonumber(ARGV[3])
local isSeek = ARGV[4] == '1'
local maxWatchSections = tonumber(ARGV[5])

local current = redis.pcall('hmget', viewerKey, 'sectionStart', 'sectionEnd', 'watchTime', 'closedSections')

-- A key left by a version that stored the viewer as JSON: drop it rather than fail on its type
-- TODO: remove in v11 of PeerTube
if current.err then
  redis.call('del', viewerKey)
  current = {}
end

local sectionStart = tonumber(current[1])

-- The viewer is unknown
if sectionStart == nil then
  -- And we have no creation fields to create it with
  if #ARGV < 6 then return { -1, 0 } end

  local fields = {
    'firstUpdated', now,
    'lastUpdated', now,
    'watchTime', 0,
    'closedSections', 0,
    'sectionStart', currentTime,
    'sectionEnd', currentTime
  }

  for i = 6, #ARGV do
    table.insert(fields, ARGV[i])
  end

  redis.call('hset', viewerKey, unpack(fields))
  redis.call('sadd', setKey, setMember)

  -- The viewer is new, and we have created it with the given fields
  return { 1, 0 }
end

local sectionEnd = tonumber(current[2])
local watchTime = tonumber(current[3])
local closedSections = tonumber(current[4])

-- Check we don't store too many watch sections (the section being watched counts too)
if closedSections + 1 >= maxWatchSections then
  return { 0, watchTime }
end

-- Seeking, or rewinding before the section we are in, closes it and opens a new one
if isSeek or sectionStart > currentTime then
  redis.call(
    'hset', viewerKey,
    's' .. closedSections, sectionStart .. ':' .. sectionEnd,
    'closedSections', closedSections + 1,
    'sectionStart', currentTime,
    'sectionEnd', currentTime,
    'lastUpdated', now
  )
else
  watchTime = watchTime + (currentTime - sectionEnd)

  redis.call('hset', viewerKey, 'sectionEnd', currentTime, 'watchTime', watchTime, 'lastUpdated', now)
end

return { 1, watchTime }

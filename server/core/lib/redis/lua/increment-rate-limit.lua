-- Add hits to a rate limit counter, starting its window if it does not exist yet
--
-- KEYS[1] counter
--
-- ARGV[1] hits to add, negative to remove hits of requests that must not be counted
-- ARGV[2] window in milliseconds
--
-- Returns { total hits, milliseconds before the window resets or -1 if the counter has been removed }

local totalHits = redis.call('INCRBY', KEYS[1], ARGV[1])

-- Removed hits of a window that has already reset
if totalHits <= 0 then
  redis.call('DEL', KEYS[1])

  return { 0, -1 }
end

local ttl = redis.call('PTTL', KEYS[1])

-- The counter has just been created, set the expiration
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  ttl = tonumber(ARGV[2])
end

return { totalHits, ttl }

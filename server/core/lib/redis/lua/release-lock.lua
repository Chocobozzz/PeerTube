-- Release a lock, only if it is still held by the caller
--
-- KEYS[1] lock
--
-- ARGV[1] token of the caller
--
-- Returns 1 if the lock was released
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end

return 0

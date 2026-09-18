-- Extend the expiration of a lock, only if it is still held by the caller
--
-- KEYS[1] lock
--
-- ARGV[1] token of the caller
-- ARGV[2] new expiration in milliseconds
--
-- Returns 1 if the lock was extended
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end

return 0

module.exports = WorkQueue

var Duplex = require("stream").Duplex
var inherits = require("util").inherits

var DEFAULT_INTERVAL_MS = 100
var USED_REDIS_CLIENT_METHODS = [ "zadd", "multi", "zrangebyscore", "zremrangebyscore", "exec" ]

function WorkQueue(client, options) {
  if (!(this instanceof WorkQueue)) return new WorkQueue(client, options)

  if (!isRedis(client)) throw new Error("client must be an instance of a redis client (node_redis, ioredis)")

  this.client = client

  this.options = options || {}
  this.queueName = this.options.queueName || "RunAt~default"
  this.queueInterval = this.options.interval || DEFAULT_INTERVAL_MS

  this._dequedBuffer = []

  // force objectMode
  this.options.objectMode = true

  Duplex.call(this, this.options)
}
inherits(WorkQueue, Duplex)

WorkQueue.prototype._write = function _write(job, encoding, callback) {
  var self = this
  if (!job.key) {
    self.emit("error", "Schedule jobs via: {runAt: ms_timestamp, key: 'your_job_key'")
    return
  }

  this.client.zadd(this.queueName, job.runAt || 0, job.key, function zaddReply(err, reply) {
    if (err) {
      self.emit("error", "Error scheduling job: " + err)
      return
    }
    callback()
  })
}

WorkQueue.prototype._read = function _read(n) {
  this._start()
}

WorkQueue.prototype._poll = function _poll() {
  var self = this
  var ts = Date.now()
  this.client
    .multi()
    .zrangebyscore(this.queueName, "-inf", ts)
    .zremrangebyscore(this.queueName, "-inf", ts)
    .exec(function execReply(err, replies) {
      if (err) {
        self.emit("error", err)
        return
      }
      var jobs = replies.shift()
      for (var i = 0; i < jobs.length; i++) {
        self.push(jobs[i])
      }
    })
}

WorkQueue.prototype._start = function _start() {
  if (this.interval == null)
    this.interval = setInterval(this._poll.bind(this), this.queueInterval)
}

WorkQueue.prototype.stop = function stop() {
  var self = this
  if (this.interval != null) {
    clearInterval(this.interval)
    this.interval = null
  }
}

// Allow anything that has the surface area of the redis client used (enables consumers/tests to easily mock a redis client)
function isRedis(client) {
  if (!client) return false
  return USED_REDIS_CLIENT_METHODS.length === USED_REDIS_CLIENT_METHODS.filter(function (method) {
    return typeof client[method] === 'function'
  }).length
}

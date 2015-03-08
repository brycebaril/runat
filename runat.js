module.exports = WorkQueue

var redis = require("redis")
var Duplex = require("stream").Duplex
var inherits = require("util").inherits

var DEFAULT_INTERVAL_MS = 100

function WorkQueue(options) {
  if (!(this instanceof WorkQueue)) return new WorkQueue(options)

  this.options = options || {}
  this.queueName = this.options.queueName || "RunAt~default"
  this.queueInterval = this.options.interval || DEFAULT_INTERVAL_MS

  this._dequedBuffer = []

  // force objectMode
  this.options.objectMode = true

  Duplex.call(this, this.options)
}
inherits(WorkQueue, Duplex)

WorkQueue.prototype._connect = function _connect() {
  if (this.client == null)
    this.client = redis.createClient(this.options.redisPort, this.options.redisHost)
}

WorkQueue.prototype._write = function _write(job, encoding, callback) {
  if (!job.key)
    self.emit("error", "Schedule jobs via: {runAt: ms_timestamp, key: 'your_job_key'")

  this._connect()

  this.client.zadd(this.queueName, job.runAt || 0, job.key, function zaddReply(err, reply) {
    if (err) {
      self.emit("error", "Error scheduling job: " + err)
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
  this._connect()

  if (this.interval == null)
    this.interval = setInterval(this._poll.bind(this), this.queueInterval)
}

WorkQueue.prototype.stop = function stop() {
  var self = this
  if (this.interval != null) {
    clearInterval(this.interval)
    this.interval = null
  }
  if (this.client != null) {
    this.client.quit(function clientQuit() {
      self.client = null
    })
  }
}

var test = require("tape").test

var WQ = require("../runat")
var tail = require("terminus").tail

test("simple", function (t) {
  var q = WQ({queueName: "~~simple", interval: 20})

  var jobs = []
  q.pipe(tail({objectMode: true}, function (job) {
    jobs.push({ran: Date.now(), key: job})
  }))

  var n = Date.now()
  q.write({runAt: 0, key: "1"})
  q.write({runAt: n + 50, key: "2"})
  q.write({runAt: n + 100, key: "3"})

  setTimeout(function () {
    t.equals(jobs.length, 3)
    t.equals(jobs[0].key, "1")
    t.ok(jobs[0].ran >= n)
    t.equals(jobs[1].key, "2")
    t.ok(jobs[1].ran >= n + 50)
    t.equals(jobs[2].key, "3")
    t.ok(jobs[2].ran >= n + 100)
    q.stop()
    t.end()
  }, 200)
})

test("separate consumer", function (t) {
  var q = WQ({queueName: "~~separate~consumer", interval: 20})
  var c = WQ({queueName: "~~separate~consumer", interval: 20})

  var jobs = []
  c.pipe(tail({objectMode: true}, function (job) {
    jobs.push({ran: Date.now(), key: job})
  }))

  var n = Date.now()
  q.write({runAt: 0, key: "1"})
  q.write({runAt: n + 50, key: "2"})
  q.write({runAt: n + 100, key: "3"})

  setTimeout(function () {
    t.equals(jobs.length, 3)
    t.equals(jobs[0].key, "1")
    t.ok(jobs[0].ran >= n)
    t.equals(jobs[1].key, "2")
    t.ok(jobs[1].ran >= n + 50)
    t.equals(jobs[2].key, "3")
    t.ok(jobs[2].ran >= n + 100)
    q.stop()
    c.stop()
    t.end()
  }, 200)
})

test("two workers", function (t) {
  var q = WQ({queueName: "~~two~workers", interval: 20})
  var c = WQ({queueName: "~~two~workers", interval: 20})

  var jobs = []
  q.pipe(tail({objectMode: true}, function (job) {
    jobs.push({ran: Date.now(), key: job})
  }))
  c.pipe(tail({objectMode: true}, function (job) {
    jobs.push({ran: Date.now(), key: job})
  }))

  var n = Date.now()
  q.write({runAt: 0, key: "1"})
  c.write({runAt: n + 50, key: "2"})
  q.write({runAt: n + 100, key: "3"})

  setTimeout(function () {
    t.equals(jobs.length, 3)
    t.equals(jobs[0].key, "1")
    t.ok(jobs[0].ran >= n)
    t.equals(jobs[1].key, "2")
    t.ok(jobs[1].ran >= n + 50)
    t.equals(jobs[2].key, "3")
    t.ok(jobs[2].ran >= n + 100)
    q.stop()
    c.stop()
    t.end()
  }, 200)
})

test("receipt", function (t) {
  var c = WQ({queueName: "~receipt", interval: 20})
  c.write({runAt: 0, key: "hi"}, function cb() {
    t.ok(1, "Got receipt (entered callback)")
  })
  setTimeout(function () {
    c.stop()
    t.end()
  }, 30)
})

test("invalid job", function (t) {
  var c = WQ({queueName: "~invalid~job", interval: 20})
  c.on('error', function (err) {
    t.ok(err, 'Received an error event')
    t.end()
  })
  c.write({runAt: 0, key: null})
})

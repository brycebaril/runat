# runat

[![NPM](https://nodei.co/npm/runat.png)](https://nodei.co/npm/runat/)

Runat is a Redis-backed scheduled queue system with a Duplex stream interface.

Schedule tasks in the future, and consume those events when they are supposed to happen via a streaming interface.

As of `v2.0.0` a Redis client must be installed separately and provided as input to `runat`. This means that the consumer of this module is in control of which client version/implementation is used.

```javascript
var RunAt = require("runat")
var client = require("redis").createClient() // or `new require('ioredis')`
var queue = RunAt(client)
var tail = require("terminus").tail

queue.pipe(tail({objectMode: true}, function (jobKey) {
  console.log("Got jobKey '%s' at %s", jobKey, Date.now())
}))

queue.write({runAt: Date.now() + 560, key: "last"})
queue.write({runAt: Date.now() + 409, key: "middle"})
queue.write({runAt: Date.now() + 333, key: "first"})

setTimeout(queue.stop.bind(queue), 1000)

/*
Got jobKey 'first' at 1389654375918
Got jobKey 'middle' at 1389654376019
Got jobKey 'last' at 1389654376119
 */

```

# API

`require("runat")(client, [options])`
---

Creates an objectMode Duplex stream that accepts jobs of the form: `{runAt: millisecond_timestamp, key: "string_job_key"}` and emits the job keys approximately when scheduled to happen.

This will poll Redis for jobs, and therefore cannot provide millisecond-based scheduling accuracy. Polling starts when any of following happens: `read()`, `pipe()` or `on('readable', fn)`

Multiple consumers can connect to, publish, and/or consume work items from the same queue, but only *one* consumer will get any particular job. This means you can safely have multiple workers consuming the queue without work overlap.

`client` should be an instance of a Redis client. `runat` does some basic validation on the argument provided, checking the existence of each client function it intends to use. This means that as well as [node_redis](https://github.com/NodeRedis/node_redis), [ioredis](https://github.com/luin/ioredis) should be compatible, and equally some in memory mocks, e.g. [redis-js](https://github.com/wilkenstein/redis-mock-js).

Options:
  * `queueName`: The name of the underlaying Redis storage zset. Any clients that use the same `queueName` will share events from that queue. Default: `"RunAt~default"`
  * `interval`: millisecond gap between polling for jobs. Default: `100`
  * (normal Duplex stream options) -- though `objectMode` is forced to be true.

`.write() .read() .pipe()`
---

This provides a traditional Duplex stream.

`.stop()`
---

Stops polling the queue. This does not close the Redis client connection. Subsequent `read()` or `pipe()` calls will restart polling.

# Scheduling Jobs

When scheduling a job it expects work as objects of this format: `{runAt: millisecond_timestamp, key: "string_job_key"}`

Jobs are consumed by grabbing anything scheduled between the start of the universe and the current time that the consumer is polling the work queue.

This means if you schedule a job in the past, it is equivalent to scheduling that job to run immediately.

Because this is a polling system, job timing is only as granular as the polling interval you set when creating the consumer. To get more accurate timing you can decrease the polling interval, but at some point you run the risk of over-working Redis or your network.

Another important caveat is work jobKeys must be unique. If you attempt to schedule the same work for two different times, the last scheduler wins. This means you can reschedule jobs by giving them a new `runAt` time.

# Getting Work

Consuming work is simply setting up a stream consumer that will read from the RunAt stream. The stream is an `objectMode` stream. One suggested easy way to set up a function to be run upon each work item is using [terminus](http://npm.im/terminus) specifically the `terminus.tail` function. This is shown in the example above.

It is up to you to decide what keys to use for your jobs and what they mean.

You may want to consider having the workers reschedule work they cannot complete or having a separate retry queue for errors, or any other configurations that can provide work durability.

# Lost Work

There are a few things that could possibly result in lost work from the work queue.

  1. This library can dequeue multiple jobs at once from Redis, which from that point are ONLY stored in the memory of the worker. This means a worker *could* dequeue multiple items, then crash or be killed before acting on any of that work. There is no provided mechanism for durability to prevent such a work loss.
  2. Redis could crash, or the zset could be extrnally deleted or truncated outside the scope of this application.


# LICENSE

MIT

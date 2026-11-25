# RabbitMQ practice

Hands-on lessons for learning RabbitMQ, from a single queue up to topic routing. Each lesson is a small, runnable project in its own folder with its own README, step-by-step instructions and exercises.

The lessons deliberately use **different languages** (Python, Node.js, Java). They all talk to the same broker, which is the point: RabbitMQ doesn't care what language a client is written in.

---

## Lessons

| # | Lesson | Language | Exchange | You learn |
|---|---|---|---|---|
| 1 | [Hello World](01-hello-world/README.md) | Python | default | Producer, queue, consumer; the default exchange |
| 2 | [Work Queues](02-work-queues/README.md) | Node.js | default | Sharing work between workers, manual acks, `prefetch`, durable queues + persistent messages |
| 3 | [Publish/Subscribe](03-pub-sub-fanout/README.md) | Java | fanout | Broadcasting to every subscriber, bindings, temporary (exclusive) queues |
| 4 | [Routing & Topics](04-routing-topics/README.md) | Node.js | direct, topic | Filtering by exact routing key and by `*` / `#` wildcard patterns |

Work through them in order; each one builds on the previous.

### Coming next

5. Dead-letter queues and retries – handling messages that fail, expire or are rejected
6. Request/reply (RPC) and publisher confirms – getting replies, and knowing the broker received a message

---

## How the pieces fit together

```
Producer ──publish──► Exchange ──(bindings)──► Queue(s) ──deliver──► Consumer(s)
             routing key            binding key            ack
```

| Exchange type | Routes a message to… | Lesson |
|---|---|---|
| default (`""`) | the queue whose **name** equals the routing key | 1, 2 |
| fanout | **every** bound queue (routing key ignored) | 3 |
| direct | queues bound with **exactly** the routing key | 4 |
| topic | queues whose binding **pattern** matches the routing key | 4 |

Two rules that hold everywhere:
- **One queue → each message goes to one consumer.** Several consumers on the same queue share the work (lesson 2).
- **Several queues → each queue gets its own copy.** That's how pub/sub works (lessons 3 and 4).

---

## Setup

### 1. RabbitMQ broker (required for every lesson)

Requires Docker.

```bash
docker compose up -d
```

This starts RabbitMQ 4 with the management plugin (see [docker-compose.yml](docker-compose.yml)):

| Port | Used for |
|---|---|
| `5672` | AMQP – the lesson code connects here |
| `15672` | Management UI – http://localhost:15672 (user `guest`, password `guest`) |

Check it's up:
```bash
docker exec rabbitmq rabbitmq-diagnostics ping
```

### 2. Language toolchains

You only need the ones for the lessons you run.

| Language | Needed for | Version | One-time setup |
|---|---|---|---|
| Python | Lesson 1 | 3.9+ | From the project root: `python3 -m venv .venv && .venv/bin/pip install pika`, then `source .venv/bin/activate` in each terminal |
| Node.js | Lessons 2, 4 | 18+ | `npm install` inside each lesson folder |
| Java + Maven | Lesson 3 | Java 21+, Maven 3 | Nothing – `./run.sh` downloads dependencies on first run |

### Client libraries used

| Language | Library | Notes |
|---|---|---|
| Python | `pika` 1.5 | Uses `pika.Connection`; the older `BlockingConnection` is deprecated |
| Node.js | `amqplib` 2.x | Promise API; error listeners on every connection and channel |
| Java | `com.rabbitmq:amqp-client` 5.25 | Official client; `slf4j-api` pinned to 2.x to avoid logging warnings |

---

## Project layout

```
rabbitmq-practice/
├── docker-compose.yml          # RabbitMQ 4 + management UI
├── .venv/                      # Python virtual env (lesson 1)
├── 01-hello-world/             # Python: send.py, receive.py
├── 02-work-queues/             # Node:   new_task.js, worker.js
├── 03-pub-sub-fanout/          # Java:   EmitLog, ReceiveLogs, run.sh
└── 04-routing-topics/          # Node:   emit/receive for direct and topic exchanges
```

---

## Useful commands

All run from any folder while the broker is up.

```bash
# What's on the broker
docker exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers
docker exec rabbitmq rabbitmqctl list_exchanges name type
docker exec rabbitmq rabbitmqctl list_bindings source_name destination_name routing_key

# Empty or delete a queue / exchange
docker exec rabbitmq rabbitmqctl purge_queue task_queue
docker exec rabbitmq rabbitmqadmin queues delete --name task_queue
docker exec rabbitmq rabbitmqadmin exchanges delete --name logs

# Broker logs and restart
docker logs -f rabbitmq
docker restart rabbitmq
```

> The broker ships `rabbitmqadmin` 2.x, which uses `rabbitmqadmin <object> <action> --name …`. Older tutorials show `rabbitmqadmin delete queue name=…`, which no longer works.

---

## RabbitMQ 4 gotchas

Many online tutorials were written for RabbitMQ 3. Things that behave differently here:

| You see | Why | Fix |
|---|---|---|
| `Feature transient_nonexcl_queues is deprecated` | RabbitMQ 4 doesn't allow shared queues that aren't durable | Declare shared queues with `durable: true`; exclusive (per-connection) queues are still fine |
| `PRECONDITION_FAILED - inequivalent arg …` | A queue or exchange already exists with different settings (durable, type, …) | Use identical settings everywhere, or delete the old one in the Management UI |
| `DeprecationWarning: BlockingConnection is deprecated` (Python) | pika 1.5 replaced it | Use `pika.Connection` as in lesson 1 |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Connection refused on port `5672` | Broker isn't running: `docker compose up -d` |
| `docker: command not found` / Docker daemon not running | Start Docker Desktop |
| Messages sent but nobody receives them | Check the exchange and binding in the Management UI. Messages with no matching queue are dropped |
| Consumer stops after one message | It isn't acking (see lesson 2) |
| Lesson-specific errors | See the Troubleshooting section of that lesson's README |

---

## Cleanup

```bash
docker compose down        # stop and remove the broker (queues and messages are discarded)
```

To also remove local build artifacts and dependencies:
```bash
rm -rf .venv 02-work-queues/node_modules 04-routing-topics/node_modules
(cd 03-pub-sub-fanout && mvn -q clean)
```

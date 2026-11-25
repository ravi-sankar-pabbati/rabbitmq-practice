# Lesson 4 – Routing with Direct and Topic Exchanges (Node.js)

In lesson 3, a **fanout** exchange copied every message to every subscriber.
In this lesson, subscribers **choose which messages they receive**:

- **Direct exchange** – a message goes to queues whose binding key **exactly matches** its routing key.
- **Topic exchange** – a message goes to queues whose binding **pattern** matches its routing key, using wildcards.

---

## Prerequisites

1. **RabbitMQ is running** (from the project root):
   ```bash
   docker compose up -d
   ```
   Management UI: http://localhost:15672 (user `guest`, password `guest`)

2. **Node.js 18+** is installed (`node --version`).

3. **Install dependencies** (from this folder):
   ```bash
   cd 04-routing-topics
   npm install
   ```

---

## Files

| File | Role |
|---|---|
| `connect.js` | Shared helper: opens a connection and channel with error listeners attached |
| `emit_log_direct.js` | Publishes to the `direct_logs` exchange; the routing key is a severity |
| `receive_logs_direct.js` | Subscribes to one or more severities |
| `emit_log_topic.js` | Publishes to the `topic_logs` exchange; the routing key is dot-separated words |
| `receive_logs_topic.js` | Subscribes using one or more wildcard patterns |

---

## Key concepts

| Term | Meaning |
|---|---|
| **Routing key** | Label the *publisher* attaches to each message, e.g. `error` or `payments.card.error` |
| **Binding key** | Label (or pattern) a *queue* is bound with, e.g. `error` or `payments.#` |
| **Binding** | The link between an exchange and a queue. One queue can have many bindings. |
| **Exclusive, server-named queue** | `assertQueue("", { exclusive: true })` – each subscriber gets its own private queue, deleted when it disconnects |

### How exchange types compare

| Exchange | Routing key on message | Binding key on queue | Match rule |
|---|---|---|---|
| fanout (lesson 3) | ignored | ignored | every bound queue gets it |
| **direct** | `error` | `error` | exact match |
| **topic** | `payments.card.error` | `payments.#`, `*.*.error` | wildcard match |

### Topic wildcards

Routing keys are words separated by dots (max 255 bytes).

- `*` matches **exactly one** word
- `#` matches **zero or more** words

| Pattern | Matches | Does not match |
|---|---|---|
| `payments.*` | `payments.refund` | `payments`, `payments.card.error` |
| `payments.#` | `payments`, `payments.refund`, `payments.card.error` | `orders.refund` |
| `*.*.error` | `payments.card.error`, `orders.db.error` | `orders.error`, `payments.card.db.error` |
| `#` | everything (behaves like fanout) | – |

A topic binding with no wildcards behaves exactly like a direct binding.

---

## Part A – Direct exchange

Open **three terminals**, each in `04-routing-topics/`.

**Terminal 1 – only errors:**
```bash
node receive_logs_direct.js error
```

**Terminal 2 – everything:**
```bash
node receive_logs_direct.js info warning error
```

**Terminal 3 – publish:**
```bash
node emit_log_direct.js info    "user logged in"
node emit_log_direct.js warning "disk 80% full"
node emit_log_direct.js error   "disk full"
node emit_log_direct.js debug   "nobody listens to debug"
```

**Expected result**

| Message | Terminal 1 (`error`) | Terminal 2 (`info warning error`) |
|---|:-:|:-:|
| `info` | | ✅ |
| `warning` | | ✅ |
| `error` | ✅ | ✅ |
| `debug` | | |

The `debug` message is **dropped**: no queue is bound with that key, so the exchange has nowhere to route it.

---

## Part B – Topic exchange

Stop the direct subscribers (Ctrl+C), then open **five terminals**.

```bash
# Terminal 1
node receive_logs_topic.js "payments.*"
# Terminal 2
node receive_logs_topic.js "payments.#"
# Terminal 3
node receive_logs_topic.js "*.*.error"
# Terminal 4 – catch-all
node receive_logs_topic.js "#"
```

> Always quote patterns: in zsh/bash, an unquoted `*` or `#` may be expanded or treated as a comment.

**Terminal 5 – publish:**
```bash
node emit_log_topic.js payments.refund     "refund issued"
node emit_log_topic.js payments.card.error "card declined"
node emit_log_topic.js orders.db.error     "db timeout"
node emit_log_topic.js payments            "bare key"
```

**Expected result**

| Routing key | `payments.*` | `payments.#` | `*.*.error` | `#` |
|---|:-:|:-:|:-:|:-:|
| `payments.refund` | ✅ | ✅ | | ✅ |
| `payments.card.error` | | ✅ | ✅ | ✅ |
| `orders.db.error` | | | ✅ | ✅ |
| `payments` | | ✅ | | ✅ |

---

## Seeing it in the Management UI

1. Go to http://localhost:15672 → **Exchanges** → `direct_logs` or `topic_logs`.
2. Scroll to **Bindings**: each running subscriber appears as an `amq.gen-…` queue with its binding keys.
3. Stop a subscriber and refresh – its queue and bindings disappear (exclusive queue).
4. Use **Publish message** on the exchange page to send a test message with any routing key, without running a script.

You can also list bindings from the terminal:
```bash
docker exec rabbitmq rabbitmqctl list_bindings source_name destination_name routing_key | grep -E 'direct_logs|topic_logs'
```

---

## Exercises

1. **Predict, then verify:** which topic subscribers receive `orders.error`?
   <details><summary>Answer</summary>Only <code>#</code>. <code>*.*.error</code> needs exactly three words.</details>
2. **Multiple bindings:** start `node receive_logs_topic.js "payments.#" "*.*.error"`, then publish `payments.card.error`. How many copies does that one subscriber get?
   <details><summary>Answer</summary>One. A message is delivered to a queue at most once, even if several of its bindings match.</details>
3. **Topic as direct:** start `node receive_logs_topic.js orders.created` and publish `orders.created` and `orders.created.eu`. Which arrive?
   <details><summary>Answer</summary>Only <code>orders.created</code> – without wildcards, a topic binding is an exact match.</details>
4. **Design your own keys:** pick a scheme like `<service>.<region>.<severity>` (e.g. `billing.eu.error`) and write patterns for "all EU errors" and "everything from billing".
   <details><summary>Answer</summary><code>*.eu.error</code> and <code>billing.#</code></details>
5. **Lost messages:** publish a message *before* starting any subscriber. Is it received when one starts later? Why?
   <details><summary>Answer</summary>No. Exclusive queues only exist while their subscriber is connected; with no matching queue at publish time the exchange drops the message. Use a named, durable queue if messages must wait.</details>

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:5672` | Broker isn't running: `docker compose up -d` from the project root |
| `Cannot find package 'amqplib'` | Run `npm install` in this folder |
| `PRECONDITION_FAILED - inequivalent arg 'type'` | An exchange with that name already exists with a different type. Delete it in the Management UI (Exchanges → name → Delete) |
| Subscriber gets nothing | Check the pattern is quoted, and that the routing key's word count matches your `*` wildcards |

---

## Cleanup

Subscribers clean up their own queues when stopped. To remove the exchanges too:
```bash
docker exec rabbitmq rabbitmqadmin exchanges delete --name direct_logs
docker exec rabbitmq rabbitmqadmin exchanges delete --name topic_logs
```

# Lesson 1 – Hello World (Python)

The simplest possible RabbitMQ setup: one **producer** sends a message to a **queue**, and one **consumer** reads it.

```
send.py ──► [default exchange] ──► queue "hello" ──► receive.py
```

---

## Prerequisites

1. **RabbitMQ is running** (from the project root):
   ```bash
   docker compose up -d
   ```
   Management UI: http://localhost:15672 (user `guest`, password `guest`)

2. **Python 3.9+** and the `pika` client in a virtual environment (from the project root):
   ```bash
   python3 -m venv .venv
   .venv/bin/pip install pika
   source .venv/bin/activate      # do this in every new terminal
   ```

---

## Files

| File | Role |
|---|---|
| `send.py` | Producer: declares the `hello` queue and publishes one message |
| `receive.py` | Consumer: declares the same queue and prints every message it receives |

---

## Key concepts

| Term | Meaning |
|---|---|
| **Producer** | A program that sends messages |
| **Queue** | A buffer inside RabbitMQ that holds messages until a consumer reads them |
| **Consumer** | A program that receives messages |
| **Exchange** | Decides which queue(s) a message goes to. Producers always publish to an exchange, never directly to a queue |
| **Default exchange** | `exchange=""`. Built in; routes each message to the queue whose **name** equals the `routing_key` |
| **Connection / channel** | One TCP connection to the broker; channels are lightweight sessions inside it. You do all work on a channel |

### Things in the code worth noticing

- **`queue_declare` is idempotent.** It creates the queue only if it doesn't exist. Both scripts declare it so it doesn't matter which one starts first.
- **`durable=True`.** RabbitMQ 4 doesn't allow shared queues that aren't durable (saved across restarts). Without it you get `Feature transient_nonexcl_queues is deprecated`.
- **`auto_ack=True`.** RabbitMQ deletes the message as soon as it's delivered. Simple, but if the consumer crashes mid-processing, that message is lost. Lesson 2 fixes this with manual acks.
- **`pika.Connection`** (pika 1.5+) replaces the deprecated `BlockingConnection`. Messages are handled on a background thread, so `receive.py` just keeps the main thread alive with `threading.Event().wait()`.

---

## Run it

Open **two terminals** in the project root and activate the venv in each (`source .venv/bin/activate`).

**Terminal 1 – consumer:**
```bash
python 01-hello-world/receive.py
```

**Terminal 2 – producer:**
```bash
python 01-hello-world/send.py
python 01-hello-world/send.py hi there
```

**Expected output**

Terminal 2:
```
 [x] Sent 'Hello World!'
 [x] Sent 'hi there'
```
Terminal 1:
```
 [*] Waiting for messages. Press CTRL+C to exit
 [x] Received 'Hello World!'
 [x] Received 'hi there'
```

---

## Seeing it in the Management UI

1. Stop the consumer (Ctrl+C).
2. Send three messages with `send.py`.
3. Open http://localhost:15672 → **Queues and Streams** → `hello`. **Ready** shows `3`: the messages are waiting.
4. Under **Get messages**, click **Get Message(s)** to peek at one (keep *Ack mode* as "Nack message requeue true" so it stays in the queue).
5. Start the consumer again: all three arrive immediately and Ready drops to `0`.

From the terminal:
```bash
docker exec rabbitmq rabbitmqctl list_queues name messages
```

---

## Exercises

1. **Messages wait for you.** With no consumer running, send 5 messages. Then start the consumer. What happens?
   <details><summary>Answer</summary>All 5 are delivered as soon as it starts. The queue stores them until someone reads them; this decoupling is the main reason to use a queue.</details>
2. **Two consumers.** Start `receive.py` in two terminals, then send 6 messages. How are they split?
   <details><summary>Answer</summary>Round-robin: each consumer gets 3, alternating. A queue delivers each message to only one consumer. (Lesson 2 builds on this.)</details>
3. **Change the queue name** in `send.py` only (e.g. `hello2`) and send a message. Does the consumer get it? Where did it go?
   <details><summary>Answer</summary>No. The default exchange routed it to the queue named <code>hello2</code>, which <code>send.py</code> created. You can see it waiting in the Management UI.</details>
4. **Typo in the routing key.** Keep `queue_declare(queue="hello")` but publish with `routing_key="helo"`. What happens?
   <details><summary>Answer</summary>The message is silently dropped: no queue is named <code>helo</code>. Publishing doesn't fail by default; lesson 6 (publisher confirms / mandatory flag) shows how to detect this.</details>

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `AMQPConnectionError` / connection refused | Broker isn't running: `docker compose up -d` from the project root |
| `ModuleNotFoundError: No module named 'pika'` | Activate the venv: `source .venv/bin/activate` |
| `Feature transient_nonexcl_queues is deprecated` | Declare the queue with `durable=True` |
| `PRECONDITION_FAILED - inequivalent arg 'durable'` | The queue already exists with different settings. Delete it (UI → Queues → `hello` → Delete) or keep the settings identical in both scripts |
| `DeprecationWarning: BlockingConnection is deprecated` | You're running an older version of the scripts; use `pika.Connection` as in this folder |

---

## Cleanup

```bash
docker exec rabbitmq rabbitmqadmin queues delete --name hello
```

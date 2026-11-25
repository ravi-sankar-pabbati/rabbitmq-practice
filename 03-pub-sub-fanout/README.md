# Lesson 3 – Publish/Subscribe with a Fanout Exchange (Java)

Send one message and deliver a copy to **every** subscriber. Typical uses: broadcasting log lines, cache invalidation, "order placed" events that several services react to.

```
EmitLog ──► [exchange "logs" (fanout)] ──┬──► amq.gen-UyKm… ──► ReceiveLogs screen
                                         └──► amq.gen-G-VN… ──► ReceiveLogs audit
```

---

## Prerequisites

1. **RabbitMQ is running** (from the project root):
   ```bash
   docker compose up -d
   ```
   Management UI: http://localhost:15672 (user `guest`, password `guest`)

2. **Java 21+** (`java -version`) and **Maven** (`mvn -v`).

The first `./run.sh` downloads dependencies from Maven Central, so it takes longer than later runs.

---

## Files

| File | Role |
|---|---|
| `pom.xml` | Maven project: `amqp-client` 5.25.0 (official RabbitMQ Java client) + SLF4J logging |
| `src/main/java/practice/EmitLog.java` | Publisher: sends one message to the `logs` exchange |
| `src/main/java/practice/ReceiveLogs.java` | Subscriber: creates its own queue, binds it to `logs`, prints every message |
| `run.sh` | Compiles the project and runs a class: `./run.sh <ClassName> [args...]` |

---

## Key concepts

| Term | Meaning |
|---|---|
| **Exchange** | Receives messages from publishers and routes them to queues |
| **Fanout exchange** | Copies every message to **all** queues bound to it. The routing key is ignored |
| **Binding** | The link between an exchange and a queue (`channel.queueBind(queue, exchange, "")`) |
| **Server-named exclusive queue** | `channel.queueDeclare()` with no arguments: random name (`amq.gen-…`), usable only by this connection, deleted when it disconnects |

### Work queue (lesson 2) vs pub/sub (this lesson)

| | Work queue | Pub/sub |
|---|---|---|
| Queues | One shared queue | One queue **per subscriber** |
| Who gets a message | Exactly one worker | **Every** subscriber |
| Use for | Splitting up work | Broadcasting events |

### Things in the code worth noticing

- **The publisher never names a queue.** It only knows the exchange. Adding a new subscriber needs no change to the publisher.
- **No bound queue = message dropped.** A fanout exchange doesn't store messages; queues do.
- **Exclusive queues are temporary.** Fine for live subscribers; if a subscriber must not miss messages while it's offline, give it a named, durable queue instead.
- **SLF4J pin in `pom.xml`.** `amqp-client` pulls in `slf4j-api` 1.7, which can't find the 2.x `slf4j-simple` backend and prints `Failed to load class "org.slf4j.impl.StaticLoggerBinder"`. Declaring `slf4j-api` 2.0.17 explicitly fixes it.

---

## Run it

Open **three terminals**, each in `03-pub-sub-fanout/`.

**Terminal 1 – subscriber "screen":**
```bash
./run.sh ReceiveLogs screen
```

**Terminal 2 – subscriber "audit":**
```bash
./run.sh ReceiveLogs audit
```

**Terminal 3 – publish:**
```bash
./run.sh EmitLog "error: disk full"
./run.sh EmitLog "info: user logged in"
```

**Expected output** – both subscribers get both messages:
```
 [*] screen listening on queue amq.gen-UyKmFeptSziylTHvccQw-Q. Press CTRL+C to exit
 [x] screen got 'error: disk full'
 [x] screen got 'info: user logged in'
```
```
 [*] audit listening on queue amq.gen-G-VNSX2lReeTxZHtmreaAg. Press CTRL+C to exit
 [x] audit got 'error: disk full'
 [x] audit got 'info: user logged in'
```

### Running without `run.sh`

```bash
mvn -q compile dependency:build-classpath -Dmdep.outputFile=cp.txt
java -cp "target/classes:$(cat cp.txt)" practice.ReceiveLogs screen
java -cp "target/classes:$(cat cp.txt)" practice.EmitLog "hello"
```
Or open the folder in an IDE (IntelliJ, VS Code with the Java extension) and run the `main` methods directly.

---

## Seeing it in the Management UI

1. Start two subscribers.
2. Open http://localhost:15672 → **Exchanges** → `logs` → **Bindings**: one `amq.gen-…` queue per subscriber.
3. Open **Queues and Streams**: the **Features** column marks those queues as exclusive and auto-delete.
4. Stop a subscriber and refresh – its queue and binding are gone.

From the terminal:
```bash
docker exec rabbitmq rabbitmqctl list_bindings source_name destination_name | grep '^logs'
```

---

## Exercises

1. **Publish before subscribing.** With no subscribers running, publish a message, then start a subscriber. Does it arrive?
   <details><summary>Answer</summary>No. No queue was bound when it was published, so the exchange dropped it.</details>
2. **Add a third subscriber** while the others are running, then publish. Did you change `EmitLog`?
   <details><summary>Answer</summary>All three get the message, and the publisher didn't change. Publishers and subscribers are decoupled.</details>
3. **Durable subscriber.** Change `ReceiveLogs` to use a named queue, e.g. `channel.queueDeclare("audit_logs", true, false, false, null)`. Stop it, publish 3 messages, start it again. What happens?
   <details><summary>Answer</summary>It receives all 3 on restart: the named durable queue stays bound and keeps collecting messages while the subscriber is offline.</details>
4. **Two subscribers sharing a queue.** Run two copies of the modified subscriber from exercise 3 (same `audit_logs` queue). How are messages split?
   <details><summary>Answer</summary>Round-robin between them, like lesson 2. Fanout gives one copy per <em>queue</em>; consumers on the same queue compete. This is how you scale one subscriber type.</details>
5. **Routing key is ignored.** Change `EmitLog` to publish with routing key `"anything"`. Does delivery change?
   <details><summary>Answer</summary>No. Fanout ignores routing keys. Lesson 4 (direct and topic exchanges) uses them.</details>

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `java.net.ConnectException: Connection refused` | Broker isn't running: `docker compose up -d` from the project root |
| `./run.sh: Permission denied` | `chmod +x run.sh` |
| `SLF4J: Failed to load class "org.slf4j.impl.StaticLoggerBinder"` | Keep the explicit `slf4j-api` 2.0.17 dependency in `pom.xml` |
| `PRECONDITION_FAILED - inequivalent arg 'type' for exchange 'logs'` | An exchange named `logs` exists with another type. Delete it in the UI |
| Subscriber gets nothing | Make sure it started **before** you published, and check its binding in the UI |

---

## Cleanup

Subscribers delete their own queues when stopped. To remove the exchange and build output:
```bash
docker exec rabbitmq rabbitmqadmin exchanges delete --name logs
mvn -q clean
```

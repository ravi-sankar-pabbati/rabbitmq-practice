# Lesson 2 – Work Queues (Node.js)

Spread slow tasks across several **workers**. Every task goes to exactly one worker, and RabbitMQ makes sure no task is lost if a worker crashes.

```
                                   ┌──► worker A
new_task.js ──► queue "task_queue" ┤
                                   └──► worker B
```

Each `.` in a task message means **1 second of fake work**, so `"resize image..."` takes 3 seconds.

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
   cd 02-work-queues
   npm install
   ```

---

## Files

| File | Role |
|---|---|
| `new_task.js` | Producer: puts one task on `task_queue` |
| `worker.js` | Worker: processes tasks one at a time; run several copies |

---

## Key concepts

| Setting | Where | What it does |
|---|---|---|
| `{ durable: true }` | `assertQueue` (both scripts) | The **queue** survives a broker restart |
| `{ persistent: true }` | `sendToQueue` | The **message** is written to disk, so it survives a restart too |
| `{ noAck: false }` + `ch.ack(msg)` | `worker.js` | **Manual acknowledgement.** RabbitMQ deletes a message only after the worker acks it. If the worker dies first, the message is redelivered to another worker |
| `ch.prefetch(1)` | `worker.js` | **Fair dispatch.** A worker is given at most one unacked task at a time, so busy workers aren't sent more work |

### Message states

| State (Management UI) | Meaning |
|---|---|
| **Ready** | Waiting in the queue for a worker |
| **Unacked** | Delivered to a worker that hasn't acked it yet |

If a worker's connection closes, all of its **Unacked** messages go back to **Ready**.

### Durable vs persistent

You need **both** for messages to survive a broker restart: a durable queue holding non-persistent messages comes back empty.

---

## Run it

Open **three terminals**, each in `02-work-queues/`.

**Terminal 1 and 2 – workers:**
```bash
node worker.js A
```
```bash
node worker.js B
```

**Terminal 3 – send tasks:**
```bash
node new_task.js "long....."
node new_task.js "short1."
node new_task.js "short2."
node new_task.js "short3."
node new_task.js "short4."
```

**Expected result (fair dispatch)**

One worker takes the 5-second task. While it's busy, the **other worker does all four short tasks**:
```
 [x] B received 'long.....' (5s of work)
 [x] A received 'short1.' (1s of work)
 [✓] A done 'short1.'
 [x] A received 'short2.' (1s of work)
 ...
 [✓] B done 'long.....'
```

---

## Crash test (no task is lost)

1. Run **only** worker A: `node worker.js A`
2. Send a long task: `node new_task.js "important....."`
3. While A is working, **stop it** (Ctrl+C).
4. Check the queue – the task is back in **Ready**:
   ```bash
   docker exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged
   ```
5. Start worker B: `node worker.js B` – it receives `important.....` and finishes it.

---

## Seeing it in the Management UI

Open http://localhost:15672 → **Queues and Streams** → `task_queue`.

- The **Ready / Unacked** chart shows tasks moving from waiting to in-progress.
- **Consumers** lists each running worker with its prefetch count (`1`).
- Send 10 slow tasks with 2 workers running: you'll see Unacked = 2 (one per worker) and Ready counting down.

---

## Exercises

1. **Scale out.** Send 6 tasks of `"task..."` (3s each) with 1 worker, and time it. Then do it with 3 workers.
   <details><summary>Answer</summary>About 18s with one worker, about 6s with three. Adding workers is how you scale a work queue.</details>
2. **Forget to ack.** Comment out `ch.ack(msg)` in `worker.js`, restart the worker, and send 3 tasks. What happens?
   <details><summary>Answer</summary>The worker processes only the first task. With <code>prefetch(1)</code> it never gets another, because the first is never acked. The UI shows Unacked = 1, Ready = 2. When you stop the worker, the unacked message returns to Ready. In production this looks like a "stuck" consumer.</details>
3. **Remove fair dispatch.** Comment out `ch.prefetch(1)`, restart both workers, and rerun the "long + four short" test. What changes?
   <details><summary>Answer</summary>RabbitMQ deals tasks out strictly in turn (round-robin), regardless of how busy each worker is, so the worker with the long task still gets half the short ones and they queue up behind it.</details>
4. **Survive a restart.** With no workers running, send 3 tasks, then restart the broker: `docker restart rabbitmq`. Are the tasks still there? Now repeat with `persistent: true` removed from `new_task.js`.
   <details><summary>Answer</summary>With persistent messages, all 3 survive. Without it, the queue is still there (durable) but empty.</details>
5. **Mix languages.** Can the Python code from lesson 1 feed these Node workers?
   <details><summary>Answer</summary>Yes. Publish to <code>routing_key="task_queue"</code> (declared <code>durable=True</code>) from Python. The broker doesn't care what language the clients use.</details>

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:5672` | Broker isn't running: `docker compose up -d` from the project root |
| `Cannot find package 'amqplib'` | Run `npm install` in this folder |
| `PRECONDITION_FAILED - inequivalent arg 'durable'` | `task_queue` already exists with different settings. Delete it in the UI and rerun |
| Worker receives one task and then stops | It isn't acking. Check that `ch.ack(msg)` runs for every message, including when processing fails |
| `PRECONDITION_FAILED - delivery acknowledgement timed out` | A task took longer than the broker's ack timeout (30 minutes by default) and the channel was closed |

---

## Cleanup

```bash
docker exec rabbitmq rabbitmqadmin queues delete --name task_queue
```

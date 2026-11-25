// Worker: takes tasks from "task_queue" one at a time. Run several copies to share the load.
import amqp from "amqplib";

const QUEUE = "task_queue";
const name = process.argv[2] || `worker-${process.pid}`;

const conn = await amqp.connect("amqp://localhost");
conn.on("error", (err) => console.error("Connection error:", err.message));
const ch = await conn.createChannel();
ch.on("error", (err) => console.error("Channel error:", err.message));

await ch.assertQueue(QUEUE, { durable: true });

// Fair dispatch: don't give this worker a new task until it has acked the current one.
// Without this, RabbitMQ deals tasks out round-robin regardless of how busy each worker is.
await ch.prefetch(1);

console.log(` [*] ${name} waiting for tasks. Press CTRL+C to exit`);

await ch.consume(
  QUEUE,
  async (msg) => {
    if (msg === null) return; // consumer was cancelled by the server
    const text = msg.content.toString();
    const seconds = text.split(".").length - 1;
    console.log(` [x] ${name} received '${text}' (${seconds}s of work)`);

    await new Promise((r) => setTimeout(r, seconds * 1000));

    console.log(` [✓] ${name} done '${text}'`);
    // Manual ack: only now does RabbitMQ delete the message.
    // If this worker dies before acking, the task goes back to the queue for another worker.
    ch.ack(msg);
  },
  { noAck: false }
);

process.on("SIGINT", async () => {
  await conn.close();
  process.exit(0);
});

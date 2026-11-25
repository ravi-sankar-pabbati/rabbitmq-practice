// Producer: puts one task on the "task_queue".
// Each "." in the message = 1 second of fake work, e.g.  node new_task.js "Resize image..."
import amqp from "amqplib";

const QUEUE = "task_queue";
const msg = process.argv.slice(2).join(" ") || "Hello World.";

const conn = await amqp.connect("amqp://localhost");
conn.on("error", (err) => console.error("Connection error:", err.message));
const ch = await conn.createChannel();
ch.on("error", (err) => console.error("Channel error:", err.message));

// durable: the queue survives a broker restart.
await ch.assertQueue(QUEUE, { durable: true });

// persistent: the message is written to disk, so it also survives a restart.
ch.sendToQueue(QUEUE, Buffer.from(msg), { persistent: true });
console.log(` [x] Sent '${msg}'`);

await ch.close(); // flushes pending publishes before closing
await conn.close();

// Subscriber for a TOPIC exchange: bind with patterns.
//   *  matches exactly one word     payments.*      -> payments.refund   (not payments.card.error)
//   #  matches zero or more words   payments.#      -> payments, payments.refund, payments.card.error
//   node receive_logs_topic.js "*.*.error"
import { openChannel } from "./connect.js";

const EXCHANGE = "topic_logs";
const patterns = process.argv.slice(2);
if (patterns.length === 0) {
  console.log('Usage: node receive_logs_topic.js "<pattern>" ["<pattern>" ...]');
  process.exit(1);
}

const { conn, ch } = await openChannel();
await ch.assertExchange(EXCHANGE, "topic", { durable: false });
const { queue } = await ch.assertQueue("", { exclusive: true });

for (const pattern of patterns) {
  await ch.bindQueue(queue, EXCHANGE, pattern);
}
console.log(` [*] Waiting for [${patterns.join(", ")}]. Press CTRL+C to exit`);

await ch.consume(
  queue,
  (msg) => console.log(` [x] ${msg.fields.routingKey}: '${msg.content.toString()}'`),
  { noAck: true }
);

process.on("SIGINT", async () => { await conn.close(); process.exit(0); });

// Subscriber for a DIRECT exchange: pick which severities you want.
//   node receive_logs_direct.js error            -> only errors
//   node receive_logs_direct.js info warning error -> everything
import { openChannel } from "./connect.js";

const EXCHANGE = "direct_logs";
const severities = process.argv.slice(2);
if (severities.length === 0) {
  console.log("Usage: node receive_logs_direct.js [info] [warning] [error]");
  process.exit(1);
}

const { conn, ch } = await openChannel();
await ch.assertExchange(EXCHANGE, "direct", { durable: false });

// Private, server-named queue (same idea as lesson 3).
const { queue } = await ch.assertQueue("", { exclusive: true });

// One binding per severity. A queue can have many bindings.
for (const severity of severities) {
  await ch.bindQueue(queue, EXCHANGE, severity);
}
console.log(` [*] Waiting for [${severities.join(", ")}]. Press CTRL+C to exit`);

await ch.consume(
  queue,
  (msg) => console.log(` [x] ${msg.fields.routingKey}: '${msg.content.toString()}'`),
  { noAck: true }
);

process.on("SIGINT", async () => { await conn.close(); process.exit(0); });

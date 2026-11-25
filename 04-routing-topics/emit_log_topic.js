// Publisher for a TOPIC exchange. The routing key is a dot-separated list of words.
//   node emit_log_topic.js payments.card.error "Card declined"
import { openChannel } from "./connect.js";

const EXCHANGE = "topic_logs";
const [key = "anonymous.info", ...rest] = process.argv.slice(2);
const msg = rest.join(" ") || "Hello World!";

const { conn, ch } = await openChannel();
await ch.assertExchange(EXCHANGE, "topic", { durable: false });

ch.publish(EXCHANGE, key, Buffer.from(msg));
console.log(` [x] Sent ${key}: '${msg}'`);

await ch.close();
await conn.close();

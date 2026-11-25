// Publisher for a DIRECT exchange. The routing key is the severity.
//   node emit_log_direct.js error "Disk full"
import { openChannel } from "./connect.js";

const EXCHANGE = "direct_logs";
const [severity = "info", ...rest] = process.argv.slice(2);
const msg = rest.join(" ") || "Hello World!";

const { conn, ch } = await openChannel();
await ch.assertExchange(EXCHANGE, "direct", { durable: false });

// Direct exchange: delivered to every queue bound with EXACTLY this routing key.
ch.publish(EXCHANGE, severity, Buffer.from(msg));
console.log(` [x] Sent ${severity}: '${msg}'`);

await ch.close();
await conn.close();

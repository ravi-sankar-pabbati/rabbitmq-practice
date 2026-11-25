// Shared helper: open a connection + channel with error listeners attached.
import amqp from "amqplib";

export async function openChannel() {
  const conn = await amqp.connect("amqp://localhost");
  conn.on("error", (err) => console.error("Connection error:", err.message));
  const ch = await conn.createChannel();
  ch.on("error", (err) => console.error("Channel error:", err.message));
  return { conn, ch };
}

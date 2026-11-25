"""Consumer: waits for messages on the 'hello' queue and prints them."""
import threading
import pika


def callback(ch, method, properties, body):
    print(f" [x] Received {body.decode()!r}", flush=True)


with pika.Connection(pika.ConnectionParameters("localhost")) as connection:
    channel = connection.channel()
    channel.queue_declare(queue="hello", durable=True)  # safe to declare in both producer and consumer

    print(" [*] Waiting for messages. Press CTRL+C to exit", flush=True)
    # Messages are delivered to `callback` on a background thread.
    channel.basic_consume(queue="hello", on_message_callback=callback, auto_ack=True)
    try:
        threading.Event().wait()  # keep the main thread alive
    except KeyboardInterrupt:
        pass

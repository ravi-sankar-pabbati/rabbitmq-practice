"""Producer: publishes one message to the 'hello' queue."""
import sys
import pika

with pika.Connection(pika.ConnectionParameters("localhost")) as connection:
    channel = connection.channel()

    # Declaring is idempotent: creates the queue only if it doesn't exist.
    # RabbitMQ 4 requires shared (non-exclusive) queues to be durable.
    channel.queue_declare(queue="hello", durable=True)

    body = " ".join(sys.argv[1:]) or "Hello World!"
    # exchange="" is the default exchange: it routes straight to the queue named by routing_key.
    channel.basic_publish(exchange="", routing_key="hello", body=body)
    print(f" [x] Sent {body!r}")

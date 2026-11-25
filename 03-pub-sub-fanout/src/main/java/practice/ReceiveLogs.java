package practice;

import com.rabbitmq.client.BuiltinExchangeType;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import com.rabbitmq.client.DeliverCallback;

import java.nio.charset.StandardCharsets;

/** Subscriber: gets its own private queue and receives a copy of every log message. */
public class ReceiveLogs {
    public static void main(String[] args) throws Exception {
        String name = args.length > 0 ? args[0] : "subscriber";

        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost("localhost");
        Connection connection = factory.newConnection();
        Channel channel = connection.createChannel();

        channel.exchangeDeclare(EmitLog.EXCHANGE, BuiltinExchangeType.FANOUT);

        // queueDeclare() with no arguments = a fresh queue with a server-generated name (amq.gen-...)
        // that is exclusive to this connection and deleted when we disconnect.
        // Each subscriber gets its OWN queue, which is why each one receives every message.
        String queueName = channel.queueDeclare().getQueue();

        // The binding is what connects the exchange to our queue.
        channel.queueBind(queueName, EmitLog.EXCHANGE, "");

        System.out.println(" [*] " + name + " listening on queue " + queueName + ". Press CTRL+C to exit");

        DeliverCallback onMessage = (consumerTag, delivery) -> {
            String message = new String(delivery.getBody(), StandardCharsets.UTF_8);
            System.out.println(" [x] " + name + " got '" + message + "'");
        };
        channel.basicConsume(queueName, true, onMessage, consumerTag -> { });

        // Consumer callbacks run on the client's own threads; close cleanly on CTRL+C.
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try { connection.close(); } catch (Exception ignored) { }
        }));
    }
}

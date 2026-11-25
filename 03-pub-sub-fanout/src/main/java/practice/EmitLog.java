package practice;

import com.rabbitmq.client.BuiltinExchangeType;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;

import java.nio.charset.StandardCharsets;

/** Publisher: sends one log message to the "logs" fanout exchange. */
public class EmitLog {
    static final String EXCHANGE = "logs";

    public static void main(String[] args) throws Exception {
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost("localhost");

        try (Connection connection = factory.newConnection();
             Channel channel = connection.createChannel()) {

            // A fanout exchange ignores the routing key and copies each message to EVERY bound queue.
            channel.exchangeDeclare(EXCHANGE, BuiltinExchangeType.FANOUT);

            String message = args.length > 0 ? String.join(" ", args) : "info: Hello World!";
            // The publisher doesn't know (or care) which queues exist: it only talks to the exchange.
            // If no queue is bound yet, the message is simply dropped.
            channel.basicPublish(EXCHANGE, "", null, message.getBytes(StandardCharsets.UTF_8));
            System.out.println(" [x] Sent '" + message + "'");
        }
    }
}

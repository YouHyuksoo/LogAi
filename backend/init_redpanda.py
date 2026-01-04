from kafka.admin import KafkaAdminClient, NewTopic
from app.core.config import settings

def init_topics():
    admin_client = KafkaAdminClient(
        bootstrap_servers=settings.REDPANDA_BROKER,
        client_id='admin_client'
    )

    topic_list = []
    topic_list.append(NewTopic(name="logs-raw", num_partitions=1, replication_factor=1))
    topic_list.append(NewTopic(name="logs-parsed", num_partitions=1, replication_factor=1))

    existing_topics = admin_client.list_topics()
    
    new_topics = [topic for topic in topic_list if topic.name not in existing_topics]
    
    if new_topics:
        admin_client.create_topics(new_topics=new_topics, validate_only=False)
        print(f"Created topics: {[t.name for t in new_topics]}")
    else:
        print("All topics already exist.")

if __name__ == "__main__":
    init_topics()

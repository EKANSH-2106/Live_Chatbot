
from sqlalchemy import inspect

from database import Base, engine
import models  # Registers the Conversation and Message tables


def initialize_database():
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    print("Database initialized successfully.")
    print("Database location:", engine.url.database)
    print("Tables found:", tables)

    expected_tables = {"conversations", "messages"}

    if expected_tables.issubset(set(tables)):
        print("Verification passed: both tables exist.")
    else:
        raise RuntimeError("Database verification failed.")


if __name__ == "__main__":
    initialize_database()

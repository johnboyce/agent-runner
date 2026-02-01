"""
Database migration script to add new columns to Run table.

Adds:
- name (String, nullable)
- run_type (String, default='agent')
- options (Text, nullable) - JSON string
- run_metadata (Text, nullable) - JSON string for custom metadata
"""

import sqlite3
import os

def migrate():
    """Apply migration to add new columns to runs table"""
    db_path = os.path.join(os.path.dirname(__file__), '../db/platform.db')

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        print("Creating fresh database with new schema...")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(runs)")
        columns = [col[1] for col in cursor.fetchall()]

        migrations_needed = []

        if 'name' not in columns:
            migrations_needed.append("ALTER TABLE runs ADD COLUMN name VARCHAR")

        if 'run_type' not in columns:
            migrations_needed.append("ALTER TABLE runs ADD COLUMN run_type VARCHAR DEFAULT 'agent'")

        if 'options' not in columns:
            migrations_needed.append("ALTER TABLE runs ADD COLUMN options TEXT")

        if 'run_metadata' not in columns:
            migrations_needed.append("ALTER TABLE runs ADD COLUMN run_metadata TEXT")

        if not migrations_needed:
            print("✅ Database is already up to date!")
            return

        print(f"Applying {len(migrations_needed)} migration(s)...")

        for migration in migrations_needed:
            print(f"  - {migration}")
            cursor.execute(migration)

        conn.commit()
        print("✅ Migration completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()

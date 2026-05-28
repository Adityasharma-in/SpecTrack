import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()

password = os.environ.get("SUPABASE_DB_PASSWORD", "")
ref = "sqkkqonqpgdklztrkvsb"
sqls = [
    "ALTER TABLE tracked_repositories ADD COLUMN IF NOT EXISTS user_id TEXT;",
    "ALTER TABLE repository_updates ADD COLUMN IF NOT EXISTS user_id TEXT;",
    "CREATE INDEX IF NOT EXISTS idx_tracked_repositories_user_id ON tracked_repositories(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_repository_updates_user_id ON repository_updates(user_id);",
]

if password:
    for host in [
        f"db.{ref}.supabase.co:5432",
        f"aws-0-us-east-1.pooler.supabase.com:6543",
    ]:
        cs = f"postgresql://postgres:{password}@{host}/postgres?sslmode=require"
        try:
            conn = psycopg2.connect(cs, connect_timeout=5)
            cur = conn.cursor()
            for sql in sqls:
                cur.execute(sql)
            conn.commit()
            cur.close()
            conn.close()
            print("MIGRATION SUCCESSFUL!")
            sys.exit(0)
        except Exception:
            pass
    print("Could not connect with stored password.")

print("\nTo run the migration manually:")
print("1. Go to: https://supabase.com/dashboard/project/sqkkqonqpgdklztrkvsb/sql/new")
print("2. Copy and paste this SQL:\n")
print("#" * 50)
for sql in sqls:
    print(sql)
print("#" * 50)
print("\n3. Click Run or press Ctrl+Enter")
print("\nNeed help finding your DB password?")
print("  Dashboard -> Project Settings -> Database -> Database password")

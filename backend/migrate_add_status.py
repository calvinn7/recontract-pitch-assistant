"""
One-time migration: add 'status' column to pitch_drafts table.
Run this once against your Supabase database after deploying the new code.

Usage:
  cd backend
  python migrate_add_status.py
"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not set")

async def run():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        # Add column only if it doesn't already exist (idempotent)
        await conn.execute(text("""
            ALTER TABLE pitch_drafts
            ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'pending';
        """))
    await engine.dispose()
    print("Migration complete: 'status' column added to pitch_drafts.")

if __name__ == "__main__":
    asyncio.run(run())

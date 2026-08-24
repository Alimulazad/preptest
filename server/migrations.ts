import pg from 'pg';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';

dotenv.config();

export interface Migration {
  id: string;
  name: string;
  up: (client: pg.PoolClient) => Promise<void>;
  down?: (client: pg.PoolClient) => Promise<void>;
}

export const migrations: Migration[] = [
  {
    id: '001_initial_schema',
    name: 'Create base tables (topics, questions, users, progress, chat, drafts, settings, snippets)',
    up: async (client: pg.PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS topics (
          id VARCHAR(255) PRIMARY KEY,
          chapter_id VARCHAR(255) NOT NULL,
          subject_id VARCHAR(255),
          paper VARCHAR(50),
          topic_code VARCHAR(100),
          name TEXT NOT NULL,
          bangla_name TEXT NOT NULL,
          star_rating INTEGER DEFAULT 3,
          total_questions INTEGER DEFAULT 0,
          completed_questions INTEGER DEFAULT 0,
          mcq_count INTEGER DEFAULT 0,
          written_count INTEGER DEFAULT 0,
          exam_occurrences TEXT,
          key_points TEXT,
          created_at BIGINT
        );

        CREATE TABLE IF NOT EXISTS questions (
          id VARCHAR(255) PRIMARY KEY,
          subject_id VARCHAR(255) NOT NULL,
          subject_name VARCHAR(255) NOT NULL,
          paper VARCHAR(50) NOT NULL,
          chapter_id VARCHAR(255) NOT NULL,
          chapter_name VARCHAR(255) NOT NULL,
          topic_id VARCHAR(255) REFERENCES topics(id) ON DELETE SET NULL,
          topic_name VARCHAR(255),
          category VARCHAR(100),
          question_text TEXT NOT NULL,
          math_formula_latex TEXT,
          options TEXT NOT NULL,
          correct_ans VARCHAR(10) NOT NULL,
          explanation TEXT NOT NULL,
          explanation_latex TEXT,
          question_image_url TEXT,
          explanation_image_url TEXT,
          tags TEXT NOT NULL,
          star_rating INTEGER DEFAULT 3,
          type VARCHAR(50) DEFAULT 'mcq',
          difficulty VARCHAR(50) DEFAULT 'medium',
          created_at BIGINT
        );

        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          phone VARCHAR(50) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name VARCHAR(255) NOT NULL,
          target_university VARCHAR(100) DEFAULT 'du_a',
          target_unit VARCHAR(100) DEFAULT '''ক'' ইউনিট (বিজ্ঞান)',
          exam_year VARCHAR(50) DEFAULT 'HSC-26',
          college VARCHAR(255) DEFAULT 'ঢাকা কলেজ',
          avatar VARCHAR(50) DEFAULT '🧑‍🎓',
          avatar_color VARCHAR(50) DEFAULT '#2563eb',
          created_at BIGINT
        );

        CREATE TABLE IF NOT EXISTS user_progress (
          user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          points INTEGER DEFAULT 50,
          streak_days INTEGER DEFAULT 1,
          exams_completed INTEGER DEFAULT 0,
          total_correct INTEGER DEFAULT 0,
          total_wrong INTEGER DEFAULT 0,
          accuracy DOUBLE PRECISION DEFAULT 0.0,
          exam_history TEXT DEFAULT '[]',
          bookmarks TEXT DEFAULT '[]',
          past_mistakes TEXT DEFAULT '[]',
          chapter_progress TEXT DEFAULT '{}',
          avatar_seed VARCHAR(100),
          avatar_bg_color VARCHAR(50),
          updated_at BIGINT
        );

        CREATE TABLE IF NOT EXISTS chat_history (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255),
          role VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          model_used VARCHAR(100),
          provider VARCHAR(50),
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS admin_drafts (
          id VARCHAR(255) PRIMARY KEY,
          source VARCHAR(100) DEFAULT 'manual',
          chapter_id VARCHAR(255),
          subject VARCHAR(100),
          content TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          reviewed_by VARCHAR(255),
          reviewed_at BIGINT,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS admin_settings (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS knowledge_snippets (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          content_bn TEXT NOT NULL,
          content_latex TEXT,
          answer_bn TEXT,
          subject_id VARCHAR(100),
          chapter_id VARCHAR(100),
          active INTEGER DEFAULT 1,
          created_at BIGINT
        );
      `);
    },
  },
  {
    id: '002_add_indexes_and_constraints',
    name: 'Add query performance indexes on questions and chat history',
    up: async (client: pg.PoolClient) => {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_questions_subject_chapter ON questions (subject_id, chapter_id);
        CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions (topic_id);
        CREATE INDEX IF NOT EXISTS idx_chat_user_created ON chat_history (user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_admin_drafts_status ON admin_drafts (status, created_at);
      `);
    },
  },
  {
    id: '003_add_active_users_tracking',
    name: 'Add last_active_at, last_ip, last_device, and current_page tracking to users table',
    up: async (client: pg.PoolClient) => {
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at BIGINT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_device VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS current_page VARCHAR(100);
        CREATE INDEX IF NOT EXISTS idx_users_last_active ON users (last_active_at);
      `);
    },
  },
];

export async function runMigrations(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // Create migrations tracker table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Get executed migrations
    const res = await client.query(`SELECT id FROM _migrations`);
    const executedIds = new Set(res.rows.map((r) => r.id));

    for (const migration of migrations) {
      if (!executedIds.has(migration.id)) {
        logger.info(`[Database Migrations] 🚀 Running migration ${migration.id}: ${migration.name}`);
        await client.query('BEGIN');
        try {
          await migration.up(client);
          await client.query(`INSERT INTO _migrations (id, name) VALUES ($1, $2)`, [
            migration.id,
            migration.name,
          ]);
          await client.query('COMMIT');
          logger.info(`[Database Migrations] ✅ Migration ${migration.id} applied successfully.`);
        } catch (err: any) {
          await client.query('ROLLBACK');
          logger.error(`[Database Migrations] ❌ Migration ${migration.id} failed: ${err.message}`);
          throw err;
        }
      }
    }
  } finally {
    client.release();
  }
}

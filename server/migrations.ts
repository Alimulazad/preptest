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
  {
    id: '004_create_written_questions_table',
    name: 'Create written_questions table for descriptive engineering and varsity questions',
    up: async (client: pg.PoolClient) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS written_questions (
          id VARCHAR(255) PRIMARY KEY,
          subject_id VARCHAR(50) NOT NULL,
          subject_name VARCHAR(100) NOT NULL,
          paper VARCHAR(10) NOT NULL,
          chapter_id VARCHAR(50) NOT NULL,
          chapter_name VARCHAR(150) NOT NULL,
          topic_id VARCHAR(50),
          topic_name VARCHAR(150),
          question_number INTEGER,
          question_text TEXT NOT NULL,
          question_image_url TEXT,
          explanation TEXT NOT NULL,
          explanation_latex TEXT,
          explanation_image_urls TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          category VARCHAR(30),
          difficulty VARCHAR(20) DEFAULT 'medium',
          star_rating SMALLINT DEFAULT 1,
          created_at BIGINT,
          updated_at BIGINT,
          is_active BOOLEAN DEFAULT TRUE
        );

        CREATE INDEX IF NOT EXISTS idx_written_questions_subject_chapter ON written_questions (subject_id, chapter_id);
        CREATE INDEX IF NOT EXISTS idx_written_questions_topic ON written_questions (topic_id);
        CREATE INDEX IF NOT EXISTS idx_written_questions_is_active ON written_questions (is_active);
        CREATE INDEX IF NOT EXISTS idx_written_questions_created ON written_questions (created_at DESC);
      `);
    },
  },
  {
    id: '006_relational_hierarchy_and_gin_indexes',
    name: 'Create subjects, chapters, institutions, question_exam_occurrences tables, and setup GIN / tsvector full-text search indexes',
    up: async (client: pg.PoolClient) => {
      // 1. Subjects Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS subjects (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          bangla_name VARCHAR(150) NOT NULL,
          paper VARCHAR(20) NOT NULL DEFAULT 'both' CHECK (paper IN ('1st', '2nd', 'both')),
          created_at BIGINT
        );
      `);

      // 2. Chapters Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS chapters (
          id VARCHAR(100) PRIMARY KEY,
          subject_id VARCHAR(100) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          chapter_no INTEGER NOT NULL,
          name VARCHAR(200) NOT NULL,
          bangla_name VARCHAR(200) NOT NULL,
          paper VARCHAR(20) DEFAULT '1st',
          created_at BIGINT
        );
        CREATE INDEX IF NOT EXISTS idx_chapters_subject_id ON chapters (subject_id);
      `);

      // 3. Institutions Table (Universities, Engineering, Medical, Boards)
      await client.query(`
        CREATE TABLE IF NOT EXISTS institutions (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(200) NOT NULL,
          short_code VARCHAR(50) UNIQUE NOT NULL,
          bangla_name VARCHAR(200),
          category VARCHAR(50) NOT NULL DEFAULT 'varsity_a' CHECK (category IN ('engineering', 'varsity_a', 'medical', 'academic', 'main_book', 'other')),
          created_at BIGINT
        );
        CREATE INDEX IF NOT EXISTS idx_institutions_category ON institutions (category);
      `);

      // 4. Ensure Topics Table foreign key relations and indexes
      await client.query(`
        -- Add subject_id / chapter_id references if needed
        CREATE INDEX IF NOT EXISTS idx_topics_chapter_fk ON topics (chapter_id);
        CREATE INDEX IF NOT EXISTS idx_topics_subject_fk ON topics (subject_id);
      `);

      // 5. Update Questions Table with primary_category, JSONB options, TEXT[] tags and tsvector search
      await client.query(`
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS primary_category VARCHAR(50) DEFAULT 'varsity_a';
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS search_vector tsvector;

        -- Create B-Tree compound hierarchy index for lightning fast multi-level filtering
        CREATE INDEX IF NOT EXISTS idx_questions_hierarchy ON questions (subject_id, chapter_id, topic_id, type, primary_category, is_active);

        -- Create Full-Text Search tsvector index on questions
        CREATE INDEX IF NOT EXISTS idx_questions_fts ON questions USING GIN (search_vector);
      `);

      // 6. Question Exam Occurrences (M:N Relation for Multiple Exam Appearances)
      await client.query(`
        CREATE TABLE IF NOT EXISTS question_exam_occurrences (
          id SERIAL PRIMARY KEY,
          question_id VARCHAR(255) NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
          institution_id VARCHAR(100) NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
          exam_unit VARCHAR(50),
          session_year VARCHAR(50),
          question_no INTEGER,
          is_primary BOOLEAN DEFAULT FALSE,
          created_at BIGINT
        );

        CREATE INDEX IF NOT EXISTS idx_occurrences_question_id ON question_exam_occurrences (question_id);
        CREATE INDEX IF NOT EXISTS idx_occurrences_inst_year ON question_exam_occurrences (institution_id, session_year, exam_unit);
      `);

      // 7. Full-Text Search Trigger for automatic search_vector maintenance
      await client.query(`
        CREATE OR REPLACE FUNCTION update_questions_search_vector() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector :=
            setweight(to_tsvector('simple', COALESCE(NEW.question_text, '')), 'A') ||
            setweight(to_tsvector('simple', COALESCE(NEW.explanation, '')), 'B') ||
            setweight(to_tsvector('simple', COALESCE(NEW.tags, '')), 'C');
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_questions_search_vector ON questions;
        CREATE TRIGGER trg_questions_search_vector
        BEFORE INSERT OR UPDATE ON questions
        FOR EACH ROW
        EXECUTE FUNCTION update_questions_search_vector();

        -- Backfill existing questions search_vector
        UPDATE questions SET search_vector =
          setweight(to_tsvector('simple', COALESCE(question_text, '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(explanation, '')), 'B') ||
          setweight(to_tsvector('simple', COALESCE(tags, '')), 'C')
        WHERE search_vector IS NULL;
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

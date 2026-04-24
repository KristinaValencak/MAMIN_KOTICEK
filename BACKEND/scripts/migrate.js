"use strict";

require("dotenv").config();

const db = require("../config/database");

async function migrate() {
  console.log("Running migrations...");

  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS show_listings_on_profile boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS show_support_on_profile boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS show_posts_on_profile boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS is_profile_private boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
      ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
      ADD COLUMN IF NOT EXISTS anonymized_at timestamptz,
      ADD COLUMN IF NOT EXISTS deleted_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deleted_source text NOT NULL DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS deleted_reason text,
      ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
      ADD COLUMN IF NOT EXISTS suspended_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS suspension_reason text
  `);

  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`);

  // AuthZ: roles + permissions (moderation)
  await db.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      description TEXT
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, role_id)
    )
  `);

  // Seed baseline moderation permissions (idempotent).
  await db.query(`
    INSERT INTO permissions (code, description) VALUES
      ('moderation.reports.read', 'Read moderation reports / view hidden content'),
      ('moderation.reports.review', 'Review/resolve moderation reports'),
      ('moderation.content.hide', 'Hide content (posts/comments/listings)'),
      ('moderation.content.unhide', 'Unhide content (posts/comments/listings)')
    ON CONFLICT (code) DO NOTHING
  `);

  // Seed a default Moderator role (idempotent).
  await db.query(`
    INSERT INTO roles (name, description)
    VALUES ('Moderator', 'Moderator: review reports and hide content')
    ON CONFLICT (name) DO NOTHING
  `);
  await db.query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.code IN (
      'moderation.reports.read',
      'moderation.reports.review',
      'moderation.content.hide',
      'moderation.content.unhide'
    )
    WHERE r.name = 'Moderator'
    ON CONFLICT DO NOTHING
  `);

  await db.query(`
    ALTER TABLE marketplace_listings
      ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
      ADD COLUMN IF NOT EXISTS hidden_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
      ADD COLUMN IF NOT EXISTS deleted_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deleted_source text NOT NULL DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS deleted_reason text
  `);

  // Soft-delete columns for forum content
  await db.query(`
    ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
      ADD COLUMN IF NOT EXISTS deleted_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deleted_source text NOT NULL DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS deleted_reason text
  `);
  await db.query(`
    ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
      ADD COLUMN IF NOT EXISTS deleted_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deleted_source text NOT NULL DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS deleted_reason text
  `);

  // Status constraints (best-effort; keep idempotent)
  await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check`);
  await db.query(`
    ALTER TABLE users
      ADD CONSTRAINT users_status_check
      CHECK (status IN ('active','deactivated','deleted'))
  `);

  await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_deleted_source_check`);
  await db.query(`
    ALTER TABLE users
      ADD CONSTRAINT users_deleted_source_check
      CHECK (deleted_source IN ('user','admin','system'))
  `);

  await db.query(`ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check`);
  await db.query(`
    ALTER TABLE posts
      ADD CONSTRAINT posts_status_check
      CHECK (status IN ('active','deleted'))
  `);

  await db.query(`ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_deleted_source_check`);
  await db.query(`
    ALTER TABLE posts
      ADD CONSTRAINT posts_deleted_source_check
      CHECK (deleted_source IN ('user','admin','system'))
  `);

  await db.query(`ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_status_check`);
  await db.query(`
    ALTER TABLE comments
      ADD CONSTRAINT comments_status_check
      CHECK (status IN ('active','deleted'))
  `);

  await db.query(`ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_deleted_source_check`);
  await db.query(`
    ALTER TABLE comments
      ADD CONSTRAINT comments_deleted_source_check
      CHECK (deleted_source IN ('user','admin','system'))
  `);

  // Marketplace status constraint is optional because schema may vary; attempt only if status exists.
  // If marketplace_listings.status has a legacy CHECK, keep it; we only add one when absent.
  await db.query(`ALTER TABLE marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_status_check`);
  await db.query(`
    ALTER TABLE marketplace_listings
      ADD CONSTRAINT marketplace_listings_status_check
      CHECK (status IN ('active','removed','deleted'))
  `);

  await db.query(`ALTER TABLE marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_deleted_source_check`);
  await db.query(`
    ALTER TABLE marketplace_listings
      ADD CONSTRAINT marketplace_listings_deleted_source_check
      CHECK (deleted_source IN ('user','admin','system'))
  `);

  // Indexes to keep feeds fast (best-effort, idempotent)
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_posts_active_created
    ON posts (created_at DESC)
    WHERE status = 'active' AND deleted_at IS NULL
  `);

  // Moderation dashboard indexes (reports + hidden + suspended)
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_content_reports_status_type_created
    ON content_reports (status, target_type, created_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_posts_hidden_hiddenat
    ON posts (hidden_at DESC, id DESC)
    WHERE is_hidden = true AND status <> 'deleted' AND deleted_at IS NULL
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_users_suspended_at
    ON users (suspended_at DESC, id DESC)
    WHERE is_suspended = true AND status <> 'deleted' AND deleted_at IS NULL
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_comments_active_created
    ON comments (created_at ASC)
    WHERE status = 'active' AND deleted_at IS NULL
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_marketplace_active_created
    ON marketplace_listings (created_at DESC)
    WHERE status = 'active' AND deleted_at IS NULL
  `);

  // Deletion events: a unified admin feed for deleted/restored/purged.
  await db.query(`
    CREATE TABLE IF NOT EXISTS deletion_events (
      id BIGSERIAL PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id BIGINT NOT NULL,
      event_type TEXT NOT NULL,
      actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      source TEXT NOT NULL,
      reason TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE deletion_events DROP CONSTRAINT IF EXISTS deletion_events_target_type_check`);
  await db.query(`
    ALTER TABLE deletion_events
      ADD CONSTRAINT deletion_events_target_type_check
      CHECK (target_type IN ('post','comment','marketplace_listing','user'))
  `);
  await db.query(`ALTER TABLE deletion_events DROP CONSTRAINT IF EXISTS deletion_events_event_type_check`);
  await db.query(`
    ALTER TABLE deletion_events
      ADD CONSTRAINT deletion_events_event_type_check
      CHECK (event_type IN ('deleted','restored','purged'))
  `);
  await db.query(`ALTER TABLE deletion_events DROP CONSTRAINT IF EXISTS deletion_events_source_check`);
  await db.query(`
    ALTER TABLE deletion_events
      ADD CONSTRAINT deletion_events_source_check
      CHECK (source IN ('user','admin','system'))
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_deletion_events_target_created
    ON deletion_events (target_type, target_id, created_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_deletion_events_event_created
    ON deletion_events (event_type, created_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_deletion_events_source_created
    ON deletion_events (source, created_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS post_favorites (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, post_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_post_favorites_user_created
    ON post_favorites (user_id, created_at DESC)
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_post_favorites_post_id ON post_favorites (post_id)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS moderation_appeals (
      id BIGSERIAL PRIMARY KEY,
      target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
      target_id BIGINT NOT NULL,
      appellant_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved_upheld', 'resolved_reversed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      resolved_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  // Widen allowed target types (older DBs may have the original check constraint).
  await db.query(`
    ALTER TABLE moderation_appeals
      DROP CONSTRAINT IF EXISTS moderation_appeals_target_type_check
  `);
  await db.query(`
    ALTER TABLE moderation_appeals
      ADD CONSTRAINT moderation_appeals_target_type_check
      CHECK (target_type IN ('post', 'comment', 'marketplace_listing', 'user_profile'))
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_appeals_one_pending
    ON moderation_appeals (target_type, target_id)
    WHERE status = 'pending'
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_moderation_appeals_status ON moderation_appeals (status, created_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS banned_words (
      id BIGSERIAL PRIMARY KEY,
      word TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_banned_words_word ON banned_words (word)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS message_threads (
      id SERIAL PRIMARY KEY,
      user_id_1 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id_2 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      declined_at TIMESTAMPTZ,
      last_message_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT message_threads_pair_unique UNIQUE (user_id_1, user_id_2),
      CONSTRAINT message_threads_ordered_pair CHECK (user_id_1 < user_id_2)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_thread_id_id ON messages (thread_id, id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON user_blocks (blocked_id)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS message_thread_reads (
      thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_read_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
      last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (thread_id, user_id)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_message_thread_reads_user_id ON message_thread_reads (user_id)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_presence (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_user_presence_last_active_at ON user_presence (last_active_at)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS message_typing (
      thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      typing_until TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (thread_id, user_id)
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_message_typing_thread_id_typing_until ON message_typing (thread_id, typing_until)`
  );

  try {
    await db.query(`ALTER TABLE notifications ALTER COLUMN post_id DROP NOT NULL`);
  } catch {
    // ignore
  }

  await db.query(`
    ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS comment_id integer,
      ADD COLUMN IF NOT EXISTS thread_id integer,
      ADD COLUMN IF NOT EXISTS message_id integer,
      ADD COLUMN IF NOT EXISTS appeal_id bigint,
      ADD COLUMN IF NOT EXISTS friend_request_id bigint,
      ADD COLUMN IF NOT EXISTS metadata jsonb
  `);

  // Prevent duplicate friend-request notifications for the same logical request.
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_friend_request_dedupe
    ON notifications (user_id, type, actor_id, friend_request_id)
    WHERE type::text = 'friend_request' AND friend_request_id IS NOT NULL
  `);

  // Prevent duplicates for acceptance notifications too (retries / double submits).
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_friend_accept_dedupe
    ON notifications (user_id, type, actor_id, friend_request_id)
    WHERE type::text = 'friend_accept' AND friend_request_id IS NOT NULL
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS push_device_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fcm_token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL CHECK (platform IN ('web','android','ios')),
      device_id TEXT,
      app_version TEXT,
      app_build TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      disabled_at TIMESTAMPTZ,
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_failure_at TIMESTAMPTZ
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user_active
    ON push_device_tokens (user_id, disabled_at)
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_push_device_tokens_user_device
    ON push_device_tokens (user_id, device_id)
    WHERE device_id IS NOT NULL
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS push_outbox (
      id BIGSERIAL PRIMARY KEY,
      notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','dead')),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (notification_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_push_outbox_due
    ON push_outbox (status, next_attempt_at)
  `);

  console.log("Migrations done ✔️");
}

migrate()
  .then(() => db.end())
  .catch((err) => {
    console.error("Migration failed:", err);
    db.end().catch(() => {});
    process.exit(1);
  });


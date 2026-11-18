/** Additive local upgrade, including the widened check on the existing action table. */
export function upgradeOperationalSchema(db) {
  db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
  try {
    const add = (table, column, type) => {
      if (!db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      }
    };
    if (!db.prepare('PRAGMA table_info(action)').all().some(row => row.name === 'reason')) {
      db.exec(`
        CREATE TABLE action_upgrade (
          id TEXT PRIMARY KEY, subject TEXT NOT NULL, action_type TEXT NOT NULL,
          owner TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('open','in_progress','blocked','completed','cancelled','failed')),
          due TEXT NOT NULL, next_action TEXT NOT NULL, evidence TEXT NOT NULL,
          updated_at TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'normal'
            CHECK(priority IN ('low','normal','high','urgent')),
          subject_type TEXT, blocker TEXT, blocker_owner TEXT, review_date TEXT,
          version INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO action_upgrade(id,subject,action_type,owner,status,due,next_action,evidence,updated_at)
          SELECT id,subject,action_type,owner,status,due,next_action,evidence,updated_at FROM action;
        DROP TABLE action;
        ALTER TABLE action_upgrade RENAME TO action;
        CREATE INDEX action_queue ON action(status,owner,due,review_date);
      `);
    }
    add('outcome', 'stage', 'TEXT');
    add('outcome', 'occurred_on', 'TEXT');
    add('outcome', 'follow_up_id', 'TEXT REFERENCES action(id)');
    add('requirement', 'status', "TEXT NOT NULL DEFAULT 'draft'");
    add('requirement', 'version', 'INTEGER NOT NULL DEFAULT 0');
    add('introduction', 'introduced_on', 'TEXT');
    add('introduction', 'method', 'TEXT');
    add('introduction', 'follow_up_owner', 'TEXT');
    add('agreement_version', 'execution_state', "TEXT NOT NULL DEFAULT 'unverified'");
    add('agreement_version', 'terms_reference', 'TEXT');
    add('partner', 'owner', 'TEXT');
    add('entitlement', 'basis', 'TEXT');
    db.exec(`
      CREATE INDEX IF NOT EXISTS outcome_subject ON outcome(record_type, record_id);
      CREATE INDEX IF NOT EXISTS outcome_correction ON outcome(supersedes);
      CREATE TABLE IF NOT EXISTS assessment_criterion (
        id TEXT PRIMARY KEY, requirement_id TEXT NOT NULL REFERENCES requirement(id),
        label TEXT NOT NULL, relevance TEXT NOT NULL, UNIQUE(requirement_id,label)
      );
      CREATE TABLE IF NOT EXISTS assessment_review (
        id TEXT PRIMARY KEY, consideration_id TEXT NOT NULL REFERENCES consideration(id),
        criterion_id TEXT NOT NULL REFERENCES assessment_criterion(id),
        observation TEXT NOT NULL, evidence TEXT NOT NULL, limitation TEXT,
        reviewer TEXT NOT NULL, reviewed_on TEXT NOT NULL,
        recommendation TEXT, recommendation_reason TEXT
      );
      CREATE TABLE IF NOT EXISTS invoice_adjustment (
        id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoice(id),
        amount INTEGER NOT NULL CHECK(amount<>0), reason TEXT NOT NULL,
        evidence TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL,
        reversal_of TEXT UNIQUE REFERENCES invoice_adjustment(id)
      );
    `);
    if (db.prepare('PRAGMA foreign_key_check').get()) throw new Error('FOREIGN_KEY_CHECK_FAILED');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys=ON');
  }
}

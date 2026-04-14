-- ============================================================
-- Station-OS: AI Layer (RAG + Chat + Incidents + Proactive alerts)
-- Migration: 20260404_ai_layer.sql
-- Depends on: 20260401_station_os_schema.sql, 20260402_multi_tenant.sql
-- ============================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─── ENUMS ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE ai_message_role AS ENUM ('user','assistant','tool','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ai_message_status AS ENUM ('pending','streaming','complete','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE kb_source_type AS ENUM ('manual','log','runbook','procedure','schema_doc','faq','external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM ('open','triaging','awaiting_user','resolved','escalated','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE incident_severity AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE incident_step_status AS ENUM ('pending','in_progress','done','skipped','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE alert_source AS ENUM ('RULE_ENGINE','AI_AGENT','HUMAN','EDGE_AGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'AI_ANOMALY';
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'AI_PREDICTION';
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'AI_INSIGHT';
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'INCIDENT_ESCALATED';

-- ─── ALERTS: EXTENSIONES PARA IA ─────────────────────────────────────────────
ALTER TABLE alerts
    ADD COLUMN IF NOT EXISTS source         alert_source NOT NULL DEFAULT 'RULE_ENGINE',
    ADD COLUMN IF NOT EXISTS ai_reasoning   TEXT,
    ADD COLUMN IF NOT EXISTS ai_confidence  NUMERIC(3,2) CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
    ADD COLUMN IF NOT EXISTS ai_model       TEXT,
    ADD COLUMN IF NOT EXISTS incident_id    UUID;

CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source);
CREATE INDEX IF NOT EXISTS idx_alerts_ai_unresolved ON alerts(source, resolved) WHERE source = 'AI_AGENT';

-- ============================================================
-- KNOWLEDGE BASE (RAG)
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_owner_email    TEXT,
    title                 TEXT NOT NULL,
    source_type           kb_source_type NOT NULL,
    source_uri            TEXT,
    equipment             TEXT[] NOT NULL DEFAULT '{}',
    error_codes           TEXT[] NOT NULL DEFAULT '{}',
    language              TEXT NOT NULL DEFAULT 'es',
    version               INTEGER NOT NULL DEFAULT 1,
    content_hash          TEXT,
    embedding_model       TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    chunk_count           INTEGER NOT NULL DEFAULT 0,
    metadata              JSONB NOT NULL DEFAULT '{}',
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_by            TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT knowledge_documents_owner_lower CHECK (tenant_owner_email IS NULL OR tenant_owner_email = LOWER(tenant_owner_email))
);

CREATE INDEX IF NOT EXISTS idx_kb_docs_tenant       ON knowledge_documents(tenant_owner_email);
CREATE INDEX IF NOT EXISTS idx_kb_docs_source_type  ON knowledge_documents(source_type);
CREATE INDEX IF NOT EXISTS idx_kb_docs_equipment    ON knowledge_documents USING GIN (equipment);
CREATE INDEX IF NOT EXISTS idx_kb_docs_error_codes  ON knowledge_documents USING GIN (error_codes);
CREATE INDEX IF NOT EXISTS idx_kb_docs_hash         ON knowledge_documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_kb_docs_active       ON knowledge_documents(is_active) WHERE is_active;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id         UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    tenant_owner_email  TEXT,
    chunk_index         INTEGER NOT NULL,
    content             TEXT NOT NULL,
    token_count         INTEGER,
    embedding           vector(1536) NOT NULL,
    embedding_model     TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding_hnsw
    ON knowledge_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_document ON knowledge_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_tenant   ON knowledge_chunks(tenant_owner_email);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_meta     ON knowledge_chunks USING GIN (metadata);

CREATE OR REPLACE FUNCTION kb_chunks_sync_tenant()
RETURNS TRIGGER AS $$
BEGIN
    SELECT tenant_owner_email INTO NEW.tenant_owner_email
    FROM knowledge_documents WHERE id = NEW.document_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kb_chunks_sync_tenant ON knowledge_chunks;
CREATE TRIGGER trg_kb_chunks_sync_tenant
    BEFORE INSERT OR UPDATE OF document_id ON knowledge_chunks
    FOR EACH ROW EXECUTE FUNCTION kb_chunks_sync_tenant();

CREATE OR REPLACE FUNCTION kb_docs_update_chunk_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE knowledge_documents SET chunk_count = chunk_count + 1, updated_at = now() WHERE id = NEW.document_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE knowledge_documents SET chunk_count = GREATEST(0, chunk_count - 1), updated_at = now() WHERE id = OLD.document_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kb_docs_chunk_count ON knowledge_chunks;
CREATE TRIGGER trg_kb_docs_chunk_count
    AFTER INSERT OR DELETE ON knowledge_chunks
    FOR EACH ROW EXECUTE FUNCTION kb_docs_update_chunk_count();

DROP TRIGGER IF EXISTS update_kb_docs_updated_at ON knowledge_documents;
CREATE TRIGGER update_kb_docs_updated_at
    BEFORE UPDATE ON knowledge_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CHAT (AI Conversations)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_owner_email  TEXT NOT NULL,
    station_id          UUID REFERENCES stations(id) ON DELETE SET NULL,
    user_email          TEXT NOT NULL,
    title               TEXT,
    pinned              BOOLEAN NOT NULL DEFAULT FALSE,
    archived            BOOLEAN NOT NULL DEFAULT FALSE,
    last_message_at     TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_conversations_owner_lower CHECK (tenant_owner_email = LOWER(tenant_owner_email))
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_owner_recent  ON ai_conversations(tenant_owner_email, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ai_conv_station       ON ai_conversations(station_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conv_user          ON ai_conversations(user_email, last_message_at DESC);

DROP TRIGGER IF EXISTS update_ai_conversations_updated_at ON ai_conversations;
CREATE TRIGGER update_ai_conversations_updated_at
    BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS ai_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    tenant_owner_email  TEXT NOT NULL,
    role                ai_message_role NOT NULL,
    status              ai_message_status NOT NULL DEFAULT 'complete',
    content             TEXT NOT NULL DEFAULT '',
    content_blocks      JSONB,
    tool_calls          JSONB,
    tool_results        JSONB,
    citations           JSONB NOT NULL DEFAULT '[]',
    model               TEXT,
    input_tokens        INTEGER,
    output_tokens       INTEGER,
    latency_ms          INTEGER,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_time ON ai_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant    ON ai_messages(tenant_owner_email);
CREATE INDEX IF NOT EXISTS idx_ai_messages_citations ON ai_messages USING GIN (citations);

CREATE OR REPLACE FUNCTION ai_messages_sync_tenant()
RETURNS TRIGGER AS $$
BEGIN
    SELECT tenant_owner_email INTO NEW.tenant_owner_email
    FROM ai_conversations WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_messages_sync_tenant ON ai_messages;
CREATE TRIGGER trg_ai_messages_sync_tenant
    BEFORE INSERT ON ai_messages
    FOR EACH ROW EXECUTE FUNCTION ai_messages_sync_tenant();

CREATE OR REPLACE FUNCTION ai_conversations_bump_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ai_conversations
       SET last_message_at = NEW.created_at,
           updated_at      = now()
     WHERE id = NEW.conversation_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_conversations_bump ON ai_messages;
CREATE TRIGGER trg_ai_conversations_bump
    AFTER INSERT ON ai_messages
    FOR EACH ROW EXECUTE FUNCTION ai_conversations_bump_last_message();

-- ============================================================
-- INCIDENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS incidents (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id              UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    tenant_owner_email      TEXT NOT NULL,
    reported_by             TEXT NOT NULL,
    title                   TEXT NOT NULL,
    description             TEXT NOT NULL,
    severity                incident_severity NOT NULL DEFAULT 'medium',
    status                  incident_status NOT NULL DEFAULT 'open',
    equipment               TEXT[] NOT NULL DEFAULT '{}',
    error_codes             TEXT[] NOT NULL DEFAULT '{}',
    conversation_id         UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
    triggered_by_alert_id   UUID REFERENCES alerts(id) ON DELETE SET NULL,
    resolved_at             TIMESTAMPTZ,
    resolved_by             TEXT,
    resolution_summary      TEXT,
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT incidents_owner_lower CHECK (tenant_owner_email = LOWER(tenant_owner_email))
);

CREATE INDEX IF NOT EXISTS idx_incidents_station_status ON incidents(station_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant         ON incidents(tenant_owner_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_open           ON incidents(station_id, created_at DESC) WHERE status IN ('open','triaging','awaiting_user');
CREATE INDEX IF NOT EXISTS idx_incidents_equipment      ON incidents USING GIN (equipment);
CREATE INDEX IF NOT EXISTS idx_incidents_error_codes    ON incidents USING GIN (error_codes);

DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
CREATE TRIGGER update_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$ BEGIN
    ALTER TABLE alerts
        ADD CONSTRAINT alerts_incident_id_fkey
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS incident_diagnoses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id         UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    version             INTEGER NOT NULL DEFAULT 1,
    summary             TEXT NOT NULL,
    reasoning           TEXT,
    confidence          NUMERIC(3,2) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    model               TEXT,
    citations           JSONB NOT NULL DEFAULT '[]',
    superseded_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (incident_id, version)
);

CREATE INDEX IF NOT EXISTS idx_incident_diag_incident ON incident_diagnoses(incident_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_incident_diag_active   ON incident_diagnoses(incident_id) WHERE superseded_at IS NULL;

CREATE TABLE IF NOT EXISTS incident_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id         UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    diagnosis_id        UUID REFERENCES incident_diagnoses(id) ON DELETE SET NULL,
    step_order          INTEGER NOT NULL,
    instruction         TEXT NOT NULL,
    expected_outcome    TEXT,
    status              incident_step_status NOT NULL DEFAULT 'pending',
    user_note           TEXT,
    completed_by        TEXT,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (incident_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_incident_steps_incident ON incident_steps(incident_id, step_order);
CREATE INDEX IF NOT EXISTS idx_incident_steps_status   ON incident_steps(incident_id, status);

-- ============================================================
-- RPC: match_knowledge (retrieval)
-- ============================================================
CREATE OR REPLACE FUNCTION match_knowledge(
    query_embedding   vector(1536),
    match_threshold   FLOAT DEFAULT 0.7,
    match_count       INT DEFAULT 8,
    filter_equipment  TEXT[] DEFAULT NULL,
    filter_error_codes TEXT[] DEFAULT NULL,
    filter_station_id UUID DEFAULT NULL
)
RETURNS TABLE (
    chunk_id       UUID,
    document_id    UUID,
    document_title TEXT,
    source_type    kb_source_type,
    content        TEXT,
    similarity     FLOAT,
    metadata       JSONB,
    is_global      BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id            AS chunk_id,
        kd.id            AS document_id,
        kd.title         AS document_title,
        kd.source_type   AS source_type,
        kc.content       AS content,
        1 - (kc.embedding <=> query_embedding) AS similarity,
        kc.metadata      AS metadata,
        (kd.tenant_owner_email IS NULL) AS is_global
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kd.id = kc.document_id
    WHERE kd.is_active
      AND (filter_equipment IS NULL OR kd.equipment && filter_equipment)
      AND (filter_error_codes IS NULL OR kd.error_codes && filter_error_codes)
      AND (1 - (kc.embedding <=> query_embedding)) >= match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE knowledge_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_diagnoses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_steps        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'knowledge_documents','knowledge_chunks',
              'ai_conversations','ai_messages',
              'incidents','incident_diagnoses','incident_steps'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- knowledge_documents
CREATE POLICY "Superadmin full access" ON knowledge_documents
    FOR ALL USING (is_superadmin());
CREATE POLICY "Owner reads global + own" ON knowledge_documents
    FOR SELECT USING (
        tenant_owner_email IS NULL
        OR tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    );
CREATE POLICY "Owner writes own" ON knowledge_documents
    FOR INSERT WITH CHECK (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    );
CREATE POLICY "Owner updates own" ON knowledge_documents
    FOR UPDATE USING (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    ) WITH CHECK (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    );
CREATE POLICY "Owner deletes own" ON knowledge_documents
    FOR DELETE USING (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    );

-- knowledge_chunks
CREATE POLICY "Superadmin full access" ON knowledge_chunks
    FOR ALL USING (is_superadmin());
CREATE POLICY "Owner reads global + own" ON knowledge_chunks
    FOR SELECT USING (
        tenant_owner_email IS NULL
        OR tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    );
CREATE POLICY "Owner writes own" ON knowledge_chunks
    FOR INSERT WITH CHECK (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    );
CREATE POLICY "Owner updates own" ON knowledge_chunks
    FOR UPDATE USING (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    ) WITH CHECK (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    );
CREATE POLICY "Owner deletes own" ON knowledge_chunks
    FOR DELETE USING (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    );

-- ai_conversations
CREATE POLICY "Superadmin full access" ON ai_conversations
    FOR ALL USING (is_superadmin());
CREATE POLICY "Owner access" ON ai_conversations
    FOR ALL USING (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    ) WITH CHECK (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
        AND (station_id IS NULL OR station_id IN (SELECT my_station_ids()))
    );

-- ai_messages
CREATE POLICY "Superadmin full access" ON ai_messages
    FOR ALL USING (is_superadmin());
CREATE POLICY "Owner access" ON ai_messages
    FOR ALL USING (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    ) WITH CHECK (
        tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    );

-- incidents
CREATE POLICY "Superadmin full access" ON incidents
    FOR ALL USING (is_superadmin());
CREATE POLICY "Owner access" ON incidents
    FOR ALL USING (
        station_id IN (SELECT my_station_ids())
    ) WITH CHECK (
        station_id IN (SELECT my_station_ids())
        AND tenant_owner_email = LOWER(auth.jwt() ->> 'email')
    );

-- incident_diagnoses
CREATE POLICY "Superadmin full access" ON incident_diagnoses
    FOR ALL USING (is_superadmin());
CREATE POLICY "Owner access" ON incident_diagnoses
    FOR ALL USING (
        incident_id IN (
            SELECT id FROM incidents WHERE station_id IN (SELECT my_station_ids())
        )
    );

-- incident_steps
CREATE POLICY "Superadmin full access" ON incident_steps
    FOR ALL USING (is_superadmin());
CREATE POLICY "Owner access" ON incident_steps
    FOR ALL USING (
        incident_id IN (
            SELECT id FROM incidents WHERE station_id IN (SELECT my_station_ids())
        )
    );

-- ============================================================
-- Helper view (future-proofing hacia tabla tenants)
-- ============================================================
CREATE OR REPLACE VIEW tenant_owners AS
SELECT DISTINCT LOWER(owner_email) AS tenant_owner_email
FROM stations;

COMMENT ON VIEW tenant_owners IS
'Derived tenant list. Placeholder hasta introducir una tabla tenants explicita.';

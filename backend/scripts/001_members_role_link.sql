-- backend/scripts/001_members_role_link.sql

-- 1) colonnes
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS role varchar(16) NOT NULL DEFAULT 'main';

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS main_player_id bigint NULL;

-- 2) FK (self)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_main_player_id_fkey'
  ) THEN
    ALTER TABLE members
      ADD CONSTRAINT members_main_player_id_fkey
      FOREIGN KEY (main_player_id) REFERENCES members(player_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) check role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_members_role') THEN
    ALTER TABLE members
      ADD CONSTRAINT ck_members_role CHECK (role IN ('main','secondary','mule'));
  END IF;
END $$;

-- 4) check lien obligatoire si secondary/mule
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_members_main_link') THEN
    ALTER TABLE members
      ADD CONSTRAINT ck_members_main_link
      CHECK (
        (role = 'main' AND main_player_id IS NULL)
        OR
        (role IN ('secondary','mule') AND main_player_id IS NOT NULL)
      );
  END IF;
END $$;

-- 5) index utile
CREATE INDEX IF NOT EXISTS idx_members_family_role ON members(family, role);
CREATE INDEX IF NOT EXISTS idx_members_family_main_player_id ON members(family, main_player_id);
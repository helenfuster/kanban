-- ====================================================================
-- SCRIPT SQL DEFINITIVO E COMPLETO - WORKSPACE HELEN (KANBAN)
-- Copie TODO este código, cole no SQL Editor do Supabase e clique em RUN
-- ====================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE PERFIS (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  member_id TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE QUADROS (boards)
CREATE TABLE IF NOT EXISTS public.boards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE MEMBROS (members)
CREATE TABLE IF NOT EXISTS public.members (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES public.boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  avatar_color TEXT DEFAULT 'bg-sky-600',
  avatar_url TEXT,
  position INTEGER DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE ETIQUETAS (labels)
CREATE TABLE IF NOT EXISTS public.labels (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES public.boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE COLUNAS (columns)
CREATE TABLE IF NOT EXISTS public.columns (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_done_column BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE CARTÕES (cards)
CREATE TABLE IF NOT EXISTS public.cards (
  id TEXT PRIMARY KEY,
  column_id TEXT REFERENCES public.columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  checklists JSONB DEFAULT '[]'::jsonb,
  completed BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. RELAÇÃO CARTÃO <-> ETIQUETA (card_labels)
CREATE TABLE IF NOT EXISTS public.card_labels (
  card_id TEXT REFERENCES public.cards(id) ON DELETE CASCADE,
  label_id TEXT REFERENCES public.labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);

-- 9. RELAÇÃO CARTÃO <-> MEMBRO (card_members)
CREATE TABLE IF NOT EXISTS public.card_members (
  card_id TEXT REFERENCES public.cards(id) ON DELETE CASCADE,
  member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, member_id)
);

-- 10. TABELA DE COMENTÁRIOS (comments)
CREATE TABLE IF NOT EXISTS public.comments (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES public.cards(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 11. TABELA DE ANEXOS (attachments)
CREATE TABLE IF NOT EXISTS public.attachments (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES public.cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT DEFAULT 0,
  kind TEXT DEFAULT 'file',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. TABELA DE NOTAS (notes)
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',
  kind TEXT DEFAULT 'note',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. TABELA DE TAREFAS DIÁRIAS (daily_entries)
CREATE TABLE IF NOT EXISTS public.daily_entries (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES public.boards(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  status TEXT DEFAULT 'todo',
  campaign TEXT DEFAULT '',
  todos JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- 14. CRIAR BUCKETS DE STORAGE (AVATARS E CARD-ATTACHMENTS)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('card-attachments', 'card-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- POLÍTICAS DE PERMISSÃO PARA OS BUCKETS DE STORAGE
DROP POLICY IF EXISTS "Acesso total avatars" ON storage.objects;
DROP POLICY IF EXISTS "Acesso total card-attachments" ON storage.objects;

CREATE POLICY "Acesso total avatars" ON storage.objects
  FOR ALL USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Acesso total card-attachments" ON storage.objects
  FOR ALL USING (bucket_id = 'card-attachments')
  WITH CHECK (bucket_id = 'card-attachments');

-- ====================================================================
-- 15. FUNÇÃO RPC PARA CARREGAR O SNAPSHOT DO QUADRO (get_board_snapshot)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.get_board_snapshot(p_board_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_board JSONB;
  v_members JSONB;
  v_labels JSONB;
  v_columns JSONB;
  v_cards JSONB;
  v_card_labels JSONB;
  v_card_members JSONB;
  v_comments JSONB;
  v_attachments JSONB;
BEGIN
  -- Board
  SELECT to_jsonb(b) INTO v_board
  FROM (SELECT title FROM public.boards WHERE id = p_board_id) b;

  -- Members
  SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO v_members
  FROM public.members m WHERE m.board_id = p_board_id;

  -- Labels
  SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) INTO v_labels
  FROM public.labels l WHERE l.board_id = p_board_id;

  -- Columns
  SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO v_columns
  FROM (SELECT * FROM public.columns WHERE board_id = p_board_id ORDER BY position ASC) c;

  -- Cards
  SELECT COALESCE(jsonb_agg(to_jsonb(cd)), '[]'::jsonb) INTO v_cards
  FROM public.cards cd
  WHERE cd.column_id IN (SELECT id FROM public.columns WHERE board_id = p_board_id);

  -- Card Labels
  SELECT COALESCE(jsonb_agg(to_jsonb(cl)), '[]'::jsonb) INTO v_card_labels
  FROM public.card_labels cl
  WHERE cl.card_id IN (SELECT id FROM public.cards WHERE column_id IN (SELECT id FROM public.columns WHERE board_id = p_board_id));

  -- Card Members
  SELECT COALESCE(jsonb_agg(to_jsonb(cm)), '[]'::jsonb) INTO v_card_members
  FROM public.card_members cm
  WHERE cm.card_id IN (SELECT id FROM public.cards WHERE column_id IN (SELECT id FROM public.columns WHERE board_id = p_board_id));

  -- Comments
  SELECT COALESCE(jsonb_agg(to_jsonb(cmt)), '[]'::jsonb) INTO v_comments
  FROM public.comments cmt
  WHERE cmt.card_id IN (SELECT id FROM public.cards WHERE column_id IN (SELECT id FROM public.columns WHERE board_id = p_board_id));

  -- Attachments
  SELECT COALESCE(jsonb_agg(to_jsonb(att)), '[]'::jsonb) INTO v_attachments
  FROM public.attachments att
  WHERE att.card_id IN (SELECT id FROM public.cards WHERE column_id IN (SELECT id FROM public.columns WHERE board_id = p_board_id));

  RETURN jsonb_build_object(
    'board', v_board,
    'members', v_members,
    'labels', v_labels,
    'columns', v_columns,
    'cards', v_cards,
    'card_labels', v_card_labels,
    'card_members', v_card_members,
    'comments', v_comments,
    'attachments', v_attachments
  );
END;
$$;

-- ====================================================================
-- 16. TRIGGER PARA CRIAR PERFIL AUTOMÁTICO AO REGISTRAR USUÁRIO
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 17. PERMISSÕES E RLS DAS TABELAS (DESABILITADO PARA USO DIRETO)
-- ====================================================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_labels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_entries DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 18. PUBLICAÇÃO PARA SINCRO EM TEMPO REAL (REALTIME)
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.cards, public.columns, public.members, public.comments, 
  public.attachments, public.labels, public.card_labels, 
  public.card_members, public.notes, public.daily_entries;

-- ====================================================================
-- 19. ESTRUTURA E DADOS INICIAIS DO QUADRO (WORKSPACE HELEN)
-- ====================================================================
INSERT INTO public.boards (id, title)
VALUES ('board-1', 'WORKSPACE HELEN')
ON CONFLICT (id) DO UPDATE SET title = 'WORKSPACE HELEN';

INSERT INTO public.columns (id, board_id, title, position, is_done_column)
VALUES 
  ('backlog', 'board-1', 'A Fazer', 0, FALSE),
  ('in-progress', 'board-1', 'Em Andamento', 1, FALSE),
  ('done', 'board-1', 'Concluído', 2, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.labels (id, board_id, name, color)
VALUES
  ('l1', 'board-1', 'Urgente', 'red'),
  ('l2', 'board-1', 'Importante', 'yellow'),
  ('l3', 'board-1', 'Normal', 'blue')
ON CONFLICT (id) DO NOTHING;

-- Jodal public ranking, additive migration. Independent of every existing table.
-- Run as the database owner in Supabase SQL Editor. This does not add sample players.
-- Scores are reconstructed from the published game rules; client scores are ignored.
-- Guest credentials are a private UUID plus a 256-bit random secret, never published.
BEGIN;

CREATE TABLE IF NOT EXISTS public.jp_rank_profiles (
  player_id uuid PRIMARY KEY,
  profile_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  secret_hash text NOT NULL CHECK (secret_hash ~ '^[0-9a-f]{64}$'),
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 20),
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.jp_rank_rules (
  mode text NOT NULL,
  revision text NOT NULL,
  rules jsonb NOT NULL,
  PRIMARY KEY(mode,revision)
);
CREATE TABLE IF NOT EXISTS public.jp_rank_records (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.jp_rank_profiles(player_id),
  mode text NOT NULL CHECK (mode IN ('supplier','manager','combo','combo-free','mission','match')),
  revision text NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 1000),
  normalized integer NOT NULL CHECK (normalized BETWEEN 0 AND 1000),
  ending_id text,
  ending_title text,
  payload jsonb NOT NULL CHECK (octet_length(payload::text) <= 40000),
  created_at timestamptz NOT NULL DEFAULT now(),
  play_day date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date),
  FOREIGN KEY(mode,revision) REFERENCES public.jp_rank_rules(mode,revision)
);
CREATE INDEX IF NOT EXISTS jp_rank_records_player_day ON public.jp_rank_records(player_id,play_day);
CREATE INDEX IF NOT EXISTS jp_rank_records_created_mode ON public.jp_rank_records(created_at,mode);
ALTER TABLE public.jp_rank_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jp_rank_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jp_rank_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jp_rank_profiles, public.jp_rank_rules, public.jp_rank_records FROM PUBLIC, anon, authenticated;

-- BEGIN GENERATED RANKING RULES
INSERT INTO public.jp_rank_rules(mode, revision, rules)
VALUES ('supplier', '20260916-1', '{"start":"s_start","nodes":{"s_start":{"choices":{"team":{"next":"s_workshop","delta":{"money":0,"trust":3,"quality":5,"time":-4},"setFlags":["team_first"]},"notice":{"next":"s_notice","delta":{"money":0,"trust":0,"quality":2,"time":2},"setFlags":[]}}},"s_workshop":{"choices":{"capacity":{"next":"s_notice","delta":{"money":-3,"trust":4,"quality":7,"time":-3},"setFlags":["capacity_map"]},"stock":{"next":"s_gap","delta":{"money":0,"trust":3,"quality":2,"time":-1},"setFlags":["gap_found"]}}},"s_notice":{"choices":{"separate":{"next":"s_query","delta":{"money":0,"trust":4,"quality":4,"time":-3},"setFlags":["eligibility_checked"]},"gaps":{"next":"s_gap","delta":{"money":1,"trust":2,"quality":1,"time":-1},"setFlags":["gap_found"]}}},"s_gap":{"choices":{"ask":{"next":"s_query","delta":{"money":-1,"trust":4,"quality":3,"time":-3},"setFlags":["eligibility_checked"]},"hold":{"next":"s_end_hold","delta":{"money":6,"trust":4,"quality":2,"time":5},"setFlags":["honest_pause"]}}},"s_query":{"choices":{"official":{"next":"s_reply","delta":{"money":0,"trust":5,"quality":3,"time":-3},"setFlags":["written_query"]},"prototype":{"next":"s_demo","delta":{"money":-4,"trust":3,"quality":5,"time":-1},"setFlags":["written_query","parallel_test"]}}},"s_reply":{"choices":{"test":{"next":"s_demo","delta":{"money":-3,"trust":3,"quality":5,"time":-3},"setFlags":["spec_confirmed"]},"quote":{"next":"s_cost","delta":{"money":2,"trust":2,"quality":2,"time":1},"setFlags":["spec_confirmed"]}}},"s_demo":{"choices":{"organize":{"next":"s_cost","delta":{"money":-5,"trust":4,"quality":9,"time":-4},"setFlags":["spec_confirmed","prototype_tested"]},"pause":{"next":"s_end_hold","delta":{"money":4,"trust":5,"quality":3,"time":3},"setFlags":["honest_pause"]}}},"s_cost":{"choices":{"full_cost":{"next":"s_bid","delta":{"money":4,"trust":3,"quality":4,"time":-3},"setFlags":["full_costed"]},"decline":{"next":"s_end_hold","delta":{"money":7,"trust":2,"quality":2,"time":4},"setFlags":["honest_pause"]}}},"s_bid":{"choices":{"evidence":{"next":"s_result","delta":{"money":0,"trust":5,"quality":4,"time":-4},"setFlags":["bid_checked"]},"price_only":{"next":"s_loss_review","delta":{"money":1,"trust":-3,"quality":-5,"time":2},"setFlags":["lost_bid"]}}},"s_result":{"choices":{"read":{"next":"s_contract","delta":{"money":0,"trust":4,"quality":3,"time":-2},"setFlags":[]},"clarify":{"next":"s_terms","delta":{"money":1,"trust":3,"quality":2,"time":-3},"setFlags":[]}}},"s_loss_review":{"choices":{"learn":{"next":"s_end_loss","delta":{"money":2,"trust":4,"quality":5,"time":2},"setFlags":["loss_reviewed"]},"refocus":{"next":"s_end_hold","delta":{"money":4,"trust":2,"quality":4,"time":3},"setFlags":["honest_pause"]}}},"s_contract":{"choices":{"confirm":{"next":"s_production","delta":{"money":0,"trust":5,"quality":4,"time":-3},"setFlags":["contract_confirmed","terms_checked"]},"terms":{"next":"s_terms","delta":{"money":1,"trust":3,"quality":3,"time":-3},"setFlags":[]}}},"s_terms":{"choices":{"matrix":{"next":"s_production","delta":{"money":0,"trust":6,"quality":5,"time":-3},"setFlags":["contract_confirmed","terms_checked"]},"briefing":{"next":"s_production","delta":{"money":-2,"trust":5,"quality":4,"time":-4},"setFlags":["contract_confirmed","terms_checked","team_briefed"]}}},"s_production":{"choices":{"reserve":{"next":"s_delivery","delta":{"money":-9,"trust":3,"quality":7,"time":-2},"setFlags":["batch_checked"]},"lean":{"next":"s_shortage","delta":{"money":6,"trust":0,"quality":1,"time":2},"setFlags":["lean_stock"]}}},"s_shortage":{"choices":{"document":{"next":"s_change","delta":{"money":-2,"trust":5,"quality":3,"time":-4},"setFlags":["change_disclosed"]},"shortcut":{"next":"s_unapproved","delta":{"money":3,"trust":-5,"quality":-7,"time":3},"setFlags":["unapproved_attempt"]}}},"s_change":{"choices":{"approved":{"next":"s_delivery","delta":{"money":-4,"trust":6,"quality":6,"time":-3},"setFlags":["approved_change","batch_checked"]},"original":{"next":"s_inspection","delta":{"money":-11,"trust":4,"quality":6,"time":-3},"setFlags":["original_parts","batch_checked","delivery_manifest"]}}},"s_unapproved":{"choices":{"stop":{"next":"s_change","delta":{"money":-3,"trust":4,"quality":4,"time":-5},"setFlags":["change_disclosed","recovered_early"]},"send":{"next":"s_delivery","delta":{"money":1,"trust":-9,"quality":-9,"time":2},"setFlags":["unapproved_delivery"]}}},"s_delivery":{"choices":{"manifest":{"next":"s_inspection","delta":{"money":-2,"trust":4,"quality":5,"time":-3},"setFlags":["delivery_manifest"]},"arrival":{"next":"s_repair","delta":{"money":2,"trust":-2,"quality":-3,"time":-4},"setFlags":["onsite_rework"]},"tested_pack":{"next":"s_payment","delta":{"money":-1,"trust":5,"quality":6,"time":1},"requires":{"allFlags":["prototype_tested"],"noFlags":["unapproved_delivery"],"min":{"quality":60}},"setFlags":["delivery_manifest","inspection_complete"]}}},"s_inspection":{"choices":{"matched":{"next":"s_payment","delta":{"money":0,"trust":6,"quality":4,"time":1},"requires":{"noFlags":["unapproved_delivery"],"min":{"quality":60}},"setFlags":["inspection_complete"]},"resolve":{"next":"s_repair","delta":{"money":-4,"trust":2,"quality":1,"time":-4},"setFlags":["inspection_issue"]}}},"s_repair":{"choices":{"fix":{"next":"s_payment","delta":{"money":-7,"trust":6,"quality":11,"time":-5},"setFlags":["inspection_complete","repaired"]},"joint":{"next":"s_docs","delta":{"money":-6,"trust":7,"quality":9,"time":-6},"setFlags":["inspection_complete","repaired","joint_check"]}}},"s_payment":{"choices":{"claim":{"next":"s_support","delta":{"money":16,"trust":4,"quality":1,"time":-2},"setFlags":["paid"]},"wait":{"next":"s_docs","delta":{"money":-3,"trust":-2,"quality":0,"time":-4},"setFlags":["claim_missed"]}}},"s_docs":{"choices":{"complete":{"next":"s_support","delta":{"money":14,"trust":3,"quality":2,"time":-3},"setFlags":["paid"]},"teach":{"next":"s_support","delta":{"money":12,"trust":5,"quality":4,"time":-4},"setFlags":["paid","team_briefed"]}}},"s_support":{"choices":{"diagnose":{"next":"s_recall","delta":{"money":-2,"trust":5,"quality":3,"time":-3},"setFlags":["support_logged"]},"onsite":{"next":"s_handover","delta":{"money":-5,"trust":6,"quality":4,"time":-5},"setFlags":["support_logged","onsite_support"]}}},"s_recall":{"choices":{"prevent":{"next":"s_handover","delta":{"money":-6,"trust":7,"quality":8,"time":-4},"setFlags":["support_resolved","prevented_repeat"]},"close_case":{"next":"s_closure","delta":{"money":-3,"trust":4,"quality":4,"time":-2},"setFlags":["support_resolved"]}}},"s_handover":{"choices":{"guide":{"next":"s_closure","delta":{"money":-2,"trust":7,"quality":6,"time":-3},"setFlags":["handover_complete"]},"repeatable":{"next":"s_next","delta":{"money":-3,"trust":5,"quality":7,"time":-4},"requires":{"allFlags":["team_briefed"]},"setFlags":["handover_complete","playbook_ready"]},"debrief":{"next":"s_next","delta":{"money":-4,"trust":4,"quality":5,"time":-6},"requires":{"noFlags":["team_briefed"]},"setFlags":["handover_complete","playbook_ready","team_briefed"]}}},"s_closure":{"choices":{"trusted":{"next":"s_end_trusted","delta":{"money":0,"trust":3,"quality":2,"time":0},"requires":{"allFlags":["handover_complete"],"min":{"trust":70,"quality":70}},"setFlags":[]},"recovered":{"next":"s_end_recovered","delta":{"money":0,"trust":4,"quality":3,"time":0},"setFlags":[]}}},"s_next":{"choices":{"grow":{"next":"s_end_growth","delta":{"money":2,"trust":4,"quality":4,"time":2},"requires":{"allFlags":["playbook_ready"]},"setFlags":[]},"rest":{"next":"s_end_recovered","delta":{"money":4,"trust":3,"quality":3,"time":4},"setFlags":[]}}},"s_end_trusted":{"choices":{},"ending":{"id":"supplier_trusted","title":"신뢰로 완주한 사장님"}},"s_end_recovered":{"choices":{},"ending":{"id":"supplier_recovered","title":"경험을 남긴 완주"}},"s_end_loss":{"choices":{},"ending":{"id":"supplier_loss","title":"다음 도전의 설계자"}},"s_end_hold":{"choices":{},"ending":{"id":"supplier_hold","title":"준비를 선택한 사장님"}},"s_end_growth":{"choices":{},"ending":{"id":"supplier_growth","title":"두 번째 도전을 여는 회사"}}}}'::jsonb),
('manager', '20260916-1', '{"start":"m_start","nodes":{"m_start":{"choices":{"visit":{"next":"m_classroom","delta":{"time":-3,"trust":3},"setFlags":["field_visit"]},"desk":{"next":"m_desk","delta":{"time":3},"setFlags":["desk_start"]}}},"m_classroom":{"choices":{"observe":{"next":"m_budget","delta":{"time":-3,"quality":10,"trust":6},"setFlags":["field_notes"]},"workshop":{"next":"m_budget","delta":{"time":-3,"quality":6,"trust":5},"setFlags":["field_notes","teacher_partner"]}}},"m_desk":{"choices":{"check":{"next":"m_classroom","delta":{"time":-2,"quality":3},"setFlags":["draft_checked"]},"copy":{"next":"m_budget","delta":{"time":5,"quality":-7},"setFlags":["legacy_assumption"]}}},"m_budget":{"choices":{"whole":{"next":"m_spec","delta":{"money":-4,"time":-2,"quality":8},"setFlags":["budget_ready"]},"unit":{"next":"m_spec","delta":{"money":7,"time":3,"quality":-6},"setFlags":["budget_gap"]}}},"m_spec":{"choices":{"function":{"next":"m_notice","delta":{"time":-3,"quality":8,"trust":4},"setFlags":["clear_spec"]},"brand":{"next":"m_challenge","delta":{"time":4,"trust":-7},"setFlags":["narrow_spec"]}}},"m_notice":{"choices":{"crosscheck":{"next":"m_clarify","delta":{"time":-3,"trust":7,"quality":4},"setFlags":["notice_checked"]},"rush":{"next":"m_challenge","delta":{"time":4,"trust":-6},"setFlags":["notice_gap"]}}},"m_challenge":{"choices":{"repair":{"next":"m_clarify","delta":{"time":-8,"trust":8,"quality":7},"setFlags":["notice_repaired","clear_spec","notice_checked"]},"dismiss":{"next":"m_pressure","delta":{"time":3,"trust":-9},"setFlags":["unresolved_notice"]}}},"m_clarify":{"choices":{"public":{"next":"m_select","delta":{"time":-3,"trust":8},"setFlags":["transparent_answers"]},"private":{"next":"m_pressure","delta":{"time":3,"trust":-10},"setFlags":["private_hint"]}}},"m_select":{"choices":{"criteria":{"next":"m_award","delta":{"time":-3,"trust":7,"quality":5},"setFlags":["selection_checked"]},"cheap":{"next":"m_pressure","delta":{"time":3,"quality":-6},"setFlags":["price_only"]}}},"m_pressure":{"choices":{"record":{"next":"m_award","delta":{"time":-8,"trust":9,"quality":7},"setFlags":["selection_checked","transparent_answers","selection_recovered"]},"announce":{"next":"m_award","delta":{"time":4,"trust":-12,"quality":-7},"setFlags":["premature_award"]}}},"m_award":{"choices":{"handover":{"next":"m_contract","delta":{"time":-3,"trust":6,"quality":4},"setFlags":["selection_documented"]},"result":{"next":"m_contract","delta":{"time":2,"trust":-4},"setFlags":["thin_handover"]}}},"m_contract":{"choices":{"write":{"next":"m_handoff","delta":{"time":-3,"trust":7,"quality":7},"setFlags":["contract_clear"]},"verbal":{"next":"m_rushed","delta":{"time":5,"trust":-7,"quality":-6},"setFlags":["verbal_order"]}}},"m_handoff":{"choices":{"rehearsal":{"next":"m_workshop","delta":{"time":-2,"quality":8,"trust":5},"setFlags":["handoff_ready"]},"deliveryonly":{"next":"m_workshop","delta":{"time":4,"quality":-5},"setFlags":["handoff_gap"]}}},"m_workshop":{"choices":{"scope":{"next":"m_change","delta":{"time":-2,"quality":5,"trust":4},"setFlags":["change_assessed"]},"extra":{"next":"m_rushed","delta":{"time":2,"trust":-9},"setFlags":["free_extra"]}}},"m_change":{"choices":{"agree":{"next":"m_delivery","delta":{"money":-5,"time":-4,"quality":9,"trust":6},"setFlags":["change_clear"]},"original":{"next":"m_delivery","delta":{"money":3,"quality":3,"trust":4},"setFlags":["original_scope_kept"]},"insist":{"next":"m_rushed","delta":{"trust":-10,"quality":-5},"setFlags":["free_extra"]}}},"m_rushed":{"choices":{"reset":{"next":"m_delivery","delta":{"time":-9,"money":-4,"quality":9,"trust":10},"setFlags":["contract_clear","change_recovered"]},"push":{"next":"m_delivery","delta":{"time":4,"trust":-8,"quality":-9},"setFlags":["unresolved_delivery"]}}},"m_delivery":{"choices":{"trace":{"next":"m_inspect","delta":{"time":-3,"quality":7,"trust":4},"setFlags":["delivery_checked"]},"boxes":{"next":"m_inspect","delta":{"time":4,"quality":-6},"setFlags":["delivery_unchecked"]}}},"m_inspect":{"choices":{"confirm":{"next":"m_payment","delta":{"time":-3,"quality":6,"trust":6},"requires":{"allFlags":["delivery_checked"],"min":{"quality":55}},"setFlags":["inspected"]},"diagnose":{"next":"m_repair","delta":{"time":-5,"trust":4},"setFlags":["inspection_started"]},"skip":{"next":"m_payment","delta":{"time":5,"quality":-14,"trust":-14},"setFlags":["unchecked_acceptance"]}}},"m_repair":{"choices":{"fix":{"next":"m_reinspect","delta":{"money":-5,"time":-7,"quality":12,"trust":6},"setFlags":["repair_documented"]},"defer":{"next":"m_recover","delta":{"trust":6,"time":3},"setFlags":["deferred"]}}},"m_reinspect":{"choices":{"verify":{"next":"m_payment","delta":{"time":-4,"quality":5,"trust":7},"requires":{"allFlags":["repair_documented"],"min":{"quality":45}},"setFlags":["inspected"]},"hold":{"next":"m_recover","delta":{"time":-3,"trust":5},"setFlags":["deferred"]}}},"m_payment":{"choices":{"process":{"next":"m_closing","delta":{"time":-2,"trust":8},"requires":{"allFlags":["inspected"]},"setFlags":["payment_checked"]},"resolve":{"next":"m_recover","delta":{"time":-5,"trust":4},"setFlags":["payment_issue_recorded"]},"later":{"next":"m_closing","delta":{"time":3,"trust":-14},"setFlags":["payment_delayed"]}}},"m_recover":{"choices":{"accountable":{"next":"m_closing","delta":{"trust":8,"time":-3,"quality":3},"setFlags":["deferred","recovery_plan"]},"minimize":{"next":"m_closing","delta":{"trust":-6,"time":2},"setFlags":["quiet_recovery"]}}},"m_closing":{"choices":{"open":{"next":"m_community","delta":{"trust":5,"quality":3},"requires":{"allFlags":["inspected","payment_checked"]},"setFlags":["service_opened"]},"disclose":{"next":"m_community","delta":{"trust":6},"setFlags":["status_disclosed"]},"promote":{"next":"m_community","delta":{"trust":-12,"quality":-3},"setFlags":["premature_promotion"]}}},"m_community":{"choices":{"debrief":{"next":"m_debrief","delta":{},"requires":{"allFlags":["inspected","payment_checked"],"min":{"quality":40}},"setFlags":["debrief_opened"]},"responsible":{"next":"m_end_responsible","delta":{"trust":3},"requires":{"allFlags":["deferred","status_disclosed"]},"setFlags":["responsible_followup"]},"rebuild":{"next":"m_end_rebuild","delta":{},"setFlags":["rebuild_plan"]}}},"m_debrief":{"choices":{"share":{"next":"m_end_master","delta":{"trust":3},"requires":{"allFlags":["inspected","payment_checked","field_notes","handoff_ready","transparent_answers"],"min":{"trust":70,"quality":75}},"setFlags":["shared_playbook"]},"partners":{"next":"m_end_partner","delta":{"trust":3},"requires":{"allFlags":["inspected","payment_checked","handoff_ready"],"min":{"trust":50,"quality":55}},"setFlags":["aftercare_team"]},"finish":{"next":"m_end_finish","delta":{},"setFlags":["closed_record"]}}},"m_end_master":{"choices":{},"ending":{"id":"master","title":"모두의 교실을 만든 설계자"}},"m_end_partner":{"choices":{},"ending":{"id":"partner","title":"다음 수업까지 이어진 동료"}},"m_end_finish":{"choices":{},"ending":{"id":"finish","title":"첫 계약을 완주한 담당자"}},"m_end_responsible":{"choices":{},"ending":{"id":"responsible","title":"문을 늦추더라도 지킨 약속"}},"m_end_rebuild":{"choices":{},"ending":{"id":"rebuild","title":"다시 펼친 계약 지도"}}}}'::jsonb),
('combo', 'jodal-independent-20260916', '{"atoms":["JP-20260916-A01","JP-20260916-A02","JP-20260916-A03","JP-20260916-A04","JP-20260916-A05","JP-20260916-A06"],"questions":{"JP-20260916-Q01":{"atom":"JP-20260916-A01","answer":2,"options":4},"JP-20260916-Q02":{"atom":"JP-20260916-A01","answer":0,"options":4},"JP-20260916-Q03":{"atom":"JP-20260916-A02","answer":1,"options":4},"JP-20260916-Q04":{"atom":"JP-20260916-A02","answer":3,"options":4},"JP-20260916-Q05":{"atom":"JP-20260916-A03","answer":0,"options":4},"JP-20260916-Q06":{"atom":"JP-20260916-A03","answer":2,"options":4},"JP-20260916-Q07":{"atom":"JP-20260916-A04","answer":1,"options":4},"JP-20260916-Q08":{"atom":"JP-20260916-A04","answer":3,"options":4},"JP-20260916-Q09":{"atom":"JP-20260916-A05","answer":0,"options":4},"JP-20260916-Q10":{"atom":"JP-20260916-A05","answer":2,"options":4},"JP-20260916-Q11":{"atom":"JP-20260916-A06","answer":1,"options":4},"JP-20260916-Q12":{"atom":"JP-20260916-A06","answer":3,"options":4}}}'::jsonb),
('combo-free', 'jodal-independent-20260916', '{"atoms":["JP-20260916-A01","JP-20260916-A02","JP-20260916-A03","JP-20260916-A04","JP-20260916-A05","JP-20260916-A06"],"questions":{"JP-20260916-Q01":{"atom":"JP-20260916-A01","answer":2,"options":4},"JP-20260916-Q02":{"atom":"JP-20260916-A01","answer":0,"options":4},"JP-20260916-Q03":{"atom":"JP-20260916-A02","answer":1,"options":4},"JP-20260916-Q04":{"atom":"JP-20260916-A02","answer":3,"options":4},"JP-20260916-Q05":{"atom":"JP-20260916-A03","answer":0,"options":4},"JP-20260916-Q06":{"atom":"JP-20260916-A03","answer":2,"options":4},"JP-20260916-Q07":{"atom":"JP-20260916-A04","answer":1,"options":4},"JP-20260916-Q08":{"atom":"JP-20260916-A04","answer":3,"options":4},"JP-20260916-Q09":{"atom":"JP-20260916-A05","answer":0,"options":4},"JP-20260916-Q10":{"atom":"JP-20260916-A05","answer":2,"options":4},"JP-20260916-Q11":{"atom":"JP-20260916-A06","answer":1,"options":4},"JP-20260916-Q12":{"atom":"JP-20260916-A06","answer":3,"options":4}}}'::jsonb),
('mission', 'jodal-independent-20260916', '{"atoms":["JP-20260916-A01","JP-20260916-A02","JP-20260916-A03","JP-20260916-A04","JP-20260916-A05","JP-20260916-A06"],"questions":{"JP-20260916-Q01":{"atom":"JP-20260916-A01","answer":2,"options":4},"JP-20260916-Q02":{"atom":"JP-20260916-A01","answer":0,"options":4},"JP-20260916-Q03":{"atom":"JP-20260916-A02","answer":1,"options":4},"JP-20260916-Q04":{"atom":"JP-20260916-A02","answer":3,"options":4},"JP-20260916-Q05":{"atom":"JP-20260916-A03","answer":0,"options":4},"JP-20260916-Q06":{"atom":"JP-20260916-A03","answer":2,"options":4},"JP-20260916-Q07":{"atom":"JP-20260916-A04","answer":1,"options":4},"JP-20260916-Q08":{"atom":"JP-20260916-A04","answer":3,"options":4},"JP-20260916-Q09":{"atom":"JP-20260916-A05","answer":0,"options":4},"JP-20260916-Q10":{"atom":"JP-20260916-A05","answer":2,"options":4},"JP-20260916-Q11":{"atom":"JP-20260916-A06","answer":1,"options":4},"JP-20260916-Q12":{"atom":"JP-20260916-A06","answer":3,"options":4}}}'::jsonb),
('match', 'jodal-independent-20260916', '{"atoms":["JP-20260916-A01","JP-20260916-A02","JP-20260916-A03","JP-20260916-A04","JP-20260916-A05","JP-20260916-A06"],"questions":{"JP-20260916-Q01":{"atom":"JP-20260916-A01","answer":2,"options":4},"JP-20260916-Q02":{"atom":"JP-20260916-A01","answer":0,"options":4},"JP-20260916-Q03":{"atom":"JP-20260916-A02","answer":1,"options":4},"JP-20260916-Q04":{"atom":"JP-20260916-A02","answer":3,"options":4},"JP-20260916-Q05":{"atom":"JP-20260916-A03","answer":0,"options":4},"JP-20260916-Q06":{"atom":"JP-20260916-A03","answer":2,"options":4},"JP-20260916-Q07":{"atom":"JP-20260916-A04","answer":1,"options":4},"JP-20260916-Q08":{"atom":"JP-20260916-A04","answer":3,"options":4},"JP-20260916-Q09":{"atom":"JP-20260916-A05","answer":0,"options":4},"JP-20260916-Q10":{"atom":"JP-20260916-A05","answer":2,"options":4},"JP-20260916-Q11":{"atom":"JP-20260916-A06","answer":1,"options":4},"JP-20260916-Q12":{"atom":"JP-20260916-A06","answer":3,"options":4}}}'::jsonb)
ON CONFLICT (mode, revision) DO NOTHING;
DO $verify_seed$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES ('supplier', '20260916-1', '{"start":"s_start","nodes":{"s_start":{"choices":{"team":{"next":"s_workshop","delta":{"money":0,"trust":3,"quality":5,"time":-4},"setFlags":["team_first"]},"notice":{"next":"s_notice","delta":{"money":0,"trust":0,"quality":2,"time":2},"setFlags":[]}}},"s_workshop":{"choices":{"capacity":{"next":"s_notice","delta":{"money":-3,"trust":4,"quality":7,"time":-3},"setFlags":["capacity_map"]},"stock":{"next":"s_gap","delta":{"money":0,"trust":3,"quality":2,"time":-1},"setFlags":["gap_found"]}}},"s_notice":{"choices":{"separate":{"next":"s_query","delta":{"money":0,"trust":4,"quality":4,"time":-3},"setFlags":["eligibility_checked"]},"gaps":{"next":"s_gap","delta":{"money":1,"trust":2,"quality":1,"time":-1},"setFlags":["gap_found"]}}},"s_gap":{"choices":{"ask":{"next":"s_query","delta":{"money":-1,"trust":4,"quality":3,"time":-3},"setFlags":["eligibility_checked"]},"hold":{"next":"s_end_hold","delta":{"money":6,"trust":4,"quality":2,"time":5},"setFlags":["honest_pause"]}}},"s_query":{"choices":{"official":{"next":"s_reply","delta":{"money":0,"trust":5,"quality":3,"time":-3},"setFlags":["written_query"]},"prototype":{"next":"s_demo","delta":{"money":-4,"trust":3,"quality":5,"time":-1},"setFlags":["written_query","parallel_test"]}}},"s_reply":{"choices":{"test":{"next":"s_demo","delta":{"money":-3,"trust":3,"quality":5,"time":-3},"setFlags":["spec_confirmed"]},"quote":{"next":"s_cost","delta":{"money":2,"trust":2,"quality":2,"time":1},"setFlags":["spec_confirmed"]}}},"s_demo":{"choices":{"organize":{"next":"s_cost","delta":{"money":-5,"trust":4,"quality":9,"time":-4},"setFlags":["spec_confirmed","prototype_tested"]},"pause":{"next":"s_end_hold","delta":{"money":4,"trust":5,"quality":3,"time":3},"setFlags":["honest_pause"]}}},"s_cost":{"choices":{"full_cost":{"next":"s_bid","delta":{"money":4,"trust":3,"quality":4,"time":-3},"setFlags":["full_costed"]},"decline":{"next":"s_end_hold","delta":{"money":7,"trust":2,"quality":2,"time":4},"setFlags":["honest_pause"]}}},"s_bid":{"choices":{"evidence":{"next":"s_result","delta":{"money":0,"trust":5,"quality":4,"time":-4},"setFlags":["bid_checked"]},"price_only":{"next":"s_loss_review","delta":{"money":1,"trust":-3,"quality":-5,"time":2},"setFlags":["lost_bid"]}}},"s_result":{"choices":{"read":{"next":"s_contract","delta":{"money":0,"trust":4,"quality":3,"time":-2},"setFlags":[]},"clarify":{"next":"s_terms","delta":{"money":1,"trust":3,"quality":2,"time":-3},"setFlags":[]}}},"s_loss_review":{"choices":{"learn":{"next":"s_end_loss","delta":{"money":2,"trust":4,"quality":5,"time":2},"setFlags":["loss_reviewed"]},"refocus":{"next":"s_end_hold","delta":{"money":4,"trust":2,"quality":4,"time":3},"setFlags":["honest_pause"]}}},"s_contract":{"choices":{"confirm":{"next":"s_production","delta":{"money":0,"trust":5,"quality":4,"time":-3},"setFlags":["contract_confirmed","terms_checked"]},"terms":{"next":"s_terms","delta":{"money":1,"trust":3,"quality":3,"time":-3},"setFlags":[]}}},"s_terms":{"choices":{"matrix":{"next":"s_production","delta":{"money":0,"trust":6,"quality":5,"time":-3},"setFlags":["contract_confirmed","terms_checked"]},"briefing":{"next":"s_production","delta":{"money":-2,"trust":5,"quality":4,"time":-4},"setFlags":["contract_confirmed","terms_checked","team_briefed"]}}},"s_production":{"choices":{"reserve":{"next":"s_delivery","delta":{"money":-9,"trust":3,"quality":7,"time":-2},"setFlags":["batch_checked"]},"lean":{"next":"s_shortage","delta":{"money":6,"trust":0,"quality":1,"time":2},"setFlags":["lean_stock"]}}},"s_shortage":{"choices":{"document":{"next":"s_change","delta":{"money":-2,"trust":5,"quality":3,"time":-4},"setFlags":["change_disclosed"]},"shortcut":{"next":"s_unapproved","delta":{"money":3,"trust":-5,"quality":-7,"time":3},"setFlags":["unapproved_attempt"]}}},"s_change":{"choices":{"approved":{"next":"s_delivery","delta":{"money":-4,"trust":6,"quality":6,"time":-3},"setFlags":["approved_change","batch_checked"]},"original":{"next":"s_inspection","delta":{"money":-11,"trust":4,"quality":6,"time":-3},"setFlags":["original_parts","batch_checked","delivery_manifest"]}}},"s_unapproved":{"choices":{"stop":{"next":"s_change","delta":{"money":-3,"trust":4,"quality":4,"time":-5},"setFlags":["change_disclosed","recovered_early"]},"send":{"next":"s_delivery","delta":{"money":1,"trust":-9,"quality":-9,"time":2},"setFlags":["unapproved_delivery"]}}},"s_delivery":{"choices":{"manifest":{"next":"s_inspection","delta":{"money":-2,"trust":4,"quality":5,"time":-3},"setFlags":["delivery_manifest"]},"arrival":{"next":"s_repair","delta":{"money":2,"trust":-2,"quality":-3,"time":-4},"setFlags":["onsite_rework"]},"tested_pack":{"next":"s_payment","delta":{"money":-1,"trust":5,"quality":6,"time":1},"requires":{"allFlags":["prototype_tested"],"noFlags":["unapproved_delivery"],"min":{"quality":60}},"setFlags":["delivery_manifest","inspection_complete"]}}},"s_inspection":{"choices":{"matched":{"next":"s_payment","delta":{"money":0,"trust":6,"quality":4,"time":1},"requires":{"noFlags":["unapproved_delivery"],"min":{"quality":60}},"setFlags":["inspection_complete"]},"resolve":{"next":"s_repair","delta":{"money":-4,"trust":2,"quality":1,"time":-4},"setFlags":["inspection_issue"]}}},"s_repair":{"choices":{"fix":{"next":"s_payment","delta":{"money":-7,"trust":6,"quality":11,"time":-5},"setFlags":["inspection_complete","repaired"]},"joint":{"next":"s_docs","delta":{"money":-6,"trust":7,"quality":9,"time":-6},"setFlags":["inspection_complete","repaired","joint_check"]}}},"s_payment":{"choices":{"claim":{"next":"s_support","delta":{"money":16,"trust":4,"quality":1,"time":-2},"setFlags":["paid"]},"wait":{"next":"s_docs","delta":{"money":-3,"trust":-2,"quality":0,"time":-4},"setFlags":["claim_missed"]}}},"s_docs":{"choices":{"complete":{"next":"s_support","delta":{"money":14,"trust":3,"quality":2,"time":-3},"setFlags":["paid"]},"teach":{"next":"s_support","delta":{"money":12,"trust":5,"quality":4,"time":-4},"setFlags":["paid","team_briefed"]}}},"s_support":{"choices":{"diagnose":{"next":"s_recall","delta":{"money":-2,"trust":5,"quality":3,"time":-3},"setFlags":["support_logged"]},"onsite":{"next":"s_handover","delta":{"money":-5,"trust":6,"quality":4,"time":-5},"setFlags":["support_logged","onsite_support"]}}},"s_recall":{"choices":{"prevent":{"next":"s_handover","delta":{"money":-6,"trust":7,"quality":8,"time":-4},"setFlags":["support_resolved","prevented_repeat"]},"close_case":{"next":"s_closure","delta":{"money":-3,"trust":4,"quality":4,"time":-2},"setFlags":["support_resolved"]}}},"s_handover":{"choices":{"guide":{"next":"s_closure","delta":{"money":-2,"trust":7,"quality":6,"time":-3},"setFlags":["handover_complete"]},"repeatable":{"next":"s_next","delta":{"money":-3,"trust":5,"quality":7,"time":-4},"requires":{"allFlags":["team_briefed"]},"setFlags":["handover_complete","playbook_ready"]},"debrief":{"next":"s_next","delta":{"money":-4,"trust":4,"quality":5,"time":-6},"requires":{"noFlags":["team_briefed"]},"setFlags":["handover_complete","playbook_ready","team_briefed"]}}},"s_closure":{"choices":{"trusted":{"next":"s_end_trusted","delta":{"money":0,"trust":3,"quality":2,"time":0},"requires":{"allFlags":["handover_complete"],"min":{"trust":70,"quality":70}},"setFlags":[]},"recovered":{"next":"s_end_recovered","delta":{"money":0,"trust":4,"quality":3,"time":0},"setFlags":[]}}},"s_next":{"choices":{"grow":{"next":"s_end_growth","delta":{"money":2,"trust":4,"quality":4,"time":2},"requires":{"allFlags":["playbook_ready"]},"setFlags":[]},"rest":{"next":"s_end_recovered","delta":{"money":4,"trust":3,"quality":3,"time":4},"setFlags":[]}}},"s_end_trusted":{"choices":{},"ending":{"id":"supplier_trusted","title":"신뢰로 완주한 사장님"}},"s_end_recovered":{"choices":{},"ending":{"id":"supplier_recovered","title":"경험을 남긴 완주"}},"s_end_loss":{"choices":{},"ending":{"id":"supplier_loss","title":"다음 도전의 설계자"}},"s_end_hold":{"choices":{},"ending":{"id":"supplier_hold","title":"준비를 선택한 사장님"}},"s_end_growth":{"choices":{},"ending":{"id":"supplier_growth","title":"두 번째 도전을 여는 회사"}}}}'::jsonb),
('manager', '20260916-1', '{"start":"m_start","nodes":{"m_start":{"choices":{"visit":{"next":"m_classroom","delta":{"time":-3,"trust":3},"setFlags":["field_visit"]},"desk":{"next":"m_desk","delta":{"time":3},"setFlags":["desk_start"]}}},"m_classroom":{"choices":{"observe":{"next":"m_budget","delta":{"time":-3,"quality":10,"trust":6},"setFlags":["field_notes"]},"workshop":{"next":"m_budget","delta":{"time":-3,"quality":6,"trust":5},"setFlags":["field_notes","teacher_partner"]}}},"m_desk":{"choices":{"check":{"next":"m_classroom","delta":{"time":-2,"quality":3},"setFlags":["draft_checked"]},"copy":{"next":"m_budget","delta":{"time":5,"quality":-7},"setFlags":["legacy_assumption"]}}},"m_budget":{"choices":{"whole":{"next":"m_spec","delta":{"money":-4,"time":-2,"quality":8},"setFlags":["budget_ready"]},"unit":{"next":"m_spec","delta":{"money":7,"time":3,"quality":-6},"setFlags":["budget_gap"]}}},"m_spec":{"choices":{"function":{"next":"m_notice","delta":{"time":-3,"quality":8,"trust":4},"setFlags":["clear_spec"]},"brand":{"next":"m_challenge","delta":{"time":4,"trust":-7},"setFlags":["narrow_spec"]}}},"m_notice":{"choices":{"crosscheck":{"next":"m_clarify","delta":{"time":-3,"trust":7,"quality":4},"setFlags":["notice_checked"]},"rush":{"next":"m_challenge","delta":{"time":4,"trust":-6},"setFlags":["notice_gap"]}}},"m_challenge":{"choices":{"repair":{"next":"m_clarify","delta":{"time":-8,"trust":8,"quality":7},"setFlags":["notice_repaired","clear_spec","notice_checked"]},"dismiss":{"next":"m_pressure","delta":{"time":3,"trust":-9},"setFlags":["unresolved_notice"]}}},"m_clarify":{"choices":{"public":{"next":"m_select","delta":{"time":-3,"trust":8},"setFlags":["transparent_answers"]},"private":{"next":"m_pressure","delta":{"time":3,"trust":-10},"setFlags":["private_hint"]}}},"m_select":{"choices":{"criteria":{"next":"m_award","delta":{"time":-3,"trust":7,"quality":5},"setFlags":["selection_checked"]},"cheap":{"next":"m_pressure","delta":{"time":3,"quality":-6},"setFlags":["price_only"]}}},"m_pressure":{"choices":{"record":{"next":"m_award","delta":{"time":-8,"trust":9,"quality":7},"setFlags":["selection_checked","transparent_answers","selection_recovered"]},"announce":{"next":"m_award","delta":{"time":4,"trust":-12,"quality":-7},"setFlags":["premature_award"]}}},"m_award":{"choices":{"handover":{"next":"m_contract","delta":{"time":-3,"trust":6,"quality":4},"setFlags":["selection_documented"]},"result":{"next":"m_contract","delta":{"time":2,"trust":-4},"setFlags":["thin_handover"]}}},"m_contract":{"choices":{"write":{"next":"m_handoff","delta":{"time":-3,"trust":7,"quality":7},"setFlags":["contract_clear"]},"verbal":{"next":"m_rushed","delta":{"time":5,"trust":-7,"quality":-6},"setFlags":["verbal_order"]}}},"m_handoff":{"choices":{"rehearsal":{"next":"m_workshop","delta":{"time":-2,"quality":8,"trust":5},"setFlags":["handoff_ready"]},"deliveryonly":{"next":"m_workshop","delta":{"time":4,"quality":-5},"setFlags":["handoff_gap"]}}},"m_workshop":{"choices":{"scope":{"next":"m_change","delta":{"time":-2,"quality":5,"trust":4},"setFlags":["change_assessed"]},"extra":{"next":"m_rushed","delta":{"time":2,"trust":-9},"setFlags":["free_extra"]}}},"m_change":{"choices":{"agree":{"next":"m_delivery","delta":{"money":-5,"time":-4,"quality":9,"trust":6},"setFlags":["change_clear"]},"original":{"next":"m_delivery","delta":{"money":3,"quality":3,"trust":4},"setFlags":["original_scope_kept"]},"insist":{"next":"m_rushed","delta":{"trust":-10,"quality":-5},"setFlags":["free_extra"]}}},"m_rushed":{"choices":{"reset":{"next":"m_delivery","delta":{"time":-9,"money":-4,"quality":9,"trust":10},"setFlags":["contract_clear","change_recovered"]},"push":{"next":"m_delivery","delta":{"time":4,"trust":-8,"quality":-9},"setFlags":["unresolved_delivery"]}}},"m_delivery":{"choices":{"trace":{"next":"m_inspect","delta":{"time":-3,"quality":7,"trust":4},"setFlags":["delivery_checked"]},"boxes":{"next":"m_inspect","delta":{"time":4,"quality":-6},"setFlags":["delivery_unchecked"]}}},"m_inspect":{"choices":{"confirm":{"next":"m_payment","delta":{"time":-3,"quality":6,"trust":6},"requires":{"allFlags":["delivery_checked"],"min":{"quality":55}},"setFlags":["inspected"]},"diagnose":{"next":"m_repair","delta":{"time":-5,"trust":4},"setFlags":["inspection_started"]},"skip":{"next":"m_payment","delta":{"time":5,"quality":-14,"trust":-14},"setFlags":["unchecked_acceptance"]}}},"m_repair":{"choices":{"fix":{"next":"m_reinspect","delta":{"money":-5,"time":-7,"quality":12,"trust":6},"setFlags":["repair_documented"]},"defer":{"next":"m_recover","delta":{"trust":6,"time":3},"setFlags":["deferred"]}}},"m_reinspect":{"choices":{"verify":{"next":"m_payment","delta":{"time":-4,"quality":5,"trust":7},"requires":{"allFlags":["repair_documented"],"min":{"quality":45}},"setFlags":["inspected"]},"hold":{"next":"m_recover","delta":{"time":-3,"trust":5},"setFlags":["deferred"]}}},"m_payment":{"choices":{"process":{"next":"m_closing","delta":{"time":-2,"trust":8},"requires":{"allFlags":["inspected"]},"setFlags":["payment_checked"]},"resolve":{"next":"m_recover","delta":{"time":-5,"trust":4},"setFlags":["payment_issue_recorded"]},"later":{"next":"m_closing","delta":{"time":3,"trust":-14},"setFlags":["payment_delayed"]}}},"m_recover":{"choices":{"accountable":{"next":"m_closing","delta":{"trust":8,"time":-3,"quality":3},"setFlags":["deferred","recovery_plan"]},"minimize":{"next":"m_closing","delta":{"trust":-6,"time":2},"setFlags":["quiet_recovery"]}}},"m_closing":{"choices":{"open":{"next":"m_community","delta":{"trust":5,"quality":3},"requires":{"allFlags":["inspected","payment_checked"]},"setFlags":["service_opened"]},"disclose":{"next":"m_community","delta":{"trust":6},"setFlags":["status_disclosed"]},"promote":{"next":"m_community","delta":{"trust":-12,"quality":-3},"setFlags":["premature_promotion"]}}},"m_community":{"choices":{"debrief":{"next":"m_debrief","delta":{},"requires":{"allFlags":["inspected","payment_checked"],"min":{"quality":40}},"setFlags":["debrief_opened"]},"responsible":{"next":"m_end_responsible","delta":{"trust":3},"requires":{"allFlags":["deferred","status_disclosed"]},"setFlags":["responsible_followup"]},"rebuild":{"next":"m_end_rebuild","delta":{},"setFlags":["rebuild_plan"]}}},"m_debrief":{"choices":{"share":{"next":"m_end_master","delta":{"trust":3},"requires":{"allFlags":["inspected","payment_checked","field_notes","handoff_ready","transparent_answers"],"min":{"trust":70,"quality":75}},"setFlags":["shared_playbook"]},"partners":{"next":"m_end_partner","delta":{"trust":3},"requires":{"allFlags":["inspected","payment_checked","handoff_ready"],"min":{"trust":50,"quality":55}},"setFlags":["aftercare_team"]},"finish":{"next":"m_end_finish","delta":{},"setFlags":["closed_record"]}}},"m_end_master":{"choices":{},"ending":{"id":"master","title":"모두의 교실을 만든 설계자"}},"m_end_partner":{"choices":{},"ending":{"id":"partner","title":"다음 수업까지 이어진 동료"}},"m_end_finish":{"choices":{},"ending":{"id":"finish","title":"첫 계약을 완주한 담당자"}},"m_end_responsible":{"choices":{},"ending":{"id":"responsible","title":"문을 늦추더라도 지킨 약속"}},"m_end_rebuild":{"choices":{},"ending":{"id":"rebuild","title":"다시 펼친 계약 지도"}}}}'::jsonb),
('combo', 'jodal-independent-20260916', '{"atoms":["JP-20260916-A01","JP-20260916-A02","JP-20260916-A03","JP-20260916-A04","JP-20260916-A05","JP-20260916-A06"],"questions":{"JP-20260916-Q01":{"atom":"JP-20260916-A01","answer":2,"options":4},"JP-20260916-Q02":{"atom":"JP-20260916-A01","answer":0,"options":4},"JP-20260916-Q03":{"atom":"JP-20260916-A02","answer":1,"options":4},"JP-20260916-Q04":{"atom":"JP-20260916-A02","answer":3,"options":4},"JP-20260916-Q05":{"atom":"JP-20260916-A03","answer":0,"options":4},"JP-20260916-Q06":{"atom":"JP-20260916-A03","answer":2,"options":4},"JP-20260916-Q07":{"atom":"JP-20260916-A04","answer":1,"options":4},"JP-20260916-Q08":{"atom":"JP-20260916-A04","answer":3,"options":4},"JP-20260916-Q09":{"atom":"JP-20260916-A05","answer":0,"options":4},"JP-20260916-Q10":{"atom":"JP-20260916-A05","answer":2,"options":4},"JP-20260916-Q11":{"atom":"JP-20260916-A06","answer":1,"options":4},"JP-20260916-Q12":{"atom":"JP-20260916-A06","answer":3,"options":4}}}'::jsonb),
('combo-free', 'jodal-independent-20260916', '{"atoms":["JP-20260916-A01","JP-20260916-A02","JP-20260916-A03","JP-20260916-A04","JP-20260916-A05","JP-20260916-A06"],"questions":{"JP-20260916-Q01":{"atom":"JP-20260916-A01","answer":2,"options":4},"JP-20260916-Q02":{"atom":"JP-20260916-A01","answer":0,"options":4},"JP-20260916-Q03":{"atom":"JP-20260916-A02","answer":1,"options":4},"JP-20260916-Q04":{"atom":"JP-20260916-A02","answer":3,"options":4},"JP-20260916-Q05":{"atom":"JP-20260916-A03","answer":0,"options":4},"JP-20260916-Q06":{"atom":"JP-20260916-A03","answer":2,"options":4},"JP-20260916-Q07":{"atom":"JP-20260916-A04","answer":1,"options":4},"JP-20260916-Q08":{"atom":"JP-20260916-A04","answer":3,"options":4},"JP-20260916-Q09":{"atom":"JP-20260916-A05","answer":0,"options":4},"JP-20260916-Q10":{"atom":"JP-20260916-A05","answer":2,"options":4},"JP-20260916-Q11":{"atom":"JP-20260916-A06","answer":1,"options":4},"JP-20260916-Q12":{"atom":"JP-20260916-A06","answer":3,"options":4}}}'::jsonb),
('mission', 'jodal-independent-20260916', '{"atoms":["JP-20260916-A01","JP-20260916-A02","JP-20260916-A03","JP-20260916-A04","JP-20260916-A05","JP-20260916-A06"],"questions":{"JP-20260916-Q01":{"atom":"JP-20260916-A01","answer":2,"options":4},"JP-20260916-Q02":{"atom":"JP-20260916-A01","answer":0,"options":4},"JP-20260916-Q03":{"atom":"JP-20260916-A02","answer":1,"options":4},"JP-20260916-Q04":{"atom":"JP-20260916-A02","answer":3,"options":4},"JP-20260916-Q05":{"atom":"JP-20260916-A03","answer":0,"options":4},"JP-20260916-Q06":{"atom":"JP-20260916-A03","answer":2,"options":4},"JP-20260916-Q07":{"atom":"JP-20260916-A04","answer":1,"options":4},"JP-20260916-Q08":{"atom":"JP-20260916-A04","answer":3,"options":4},"JP-20260916-Q09":{"atom":"JP-20260916-A05","answer":0,"options":4},"JP-20260916-Q10":{"atom":"JP-20260916-A05","answer":2,"options":4},"JP-20260916-Q11":{"atom":"JP-20260916-A06","answer":1,"options":4},"JP-20260916-Q12":{"atom":"JP-20260916-A06","answer":3,"options":4}}}'::jsonb),
('match', 'jodal-independent-20260916', '{"atoms":["JP-20260916-A01","JP-20260916-A02","JP-20260916-A03","JP-20260916-A04","JP-20260916-A05","JP-20260916-A06"],"questions":{"JP-20260916-Q01":{"atom":"JP-20260916-A01","answer":2,"options":4},"JP-20260916-Q02":{"atom":"JP-20260916-A01","answer":0,"options":4},"JP-20260916-Q03":{"atom":"JP-20260916-A02","answer":1,"options":4},"JP-20260916-Q04":{"atom":"JP-20260916-A02","answer":3,"options":4},"JP-20260916-Q05":{"atom":"JP-20260916-A03","answer":0,"options":4},"JP-20260916-Q06":{"atom":"JP-20260916-A03","answer":2,"options":4},"JP-20260916-Q07":{"atom":"JP-20260916-A04","answer":1,"options":4},"JP-20260916-Q08":{"atom":"JP-20260916-A04","answer":3,"options":4},"JP-20260916-Q09":{"atom":"JP-20260916-A05","answer":0,"options":4},"JP-20260916-Q10":{"atom":"JP-20260916-A05","answer":2,"options":4},"JP-20260916-Q11":{"atom":"JP-20260916-A06","answer":1,"options":4},"JP-20260916-Q12":{"atom":"JP-20260916-A06","answer":3,"options":4}}}'::jsonb)) AS expected(mode,revision,rules)
    JOIN public.jp_rank_rules actual USING (mode,revision)
    WHERE actual.rules IS DISTINCT FROM expected.rules
  ) THEN RAISE EXCEPTION 'A published ranking revision is immutable. Bump the game revision first.'; END IF;
END
$verify_seed$;
-- END GENERATED RANKING RULES

CREATE OR REPLACE FUNCTION public.jp_rank_auth(p_player uuid,p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF p_player IS NULL OR p_secret IS NULL OR p_secret !~ '^[0-9a-f]{64}$' OR NOT EXISTS (
    SELECT 1 FROM public.jp_rank_profiles p WHERE p.player_id=p_player
    AND p.secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex')
  ) THEN RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='기록 소유자를 확인하지 못했습니다.'; END IF;
END;
$$;

-- One best per role+ending, plus one best per Korean date+mini-game mode.
-- A replay improves that unit instead of multiplying its points.
CREATE OR REPLACE FUNCTION public.jp_rank_totals(p_player uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  WITH best AS (
    SELECT max(normalized) points FROM public.jp_rank_records
    WHERE player_id=p_player
    GROUP BY mode, CASE WHEN ending_id IS NOT NULL THEN ending_id ELSE play_day::text END
  ) SELECT jsonb_build_object('total',coalesce((SELECT sum(points) FROM best),0),
    'high',coalesce(max(normalized),0),'plays',count(*))
    FROM public.jp_rank_records WHERE player_id=p_player;
$$;

CREATE OR REPLACE FUNCTION public.jp_rank_record_json(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT jsonb_build_object('id',r.id,'mode',r.mode,'score',r.score,'normalized',r.normalized,
    'endingId',r.ending_id,'endingTitle',r.ending_title,'createdAt',r.created_at,
    'nickname',p.nickname,'published',p.published,'profileId',p.profile_id)
    || public.jp_rank_totals(r.player_id)
  FROM public.jp_rank_records r JOIN public.jp_rank_profiles p USING(player_id) WHERE r.id=p_id;
$$;

CREATE OR REPLACE FUNCTION public.jp_rank_profile(p_player uuid,p_secret text,p_nickname text DEFAULT NULL,p_publish boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE profile public.jp_rank_profiles; recent jsonb;
BEGIN
  IF p_player IS NULL OR p_secret IS NULL OR p_secret !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='기록 열쇠 형식이 올바르지 않습니다.';
  END IF;
  IF p_nickname IS NOT NULL THEN
    p_nickname := btrim(p_nickname);
    IF char_length(p_nickname) NOT BETWEEN 2 AND 20 OR p_nickname !~ '^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 _.-]+$' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='별명은 한글·영문·숫자와 공백·밑줄·점·하이픈으로 2~20자 입력해 주세요.';
    END IF;
    INSERT INTO public.jp_rank_profiles(player_id,secret_hash,nickname)
    VALUES(p_player,encode(sha256(convert_to(p_secret,'UTF8')),'hex'),p_nickname)
    ON CONFLICT(player_id) DO NOTHING;
  END IF;
  PERFORM public.jp_rank_auth(p_player,p_secret);
  SELECT * INTO profile FROM public.jp_rank_profiles WHERE player_id=p_player FOR UPDATE;
  UPDATE public.jp_rank_profiles SET nickname=coalesce(p_nickname,nickname),
    published=coalesce(p_publish,published), updated_at=now() WHERE player_id=p_player RETURNING * INTO profile;
  SELECT coalesce(jsonb_agg(public.jp_rank_record_json(r.id) ORDER BY r.created_at DESC),'[]'::jsonb)
    INTO recent FROM (SELECT id,created_at FROM public.jp_rank_records WHERE player_id=p_player ORDER BY created_at DESC,id DESC LIMIT 20) r;
  RETURN jsonb_build_object('profileId',profile.profile_id,'nickname',profile.nickname,'published',profile.published,'records',recent)
    || public.jp_rank_totals(p_player);
END;
$$;

CREATE OR REPLACE FUNCTION public.jp_rank_submit(p_player uuid,p_secret text,p_record jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  record_id uuid; game_mode text; rev text; rules jsonb; previous public.jp_rank_records;
  entry jsonb; node jsonb; choice jsonb; required jsonb; question jsonb;
  node_id text; key text; flag text; qid text; left_id text; right_id text;
  stats jsonb := '{"money":60,"trust":60,"quality":60,"time":60}';
  flags text[] := ARRAY[]::text[]; seen text[] := ARRAY[]::text[]; atoms_seen text[] := ARRAY[]::text[]; matched text[] := ARRAY[]::text[];
  raw_score integer := 0; norm integer; combo integer := 0; chosen integer; num integer; attempt integer := 0;
  ending_id text; ending_title text;
BEGIN
  PERFORM public.jp_rank_auth(p_player,p_secret);
  -- Serializes same-player submissions and the daily quota, including concurrent requests.
  PERFORM 1 FROM public.jp_rank_profiles WHERE player_id=p_player FOR UPDATE;
  IF p_record IS NULL OR jsonb_typeof(p_record)<>'object' OR octet_length(p_record::text)>40000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='완료 기록 형식을 확인해 주세요.';
  END IF;
  IF coalesce(p_record->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='완료 기록 번호가 올바르지 않습니다.';
  END IF;
  record_id := (p_record->>'id')::uuid;
  SELECT * INTO previous FROM public.jp_rank_records WHERE id=record_id;
  IF FOUND THEN
    IF previous.player_id=p_player AND previous.payload=p_record THEN RETURN public.jp_rank_record_json(record_id); END IF;
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='이미 사용한 완료 기록 번호입니다.';
  END IF;
  IF (SELECT count(*) FROM public.jp_rank_records WHERE player_id=p_player AND play_day=(now() AT TIME ZONE 'Asia/Seoul')::date)>=100 THEN
    RAISE EXCEPTION USING ERRCODE='54000', MESSAGE='오늘은 100회까지 등록할 수 있습니다. 내일 다시 도전해 주세요.';
  END IF;
  game_mode := p_record->>'mode'; rev := p_record->>'revision';
  SELECT r.rules INTO rules FROM public.jp_rank_rules r WHERE r.mode=game_mode AND r.revision=rev;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='게임을 새로고침한 뒤 다시 도전해 주세요.'; END IF;
  IF game_mode IN ('supplier','manager') THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_record) k WHERE k NOT IN ('id','mode','revision','history'))
      OR jsonb_typeof(p_record->'history') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_record->'history') NOT BETWEEN 1 AND 160 THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='이야기의 선택 기록이 올바르지 않습니다.';
    END IF;
    node_id := rules->>'start';
    FOR entry IN SELECT value FROM jsonb_array_elements(p_record->'history') LOOP
      node := rules->'nodes'->node_id;
      IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR entry->>'nodeId' IS DISTINCT FROM node_id OR node ? 'ending' THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='이야기의 장면 순서가 다릅니다.';
      END IF;
      IF EXISTS(SELECT 1 FROM jsonb_object_keys(entry) k WHERE k NOT IN ('nodeId','choiceId')) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='선택 기록에 알 수 없는 항목이 있습니다.';
      END IF;
      choice := node->'choices'->(entry->>'choiceId');
      IF choice IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='존재하지 않는 선택입니다.'; END IF;
      required := coalesce(choice->'requires','{}'::jsonb);
      FOR flag IN SELECT jsonb_array_elements_text(coalesce(required->'allFlags','[]'::jsonb)) LOOP
        IF NOT flag=ANY(flags) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='아직 열리지 않은 선택입니다.'; END IF;
      END LOOP;
      FOR flag IN SELECT jsonb_array_elements_text(coalesce(required->'noFlags','[]'::jsonb)) LOOP
        IF flag=ANY(flags) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='선택의 선행조건이 맞지 않습니다.'; END IF;
      END LOOP;
      FOR key IN SELECT jsonb_object_keys(coalesce(required->'min','{}'::jsonb)) LOOP
        IF (stats->>key)::integer < (required->'min'->>key)::integer THEN
          RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='선택에 필요한 자원이 부족합니다.';
        END IF;
      END LOOP;
      FOREACH key IN ARRAY ARRAY['money','trust','quality','time'] LOOP
        num := greatest(0,least(100,(stats->>key)::integer+coalesce((choice->'delta'->>key)::integer,0)));
        stats := jsonb_set(stats,ARRAY[key],to_jsonb(num));
      END LOOP;
      FOR flag IN SELECT jsonb_array_elements_text(coalesce(choice->'setFlags','[]'::jsonb)) LOOP
        IF NOT flag=ANY(flags) THEN flags := array_append(flags,flag); END IF;
      END LOOP;
      node_id := choice->>'next';
    END LOOP;
    node := rules->'nodes'->node_id;
    IF node->'ending' IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='엔딩까지 마친 이야기만 등록할 수 있습니다.'; END IF;
    ending_id := node->'ending'->>'id'; ending_title := node->'ending'->>'title';
    SELECT sum(value::integer)::integer INTO raw_score FROM jsonb_each_text(stats);
    norm := round(raw_score*2.5)::integer;
  ELSIF game_mode='match' THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_record) k WHERE k NOT IN ('id','mode','revision','pool','matches'))
      OR jsonb_typeof(p_record->'pool') IS DISTINCT FROM 'array' OR jsonb_array_length(p_record->'pool')<>6
      OR jsonb_typeof(p_record->'matches') IS DISTINCT FROM 'array' OR jsonb_array_length(p_record->'matches') NOT BETWEEN 6 AND 60 THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='짝맞추기 완료 기록이 올바르지 않습니다.';
    END IF;
    FOR entry IN SELECT value FROM jsonb_array_elements(p_record->'pool') LOOP
      IF jsonb_typeof(entry)<>'string' OR NOT (rules->'atoms') ? (entry#>>'{}') OR (entry#>>'{}')=ANY(seen) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='짝맞추기 묶음이 올바르지 않습니다.';
      END IF;
      seen := array_append(seen,entry#>>'{}');
    END LOOP;
    FOR entry IN SELECT value FROM jsonb_array_elements(p_record->'matches') LOOP
      IF jsonb_typeof(entry) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='짝맞추기 선택이 올바르지 않습니다.'; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_object_keys(entry) k WHERE k NOT IN ('left','right')) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='짝맞추기 선택을 확인해 주세요.'; END IF;
      left_id := entry->>'left'; right_id := entry->>'right';
      IF left_id IS NULL OR right_id IS NULL OR NOT left_id=ANY(seen) OR NOT right_id=ANY(seen)
        OR left_id=ANY(matched) OR right_id=ANY(matched) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='이미 맞췄거나 존재하지 않는 짝입니다.';
      END IF;
      attempt := attempt+1;
      IF left_id=right_id THEN matched := array_append(matched,left_id); END IF;
    END LOOP;
    IF cardinality(matched)<>6 THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='6쌍을 모두 마친 뒤 등록해 주세요.'; END IF;
    raw_score := greatest(60,600-(attempt-6)*25); norm := round(raw_score*1000.0/600)::integer;
  ELSE
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_record) k WHERE k NOT IN ('id','mode','revision','answers'))
      OR jsonb_typeof(p_record->'answers') IS DISTINCT FROM 'array' OR jsonb_array_length(p_record->'answers') NOT BETWEEN 1 AND 6
      OR (game_mode<>'combo' AND jsonb_array_length(p_record->'answers')<>6) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='라운드의 답안 기록이 올바르지 않습니다.';
    END IF;
    FOR entry IN SELECT value FROM jsonb_array_elements(p_record->'answers') LOOP
      IF jsonb_typeof(entry) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='답안 형식이 올바르지 않습니다.'; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_object_keys(entry) k WHERE k NOT IN ('id','choice'))
        OR jsonb_typeof(entry->'choice') IS DISTINCT FROM 'number' OR coalesce(entry->>'choice','') !~ '^[0-3]$' THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='답안 번호가 올바르지 않습니다.';
      END IF;
      qid := entry->>'id'; question := rules->'questions'->qid;
      IF question IS NULL OR qid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='문항이 없거나 중복되었습니다.'; END IF;
      chosen := (entry->>'choice')::integer;
      IF chosen >= (question->>'options')::integer THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='없는 보기입니다.'; END IF;
      IF game_mode='mission' AND (question->>'atom')=ANY(atoms_seen) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='미션은 서로 다른 6개 주제로 진행합니다.'; END IF;
      seen := array_append(seen,qid); atoms_seen := array_append(atoms_seen,question->>'atom');
      IF chosen=(question->>'answer')::integer THEN combo := combo+1; raw_score := raw_score+100+least(combo-1,4)*25; ELSE combo := 0; END IF;
    END LOOP;
    norm := round(raw_score*1000.0/950)::integer;
  END IF;
  INSERT INTO public.jp_rank_records(id,player_id,mode,revision,score,normalized,ending_id,ending_title,payload)
    VALUES(record_id,p_player,game_mode,rev,raw_score,norm,ending_id,ending_title,p_record);
  RETURN public.jp_rank_record_json(record_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.jp_rank_leaderboard(p_period text DEFAULT 'all',p_mode text DEFAULT 'all',p_metric text DEFAULT 'cumulative',p_player uuid DEFAULT NULL,p_secret text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  IF p_period IS NULL OR p_period NOT IN ('all','week') OR p_mode IS NULL OR p_mode NOT IN ('all','supplier','manager','combo','combo-free','mission','match')
    OR p_metric IS NULL OR p_metric NOT IN ('cumulative','high') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='순위 조회 조건이 올바르지 않습니다.';
  END IF;
  IF p_player IS NOT NULL OR p_secret IS NOT NULL THEN PERFORM public.jp_rank_auth(p_player,p_secret); END IF;
  WITH filtered AS (
    SELECT r.* FROM public.jp_rank_records r JOIN public.jp_rank_profiles p USING(player_id)
    WHERE p.published AND (p_mode='all' OR r.mode=p_mode)
      AND (p_period='all' OR r.created_at >= (date_trunc('week',now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'))
  ), units AS (
    SELECT player_id, max(normalized) points FROM filtered
    GROUP BY player_id,mode,CASE WHEN ending_id IS NOT NULL THEN ending_id ELSE play_day::text END
  ), totals AS (
    SELECT player_id,sum(points) total FROM units GROUP BY player_id
  ), ranked AS (
    SELECT p.player_id,p.profile_id,p.nickname,t.total,max(r.normalized) high,count(*) plays,
      dense_rank() OVER(ORDER BY CASE WHEN p_metric='cumulative' THEN t.total ELSE max(r.normalized) END DESC) place
    FROM filtered r JOIN public.jp_rank_profiles p USING(player_id) JOIN totals t USING(player_id)
    GROUP BY p.player_id,p.profile_id,p.nickname,t.total
  ), rows_json AS (
    SELECT *,jsonb_build_object('rank',place,'profileId',profile_id,'nickname',nickname,'total',total,'high',high,'plays',plays) item FROM ranked
  ) SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(item ORDER BY place,nickname,profile_id) FROM (SELECT * FROM rows_json ORDER BY place,nickname,profile_id LIMIT 50) top_rows),'[]'::jsonb),
    'mine',(SELECT item FROM rows_json WHERE player_id=p_player),'period',p_period,'mode',p_mode,'metric',p_metric,
    'weekStartsAt',(date_trunc('week',now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul')) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.jp_rank_public_record(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT public.jp_rank_record_json(r.id) FROM public.jp_rank_records r JOIN public.jp_rank_profiles p USING(player_id)
  WHERE r.id=p_id AND p.published;
$$;

CREATE OR REPLACE FUNCTION public.jp_rank_delete_self(p_player uuid,p_secret text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM public.jp_rank_auth(p_player,p_secret);
  PERFORM 1 FROM public.jp_rank_profiles WHERE player_id=p_player FOR UPDATE;
  DELETE FROM public.jp_rank_records WHERE player_id=p_player;
  DELETE FROM public.jp_rank_profiles WHERE player_id=p_player;
  RETURN '{"deleted":true}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.jp_rank_auth(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_rank_totals(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_rank_record_json(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_rank_profile(uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_rank_submit(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_rank_leaderboard(text,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_rank_public_record(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.jp_rank_delete_self(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_rank_profile(uuid,text,text,boolean) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_rank_submit(uuid,text,jsonb) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_rank_leaderboard(text,text,text,uuid,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_rank_public_record(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jp_rank_delete_self(uuid,text) TO anon,authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

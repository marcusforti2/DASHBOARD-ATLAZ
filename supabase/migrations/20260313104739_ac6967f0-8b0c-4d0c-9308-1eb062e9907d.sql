-- Fix FK constraints missing ON DELETE rules for team_members
ALTER TABLE profiles DROP CONSTRAINT profiles_team_member_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL;

ALTER TABLE wa_transfer_logs DROP CONSTRAINT wa_transfer_logs_from_member_id_fkey;
ALTER TABLE wa_transfer_logs ADD CONSTRAINT wa_transfer_logs_from_member_id_fkey FOREIGN KEY (from_member_id) REFERENCES team_members(id) ON DELETE SET NULL;

ALTER TABLE wa_transfer_logs DROP CONSTRAINT wa_transfer_logs_to_member_id_fkey;
ALTER TABLE wa_transfer_logs ADD CONSTRAINT wa_transfer_logs_to_member_id_fkey FOREIGN KEY (to_member_id) REFERENCES team_members(id) ON DELETE SET NULL;

ALTER TABLE wa_follow_up_reminders DROP CONSTRAINT wa_follow_up_reminders_created_by_fkey;
ALTER TABLE wa_follow_up_reminders ADD CONSTRAINT wa_follow_up_reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES team_members(id) ON DELETE CASCADE;

ALTER TABLE pipedrive_deals DROP CONSTRAINT pipedrive_deals_team_member_id_fkey;
ALTER TABLE pipedrive_deals ADD CONSTRAINT pipedrive_deals_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL;

ALTER TABLE pipedrive_sdr_queue DROP CONSTRAINT pipedrive_sdr_queue_team_member_id_fkey;
ALTER TABLE pipedrive_sdr_queue ADD CONSTRAINT pipedrive_sdr_queue_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL;

-- Make from_member_id and to_member_id nullable if not already
ALTER TABLE wa_transfer_logs ALTER COLUMN from_member_id DROP NOT NULL;
ALTER TABLE wa_transfer_logs ALTER COLUMN to_member_id DROP NOT NULL;
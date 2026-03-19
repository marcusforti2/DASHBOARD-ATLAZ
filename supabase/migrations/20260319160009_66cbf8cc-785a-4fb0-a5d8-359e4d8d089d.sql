-- Clean ALL WhatsApp data: messages, events, follow-ups, scores, enrollments, conversations, contacts
DELETE FROM wa_follow_up_reminders;
DELETE FROM wa_conversation_state_events;
DELETE FROM wa_lead_scores;
DELETE FROM wa_contact_tags;
DELETE FROM wa_messages;
DELETE FROM campaign_enrollments;
DELETE FROM campaign_events;
DELETE FROM automation_actions;
DELETE FROM wa_conversations;
DELETE FROM wa_contacts;
-- Fix contacts that have the instance profile name instead of their actual name
-- Reset them to phone number; the webhook will update with correct pushName on next message
UPDATE wa_contacts SET name = phone 
WHERE name IN ('Jacob - Aceleradora de Vendas', 'Marcus Forti') 
AND name != phone;
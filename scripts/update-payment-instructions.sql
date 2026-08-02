INSERT INTO app_settings (id, key, value, updated_at) 
VALUES (
  gen_random_uuid(), 
  'payment_instructions', 
  '{"currency":"PKR","instructions":"Transfer the package amount (700 PKR for 6 Months or 1000 PKR for 1 Year) to one of the accounts below, then upload your payment proof in-app or send via WhatsApp / Email. Your subscription will activate once verified.","whatsappNumber":"+923360830836","supportEmail":"maternalmind.help@gmail.com","bank":{"bankName":"HBL","accountTitle":"Farzana Muneer","accountNumber":"08477902077901","iban":"PK85HABB0008477902077901","branch":"Chowk Azam Layyah"},"wallets":[{"name":"JazzCash","accountTitle":"Farzana Muneer","number":"03360830836","iban":"PK77JCMA3101923360830836"}]}', 
  now()
) 
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

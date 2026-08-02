INSERT INTO app_settings (id, key, value, updated_at) 
VALUES 
  (gen_random_uuid(), 'support_email', 'maternalmind.help@gmail.com', now()),
  (gen_random_uuid(), 'support_whatsapp_number', '+923360830836', now()),
  (gen_random_uuid(), 'support_phone_number', '+923360830836', now()),
  (gen_random_uuid(), 'support_website_url', 'https://maternalmind.com.pk/', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

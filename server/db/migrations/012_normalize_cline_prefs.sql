-- Legacy Cline UI removed; normalize stored row for older databases.
UPDATE app_prefs
SET
  agent_backend = 'langchain',
  cline_model = '',
  cline_local_base_url = '',
  cline_agent_id = 'default',
  cline_auto_fallback_on_error = 1
WHERE id = 1;

-- Remove the default project constraint
DELETE FROM projects WHERE name = 'General' AND description = 'Default project for conversations';

-- Ensure project_id can be NULL (it already should be based on the schema)
ALTER TABLE conversations 
ALTER COLUMN project_id DROP NOT NULL;

-- Update any conversations that had the deleted project to have NULL project_id
UPDATE conversations 
SET project_id = NULL 
WHERE project_id NOT IN (SELECT id FROM projects);
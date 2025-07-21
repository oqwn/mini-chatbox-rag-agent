import { Request, Response } from 'express';
import { Pool } from 'pg';
import { Logger } from 'winston';

export interface Project {
  id: number;
  name: string;
  description?: string;
  color: string;
  icon: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ProjectsController {
  private pool: Pool;

  constructor(private logger: Logger) {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rag_chatbox',
      user: process.env.DB_USER || process.env.USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      options: '--client_encoding=UTF8',
    });
  }

  async getProjects(req: Request, res: Response): Promise<void> {
    try {
      const query = `
        SELECT id, name, description, color, icon, created_at, updated_at
        FROM projects
        ORDER BY name ASC
      `;
      const result = await this.pool.query(query);

      const projects = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        icon: row.icon,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      res.json({ projects });
    } catch (error) {
      this.logger.error('Error getting projects:', error);
      res.status(500).json({ error: 'Failed to get projects' });
    }
  }

  async createProject(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, color, icon } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Project name is required' });
        return;
      }

      const query = `
        INSERT INTO projects (name, description, color, icon)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, description, color, icon, created_at, updated_at
      `;
      const values = [
        name,
        description || null,
        color || '#3B82F6',
        icon || 'folder',
      ];

      const result = await this.pool.query(query, values);
      const project = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        description: result.rows[0].description,
        color: result.rows[0].color,
        icon: result.rows[0].icon,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };

      this.logger.info(`Created project: ${project.name} (ID: ${project.id})`);
      res.json({ project });
    } catch (error) {
      this.logger.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  }

  async updateProject(req: Request, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params.id);
      const updates = req.body;

      if (isNaN(projectId)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }
      if (updates.color !== undefined) {
        updateFields.push(`color = $${paramCount++}`);
        values.push(updates.color);
      }
      if (updates.icon !== undefined) {
        updateFields.push(`icon = $${paramCount++}`);
        values.push(updates.icon);
      }

      if (updateFields.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(projectId);

      const query = `
        UPDATE projects 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, name, description, color, icon, created_at, updated_at
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const project = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        description: result.rows[0].description,
        color: result.rows[0].color,
        icon: result.rows[0].icon,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };

      this.logger.info(`Updated project: ${project.name} (ID: ${project.id})`);
      res.json({ project });
    } catch (error) {
      this.logger.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  }

  async deleteProject(req: Request, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params.id);

      if (isNaN(projectId)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      // Check if it's the default project
      const checkQuery = 'SELECT name FROM projects WHERE id = $1';
      const checkResult = await this.pool.query(checkQuery, [projectId]);

      if (checkResult.rows.length === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      if (checkResult.rows[0].name === 'General') {
        res.status(400).json({ error: 'Cannot delete the default project' });
        return;
      }

      // Move conversations to the default project
      const updateConversationsQuery = `
        UPDATE conversations 
        SET project_id = (SELECT id FROM projects WHERE name = 'General' LIMIT 1)
        WHERE project_id = $1
      `;
      await this.pool.query(updateConversationsQuery, [projectId]);

      // Delete the project
      const deleteQuery = 'DELETE FROM projects WHERE id = $1';
      await this.pool.query(deleteQuery, [projectId]);

      this.logger.info(`Deleted project ID: ${projectId}`);
      res.json({ success: true });
    } catch (error) {
      this.logger.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  }
}
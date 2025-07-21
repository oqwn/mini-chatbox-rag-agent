import { Router } from 'express';
import { ProjectsController } from '../controllers/projects.controller';
import { Logger } from 'winston';

export function createProjectsRoutes(logger: Logger): Router {
  const router = Router();
  const projectsController = new ProjectsController(logger);

  // Get all projects
  router.get('/', projectsController.getProjects.bind(projectsController));

  // Create new project
  router.post('/', projectsController.createProject.bind(projectsController));

  // Update project
  router.put('/:id', projectsController.updateProject.bind(projectsController));

  // Delete project
  router.delete('/:id', projectsController.deleteProject.bind(projectsController));

  return router;
}
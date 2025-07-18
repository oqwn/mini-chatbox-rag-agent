import { Router } from 'express';
import { SettingsController } from '@/controllers/settings.controller';

export function createSettingsRoutes(settingsController: SettingsController): Router {
  const router = Router();

  router.get('/settings', (req, res) => settingsController.getSettings(req, res));
  router.put('/settings', (req, res) => settingsController.updateSettings(req, res));

  return router;
}
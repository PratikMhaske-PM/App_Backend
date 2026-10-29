/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { notificationsService, NotificationsService } from './notifications.service';
import { NotificationFilterQuery } from './notifications.types';

export class NotificationsController {
  constructor(private readonly service: NotificationsService = notificationsService) {}

  /**
   * API 30: GET /notifications
   * Role: All authenticated users
   */
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const query: NotificationFilterQuery = {
        status: req.query['status'] as 'read' | 'unread' | 'all' | undefined,
        isRead: req.query['isRead'] as unknown as boolean | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10,
      };
      const result = await this.service.getNotifications(req.user.userId, query);
      sendSuccess(res, 200, 'Notifications retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };
}

export const notificationsController = new NotificationsController();

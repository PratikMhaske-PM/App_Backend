import {
  defaultNotificationRepository,
  INotificationRepository,
} from '../../repositories/notification.repo';
import {
  NotificationFilterQuery,
  NotificationListResponseData,
} from './notifications.types';

export class NotificationsService {
  constructor(
    private readonly notifRepo: INotificationRepository = defaultNotificationRepository
  ) {}

  /**
   * API 30: GET /notifications
   * Role: All authenticated users
   * Retrieve notifications belonging strictly to the authenticated user.
   */
  async getNotifications(
    userId: string,
    query: NotificationFilterQuery
  ): Promise<NotificationListResponseData> {
    let isRead: boolean | undefined;
    if (query.status === 'read' || query.isRead === true) {
      isRead = true;
    } else if (query.status === 'unread' || query.isRead === false) {
      isRead = false;
    }

    const all = await this.notifRepo.findByUserId(userId, isRead);

    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;
    const paginated = all.slice(offset, offset + limit);

    return {
      notifications: paginated,
      pagination: {
        page,
        limit,
        total: all.length,
        totalPages: Math.ceil(all.length / limit) || 1,
      },
    };
  }
}

export const notificationsService = new NotificationsService();

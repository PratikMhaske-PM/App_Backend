import { Notification } from '../../types/common.types';

export interface NotificationFilterQuery {
  isRead?: boolean;
  status?: 'read' | 'unread' | 'all';
  page?: number;
  limit?: number;
}

export interface NotificationListResponseData {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

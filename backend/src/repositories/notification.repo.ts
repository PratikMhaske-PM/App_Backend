import { Notification } from '../types/common.types';

export interface INotificationRepository {
  findByUserId(userId: string, isRead?: boolean): Promise<Notification[]>;
  create(data: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification>;
  markAsRead(id: string): Promise<Notification | null>;
}

export class InMemoryNotificationRepository implements INotificationRepository {
  private notifications: Map<string, Notification> = new Map();

  constructor() {
    this.seedDefaultNotifications();
  }

  private seedDefaultNotifications(): void {
    const demo1: Notification = {
      id: 'notif_demo_1',
      userId: 'usr_demo_1',
      title: 'Booking Confirmed',
      message: 'Your electrical inspection service booking has been accepted by the worker.',
      type: 'booking',
      isRead: false,
      metadata: { bookingId: 'bkg_demo_1' },
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    };

    const demo2: Notification = {
      id: 'notif_demo_2',
      userId: 'usr_demo_1',
      title: 'Welcome to Fixmate',
      message: 'Explore our top-rated certified service professionals in your area.',
      type: 'system',
      isRead: true,
      readAt: new Date(Date.now() - 86400000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    };

    const demo3: Notification = {
      id: 'notif_demo_3',
      userId: 'usr_demo_worker_1',
      title: 'New Service Request',
      message: 'You have received a new booking request in Electrical Installation.',
      type: 'booking',
      isRead: false,
      metadata: { bookingId: 'bkg_demo_2' },
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    };

    this.notifications.set(demo1.id, demo1);
    this.notifications.set(demo2.id, demo2);
    this.notifications.set(demo3.id, demo3);
  }

  async findByUserId(userId: string, isRead?: boolean): Promise<Notification[]> {
    const results: Notification[] = [];
    for (const notif of this.notifications.values()) {
      if (notif.userId === userId) {
        if (isRead === undefined || notif.isRead === isRead) {
          results.push({ ...notif });
        }
      }
    }
    // Sort descending by creation date
    return results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async create(data: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();

    const newNotification: Notification = {
      ...data,
      id,
      createdAt,
    };

    this.notifications.set(id, newNotification);
    return { ...newNotification };
  }

  async markAsRead(id: string): Promise<Notification | null> {
    const existing = this.notifications.get(id);
    if (!existing) return null;

    const updated: Notification = {
      ...existing,
      isRead: true,
      readAt: new Date().toISOString(),
    };

    this.notifications.set(id, updated);
    return { ...updated };
  }
}

export const defaultNotificationRepository: INotificationRepository =
  new InMemoryNotificationRepository();

import { SosAlert } from '../types/common.types';

export interface ISosRepository {
  create(data: Omit<SosAlert, 'id' | 'createdAt'>): Promise<SosAlert>;
  findById(id: string): Promise<SosAlert | null>;
  findRecentByUser(userId: string, withinSeconds: number): Promise<SosAlert | null>;
  findByUserId(userId: string): Promise<SosAlert[]>;
}

export class InMemorySosRepository implements ISosRepository {
  private alerts: Map<string, SosAlert> = new Map();

  async create(data: Omit<SosAlert, 'id' | 'createdAt'>): Promise<SosAlert> {
    const id = `sos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();

    const newAlert: SosAlert = {
      ...data,
      id,
      createdAt,
    };

    this.alerts.set(id, newAlert);
    return { ...newAlert };
  }

  async findById(id: string): Promise<SosAlert | null> {
    const alert = this.alerts.get(id);
    return alert ? { ...alert } : null;
  }

  async findRecentByUser(userId: string, withinSeconds: number): Promise<SosAlert | null> {
    const cutoff = Date.now() - withinSeconds * 1000;
    for (const alert of this.alerts.values()) {
      if (alert.userId === userId && new Date(alert.createdAt).getTime() > cutoff) {
        return { ...alert };
      }
    }
    return null;
  }

  async findByUserId(userId: string): Promise<SosAlert[]> {
    const results: SosAlert[] = [];
    for (const alert of this.alerts.values()) {
      if (alert.userId === userId) {
        results.push({ ...alert });
      }
    }
    return results;
  }
}

export const defaultSosRepository: ISosRepository = new InMemorySosRepository();

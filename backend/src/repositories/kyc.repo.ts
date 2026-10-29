import { KycApplication } from '../types/common.types';
import { AppError } from '../utils/AppError';

export interface IKycRepository {
  findByWorkerId(workerId: string): Promise<KycApplication | null>;
  findById(id: string): Promise<KycApplication | null>;
  create(data: Omit<KycApplication, 'id' | 'submittedAt'>): Promise<KycApplication>;
  update(id: string, updates: Partial<KycApplication>): Promise<KycApplication>;
}

export class InMemoryKycRepository implements IKycRepository {
  private applications: Map<string, KycApplication> = new Map();

  constructor() {
    this.seedDefaultKyc();
  }

  private seedDefaultKyc(): void {
    const demo: KycApplication = {
      id: 'kyc_demo_1',
      workerId: 'wrk_demo_1',
      documentType: 'id_card',
      documentNumber: 'ID-987654321',
      fullName: 'Alex Miller',
      documentUrl: 'https://example.com/docs/id_demo.pdf',
      status: 'approved',
      submittedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      reviewedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      reviewedBy: 'usr_admin_1',
    };
    this.applications.set(demo.id, demo);
  }

  async findByWorkerId(workerId: string): Promise<KycApplication | null> {
    const matching = Array.from(this.applications.values())
      .filter((app) => app.workerId === workerId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return matching[0] ? { ...matching[0] } : null;
  }

  async findById(id: string): Promise<KycApplication | null> {
    const app = this.applications.get(id);
    return app ? { ...app } : null;
  }

  async create(data: Omit<KycApplication, 'id' | 'submittedAt'>): Promise<KycApplication> {
    const id = `kyc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const submittedAt = new Date().toISOString();

    const newApp: KycApplication = {
      ...data,
      id,
      submittedAt,
    };

    this.applications.set(id, newApp);
    return { ...newApp };
  }

  async update(id: string, updates: Partial<KycApplication>): Promise<KycApplication> {
    const existing = this.applications.get(id);
    if (!existing) {
      throw AppError.notFound(`KYC Application with ID '${id}' not found`);
    }

    const updated: KycApplication = {
      ...existing,
      ...updates,
    };

    this.applications.set(id, updated);
    return { ...updated };
  }
}

export const defaultKycRepository: IKycRepository = new InMemoryKycRepository();

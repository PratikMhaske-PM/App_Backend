import { Address } from '../types/common.types';
import { AppError } from '../utils/AppError';

export interface IAddressRepository {
  findByUserId(userId: string): Promise<Address[]>;
  findById(id: string): Promise<Address | null>;
  create(data: Omit<Address, 'id' | 'createdAt' | 'updatedAt'>): Promise<Address>;
  update(
    id: string,
    updates: Partial<Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<Address>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryAddressRepository implements IAddressRepository {
  private addresses: Map<string, Address> = new Map();

  constructor() {
    this.seedDefaultAddresses();
  }

  private seedDefaultAddresses(): void {
    const demo1: Address = {
      id: 'addr_demo_1',
      userId: 'usr_demo_1',
      label: 'Home',
      street: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      country: 'USA',
      isDefault: true,
      latitude: 40.7128,
      longitude: -74.006,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const demo2: Address = {
      id: 'addr_demo_2',
      userId: 'usr_demo_1',
      label: 'Office',
      street: '42 Wallaby Way',
      city: 'Sydney',
      state: 'NSW',
      postalCode: '2000',
      country: 'Australia',
      isDefault: false,
      latitude: -33.8688,
      longitude: 151.2093,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.addresses.set(demo1.id, demo1);
    this.addresses.set(demo2.id, demo2);
  }

  async findByUserId(userId: string): Promise<Address[]> {
    const results: Address[] = [];
    for (const address of this.addresses.values()) {
      if (address.userId === userId) {
        results.push({ ...address });
      }
    }
    return results;
  }

  async findById(id: string): Promise<Address | null> {
    const address = this.addresses.get(id);
    return address ? { ...address } : null;
  }

  async create(data: Omit<Address, 'id' | 'createdAt' | 'updatedAt'>): Promise<Address> {
    const id = `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    // If setting as default, unset other defaults for this user
    if (data.isDefault) {
      for (const [key, addr] of this.addresses.entries()) {
        if (addr.userId === data.userId && addr.isDefault) {
          this.addresses.set(key, { ...addr, isDefault: false, updatedAt: now });
        }
      }
    }

    const newAddress: Address = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.addresses.set(id, newAddress);
    return { ...newAddress };
  }

  async update(
    id: string,
    updates: Partial<Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<Address> {
    const existing = this.addresses.get(id);
    if (!existing) {
      throw AppError.notFound(`Address with ID '${id}' not found`);
    }

    const now = new Date().toISOString();

    if (updates.isDefault) {
      for (const [key, addr] of this.addresses.entries()) {
        if (addr.userId === existing.userId && addr.isDefault && key !== id) {
          this.addresses.set(key, { ...addr, isDefault: false, updatedAt: now });
        }
      }
    }

    const updated: Address = {
      ...existing,
      ...updates,
      updatedAt: now,
    };

    this.addresses.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.addresses.delete(id);
  }
}

export const defaultAddressRepository: IAddressRepository = new InMemoryAddressRepository();

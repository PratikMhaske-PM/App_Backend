import { db } from '../../config/database';
import { IDatabase } from '../../database/sqlite';
import { AppError } from '../../utils/AppError';
import { Address, CreateAddressInput, UpdateAddressInput } from './addresses.types';

interface AddressDbRow {
  id: string;
  user_id: string;
  label: string;
  street: string;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: AddressDbRow): Address {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    street: row.street,
    city: row.city,
    state: row.state ?? undefined,
    postalCode: row.postal_code ?? undefined,
    country: row.country,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AddressesService {
  constructor(private readonly database: IDatabase = db) {}

  /**
   * List all addresses belonging to the authenticated user.
   */
  async getAddresses(userId: string): Promise<Address[]> {
    const rows = this.database.query<AddressDbRow>(
      'SELECT id, user_id, label, street, city, state, postal_code, country, latitude, longitude, is_default, created_at, updated_at FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [userId]
    );
    return rows.map(mapRow);
  }

  /**
   * Create a new address for the authenticated user.
   * If marked as default, clears existing defaults first.
   */
  async createAddress(userId: string, input: CreateAddressInput): Promise<Address> {
    const isDefault = !!(input.is_default ?? input.isDefault);
    const postalCode = input.postal_code ?? input.postalCode;

    if (isDefault) {
      // Clear existing default addresses for this user
      this.database.run(
        'UPDATE addresses SET is_default = 0, updated_at = ? WHERE user_id = ? AND is_default = 1',
        [new Date().toISOString(), userId]
      );
    }

    const id = `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    this.database.run(
      'INSERT INTO addresses (id, user_id, label, street, city, state, postal_code, country, latitude, longitude, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        userId,
        input.label ?? 'Home',
        input.street,
        input.city,
        input.state ?? null,
        postalCode ?? null,
        input.country ?? 'IN',
        input.latitude ?? null,
        input.longitude ?? null,
        isDefault ? 1 : 0,
        now,
        now,
      ]
    );

    const created = this.database.queryOne<AddressDbRow>(
      'SELECT id, user_id, label, street, city, state, postal_code, country, latitude, longitude, is_default, created_at, updated_at FROM addresses WHERE id = ?',
      [id]
    );
    if (!created) throw AppError.internal('Failed to retrieve created address');
    return mapRow(created);
  }

  /**
   * Update an address. Only the owner may update.
   */
  async updateAddress(userId: string, addressId: string, input: UpdateAddressInput): Promise<Address> {
    const existing = this.database.queryOne<AddressDbRow>(
      'SELECT id, user_id, label, street, city, state, postal_code, country, latitude, longitude, is_default, created_at, updated_at FROM addresses WHERE id = ?',
      [addressId]
    );

    if (!existing) throw AppError.notFound('Address not found');
    if (existing.user_id !== userId) {
      throw AppError.forbidden('You do not have permission to update this address');
    }

    const isDefault = input.is_default ?? input.isDefault;
    const postalCode = input.postal_code ?? input.postalCode;

    if (isDefault) {
      this.database.run(
        'UPDATE addresses SET is_default = 0, updated_at = ? WHERE user_id = ? AND is_default = 1',
        [new Date().toISOString(), userId]
      );
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (input.label !== undefined) { setClauses.push('label = ?'); params.push(input.label); }
    if (input.street !== undefined) { setClauses.push('street = ?'); params.push(input.street); }
    if (input.city !== undefined) { setClauses.push('city = ?'); params.push(input.city); }
    if (input.state !== undefined) { setClauses.push('state = ?'); params.push(input.state); }
    if (postalCode !== undefined) { setClauses.push('postal_code = ?'); params.push(postalCode); }
    if (input.country !== undefined) { setClauses.push('country = ?'); params.push(input.country); }
    if (input.latitude !== undefined) { setClauses.push('latitude = ?'); params.push(input.latitude); }
    if (input.longitude !== undefined) { setClauses.push('longitude = ?'); params.push(input.longitude); }
    if (isDefault !== undefined) { setClauses.push('is_default = ?'); params.push(isDefault ? 1 : 0); }

    if (setClauses.length > 0) {
      const now = new Date().toISOString();
      setClauses.push('updated_at = ?');
      params.push(now);
      params.push(addressId);
      this.database.run(`UPDATE addresses SET ${setClauses.join(', ')} WHERE id = ?`, params);
    }

    const updated = this.database.queryOne<AddressDbRow>(
      'SELECT id, user_id, label, street, city, state, postal_code, country, latitude, longitude, is_default, created_at, updated_at FROM addresses WHERE id = ?',
      [addressId]
    );
    if (!updated) throw AppError.internal('Failed to retrieve updated address');
    return mapRow(updated);
  }

  /**
   * Delete an address. Only the owner may delete.
   */
  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const existing = this.database.queryOne<AddressDbRow>(
      'SELECT id, user_id FROM addresses WHERE id = ?',
      [addressId]
    );

    if (!existing) throw AppError.notFound('Address not found');
    if (existing.user_id !== userId) {
      throw AppError.forbidden('You do not have permission to delete this address');
    }

    this.database.run('DELETE FROM addresses WHERE id = ?', [addressId]);
  }
}

export const addressesService = new AddressesService();

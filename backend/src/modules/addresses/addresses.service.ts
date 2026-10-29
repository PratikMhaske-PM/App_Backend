import { defaultAddressRepository, IAddressRepository } from '../../repositories/address.repo';
import { Address } from '../../types/common.types';
import { AppError } from '../../utils/AppError';
import { AddressListResponseData, CreateAddressInput, UpdateAddressInput } from './addresses.types';

export class AddressesService {
  constructor(private readonly addressRepo: IAddressRepository = defaultAddressRepository) {}

  /**
   * API 22: GET /addresses
   * Role: All authenticated users
   * Retrieve addresses belonging strictly to the authenticated user.
   */
  async getAddresses(userId: string, page = 1, limit = 10): Promise<AddressListResponseData> {
    const allAddresses = await this.addressRepo.findByUserId(userId);

    const offset = (page - 1) * limit;
    const paginated = allAddresses.slice(offset, offset + limit);

    return {
      addresses: paginated,
      pagination: {
        page,
        limit,
        total: allAddresses.length,
        totalPages: Math.ceil(allAddresses.length / limit) || 1,
      },
    };
  }

  /**
   * API 23: POST /addresses
   * Role: All authenticated users
   * Create an address securely associated with the authenticated user.
   */
  async createAddress(userId: string, input: CreateAddressInput): Promise<Address> {
    const isDefault = input.is_default !== undefined ? input.is_default : !!input.isDefault;
    const postalCode = input.postal_code || input.postalCode;

    return this.addressRepo.create({
      userId,
      label: input.label || 'Home',
      street: input.street,
      city: input.city,
      state: input.state,
      postalCode,
      country: input.country || 'USA',
      isDefault,
      latitude: input.latitude,
      longitude: input.longitude,
    });
  }

  /**
   * API 24: PATCH /addresses/:id
   * Role: All authenticated users
   * Update address enforcing resource ownership check.
   */
  async updateAddress(
    id: string,
    userId: string,
    input: UpdateAddressInput
  ): Promise<Address> {
    const existing = await this.addressRepo.findById(id);
    if (!existing) {
      throw AppError.notFound(`Address with ID '${id}' not found`);
    }

    if (existing.userId !== userId) {
      throw AppError.forbidden('You do not have permission to modify this address');
    }

    const isDefault = input.is_default !== undefined ? input.is_default : input.isDefault;
    const postalCode = input.postal_code || input.postalCode;

    return this.addressRepo.update(id, {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.street !== undefined && { street: input.street }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.state !== undefined && { state: input.state }),
      ...(postalCode !== undefined && { postalCode }),
      ...(input.country !== undefined && { country: input.country }),
      ...(isDefault !== undefined && { isDefault }),
      ...(input.latitude !== undefined && { latitude: input.latitude }),
      ...(input.longitude !== undefined && { longitude: input.longitude }),
    });
  }

  /**
   * API 25: DELETE /addresses/:id
   * Role: All authenticated users
   * Delete address enforcing resource ownership check.
   */
  async deleteAddress(id: string, userId: string): Promise<void> {
    const existing = await this.addressRepo.findById(id);
    if (!existing) {
      throw AppError.notFound(`Address with ID '${id}' not found`);
    }

    if (existing.userId !== userId) {
      throw AppError.forbidden('You do not have permission to delete this address');
    }

    await this.addressRepo.delete(id);
  }
}

export const addressesService = new AddressesService();

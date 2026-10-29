import { Address } from '../../types/common.types';

export interface CreateAddressInput {
  label?: string;
  street: string;
  city: string;
  state?: string;
  postal_code?: string;
  postalCode?: string;
  country?: string;
  is_default?: boolean;
  isDefault?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface UpdateAddressInput {
  label?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  postalCode?: string;
  country?: string;
  is_default?: boolean;
  isDefault?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface AddressListResponseData {
  addresses: Address[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

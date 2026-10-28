/**
 * Domain representation of a saved address.
 */
export interface Address {
  id: string;
  userId: string;
  label: string;
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressInput {
  label?: string;
  street: string;
  city: string;
  state?: string;
  postal_code?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
  isDefault?: boolean;
}

export interface UpdateAddressInput {
  label?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
  isDefault?: boolean;
}

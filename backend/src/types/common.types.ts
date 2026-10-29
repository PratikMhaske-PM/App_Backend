/**
 * Standard API response envelope.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
}

/**
 * Domain representation of a User Account.
 */
export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  role: 'customer' | 'worker' | 'admin' | 'user' | string;
  name?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/**
 * Domain representation of a Service Category.
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Domain representation of a Worker Profile.
 */
export interface WorkerProfile {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  bio?: string;
  hourlyRate: number;
  experienceYears: number;
  isAvailable: boolean;
  availabilityStatus: 'available' | 'busy' | 'offline';
  verificationStatus: 'pending' | 'approved' | 'rejected';
  ratingAvg: number;
  reviewsCount: number;
  location?: string;
  createdAt: string;
  updatedAt: string;

  // Joined public fields
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  categoryName?: string;
  categorySlug?: string;
}

/**
 * Domain representation of a Booking.
 */
export interface Booking {
  id: string;
  customerId: string;
  workerId: string;
  categoryId: string;
  serviceDescription?: string;
  bookingDate: string;
  bookingTime?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'COMPLETED'
    | 'pending'
    | 'confirmed'
    | 'rejected'
    | 'cancelled'
    | 'completed'
    | string;
  notes?: string;
  totalPrice?: number;
  cancellationReason?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;

  // Joined detail fields
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  workerTitle?: string;
  workerName?: string;
  workerPhone?: string;
  categoryName?: string;
  categorySlug?: string;
}

/**
 * Domain representation of a Review.
 */
export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  workerId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;

  // Joined fields
  customerName?: string;
  workerTitle?: string;
}

/**
 * Worker dashboard statistics.
 */
export interface WorkerStats {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  totalEarnings: number;
  averageRating: number;
  totalReviews: number;
}

/**
 * Domain representation of a User Address.
 */
export interface Address {
  id: string;
  userId: string;
  label?: string; // e.g. "Home", "Work"
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Domain representation of a Worker KYC application.
 */
export interface KycApplication {
  id: string;
  workerId: string;
  documentType: 'id_card' | 'passport' | 'driving_license' | string;
  documentNumber: string;
  fullName: string;
  documentUrl?: string;
  expiryDate?: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

/**
 * Domain representation of an SOS Emergency Alert.
 */
export interface SosAlert {
  id: string;
  userId: string;
  emergencyType: string;
  latitude?: number;
  longitude?: number;
  bookingId?: string;
  notes?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
}

/**
 * Domain representation of a User Notification.
 */
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'booking' | 'alert' | 'system' | string;
  isRead: boolean;
  readAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}


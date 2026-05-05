
export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
}

export interface LoyaltyConfig {
  businessName: string;
  totalStamps: number;
  rewardDescription: string;
  themeColor: string;
  logo?: string; // Base64 string of the logo
}

export interface StampCard {
  id: string;
  userId: string;
  currentStamps: number;
  completed: boolean;
  redeemed: boolean;
  history: { date: string; action: 'STAMP' | 'REDEEM' | 'CREATED' | 'REMOVED' }[];
}

// Gemini specific types for AI generation
export interface AIStrategySuggestion {
  rewardName: string;
  totalStamps: number;
  marketingCopy: string;
}
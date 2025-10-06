// Landing Page Types and Interfaces

export interface LandingPageSettings {
  pageLayout: string;
  include3DEffects: boolean;
  pageTheme: string;
  accentColor: string;
  pageTitle: string;
  buttonText: string;
  heading1: {
    type: "none" | "tagline" | "newsletter" | "get_free_copy" | "custom";
    customText?: string;
  };
  heading2: {
    type: "none" | "tagline" | "subscribers" | "get_free_copy" | "custom";
    customText?: string;
  };
  popupMessage: {
    type: "none" | "default" | "custom";
    customText?: string;
  };
  pageText: {
    type: "none" | "book_description" | "custom";
    customText?: string;
  };
}

export interface DownloadPageSettings {
  pageName: string;
  expirationDate?: string;
  downloadLimit?: number;
  landingPageSettings: LandingPageSettings;
  advancedSettings?: {
    allowMultipleDownloads?: boolean;
    requireEmailVerification?: boolean;
    customRedirectUrl?: string;
  };
}

export interface EmailSignupPageSettings {
  pageName: string;
  mailingListAction: "none" | "optional" | "required";
  integrationList: string;
  expirationDate?: string;
  claimLimit?: number;
  askFirstName: boolean;
  askLastName: boolean;
  confirmEmail: boolean;
  landingPageSettings: LandingPageSettings;
  thankYouPageSettings?: {
    title: string;
    message: string;
    buttonText: string;
    redirectUrl?: string;
  };
  advancedSettings?: {
    doubleOptIn?: boolean;
    customThankYouMessage?: string;
    autoResponder?: boolean;
  };
}

export interface RestrictedPageSettings {
  pageName: string;
  restrictedList: string;
  redirectUrl?: string;
  expirationDate?: string;
  downloadLimit?: number;
  confirmEmail: boolean;
  landingPageSettings: LandingPageSettings;
  deliveryPageSettings?: {
    title: string;
    message: string;
    downloadButtonText: string;
    showDownloadCount?: boolean;
  };
  advancedSettings?: {
    allowBookmarking?: boolean;
    customRestrictionMessage?: string;
    requireEmailVerification?: boolean;
  };
}

export interface UniversalBookLinkSettings {
  linkName: string;
  selectedBook: string;
  audioSample: string;
  displayEbookLinks: boolean;
  displayAudiobookLinks: boolean;
  displayPaperbackLinks: boolean;
  expirationDate?: string;
  landingPageSettings: LandingPageSettings;
  advancedSettings?: {
    trackClicks?: boolean;
    customDomain?: string;
    analyticsEnabled?: boolean;
  };
}

export type LandingPageType =
  | "simple_download"
  | "email_signup"
  | "restricted"
  | "universal_link";

export interface LandingPageData {
  _id?: string;
  bookId: string;
  userId: string;
  type: LandingPageType;
  isActive: boolean;
  slug: string;
  url?: string;
  createdAt?: Date;
  updatedAt?: Date;

  // Type-specific settings
  downloadPage?: DownloadPageSettings;
  emailSignupPage?: EmailSignupPageSettings;
  restrictedPage?: RestrictedPageSettings;
  universalBookLink?: UniversalBookLinkSettings;

  // Analytics
  analytics: {
    totalViews: number;
    totalConversions: number;
    uniqueVisitors: number;
    lastAccessed?: Date;
  };
}

export interface CreateLandingPageRequest {
  bookId: string;
  type: LandingPageType;
  downloadPage?: DownloadPageSettings;
  emailSignupPage?: EmailSignupPageSettings;
  restrictedPage?: RestrictedPageSettings;
  universalBookLink?: UniversalBookLinkSettings;
}

export interface UpdateLandingPageRequest {
  isActive?: boolean;
  downloadPage?: Partial<DownloadPageSettings>;
  emailSignupPage?: Partial<EmailSignupPageSettings>;
  restrictedPage?: Partial<RestrictedPageSettings>;
  universalBookLink?: Partial<UniversalBookLinkSettings>;
}

export interface LandingPageListQuery {
  page?: number;
  limit?: number;
  bookId?: string;
  type?: LandingPageType;
  isActive?: boolean;
}

export interface LandingPageAnalytics {
  totalViews: number;
  totalConversions: number;
  emailCaptures: number;
  uniqueVisitors: number;
  conversionRate: number;
  eventsByType: Record<string, number>;
  eventsByDate: Record<string, number>;
}

export interface LandingPagePreview {
  id: string;
  title: string;
  type: LandingPageType;
  slug: string;
  url: string;
  isActive: boolean;
  analytics: {
    totalViews: number;
    totalConversions: number;
  };
  book: {
    title: string;
    author: string;
    coverImageUrl?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

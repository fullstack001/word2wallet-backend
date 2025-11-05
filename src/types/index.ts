import { Request } from "express";
import { Document } from "mongoose";
import mongoose from "mongoose";

// User Types
export interface IUser extends Document {
  _id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  emailUnsubscribed: boolean;
  emailUnsubscribedAt?: Date;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationTokenExpiry?: Date;
  emailVerificationCode?: string;
  emailVerificationCodeExpiry?: Date;
  passwordResetToken?: string;
  passwordResetTokenExpiry?: Date;
  subscription?: ISubscription;
  trialEligible: boolean;
  hasCanceledSubscription: boolean;
  createdAt: Date;
  updatedAt: Date;
  fullName: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  updateLastLogin(): Promise<IUser>;
  generateEmailVerificationToken(): Promise<IUser>;
  verifyEmail(): Promise<IUser>;
  generatePasswordResetToken(): Promise<IUser>;
  clearPasswordResetToken(): Promise<IUser>;
}

// Subscription Types
export interface ISubscription {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  trialStart?: Date;
  trialEnd?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date;
  cancellationReason?: string;
  cancellationFeedback?: string;
}

export enum SubscriptionStatus {
  TRIALING = "trialing",
  ACTIVE = "active",
  PAST_DUE = "past_due",
  CANCELED = "canceled",
  UNPAID = "unpaid",
  INCOMPLETE = "incomplete",
  INCOMPLETE_EXPIRED = "incomplete_expired",
  PAUSED = "paused",
}

export enum SubscriptionPlan {
  FREE = "free",
  PRO = "pro",
  PREMIUM = "premium",
}

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

// Subject Types
export interface ISubject extends Document {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubjectModel extends mongoose.Model<ISubject> {
  findActive(): mongoose.Query<ISubject[], ISubject>;
}

// Chapter Types
export interface IChapter {
  id: string;
  title: string;
  description: string;
  content: string;
}

// Course Types
export interface ICourse extends Document {
  _id: string;
  title: string;
  slug?: string;
  url?: string; // Virtual field for full URL
  description?: string;
  subject: mongoose.Types.ObjectId; // Subject ID
  epubFile?: string; // File path
  epubMetadata?: EpubMetadata;
  epubCover?: string; // Cover image path
  chapters: IChapter[];
  multimediaContent?: MultimediaContent;
  isActive: boolean;
  isPublished: boolean;
  googleDocLink?: string;
  googleClassroomLink?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICourseModel extends mongoose.Model<ICourse> {
  findPublished(): mongoose.Query<ICourse[], ICourse>;
  search(query: string): mongoose.Query<ICourse[], ICourse>;
}

export interface EpubMetadata {
  title: string;
  creator: string;
  subject?: string;
  description?: string;
  publisher?: string;
  date?: string;
  language?: string;
  rights?: string;
  identifier?: string;
  format?: string;
  source?: string;
  relation?: string;
  coverage?: string;
  contributor?: string;
  type?: string;
  coverImage?: string;
  totalPages?: number;
  fileSize?: number;
  lastModified?: Date;
  wordCount?: number;
}

export interface MultimediaContent {
  images: MediaFile[];
  audio: MediaFile[];
  video: MediaFile[];
}

export interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploadedAt: Date;
}

// JWT Types
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

// Request Types
export interface AuthRequest extends Request {
  user?: IUser;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// File Upload Types
export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
}

// Query Types
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface CourseQuery extends PaginationQuery {
  subject?: string;
  search?: string;
  isPublished?: boolean;
  isActive?: boolean;
}

export interface SubjectQuery extends PaginationQuery {
  search?: string;
  isActive?: boolean;
}

// Auction Types
export enum AuctionStatus {
  SCHEDULED = "scheduled",
  ACTIVE = "active",
  PAUSED = "paused",
  ENDED = "ended",
  ENDED_NO_SALE = "ended_no_sale",
  SOLD = "sold",
  SOLD_BUY_NOW = "sold_buy_now",
  SOLD_OFFER = "sold_offer",
  CANCELLED = "cancelled",
}

export enum BidStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  OUTBID = "outbid",
}

export enum OfferStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
  COUNTERED = "countered",
}

export interface IAuction extends Document {
  _id: string;
  title: string;
  description: string;
  currency: string;
  startingPrice: number;
  reservePrice?: number;
  buyNowPrice?: number;
  currentBid?: number;
  highBidder?: mongoose.Types.ObjectId;
  status: AuctionStatus;
  startTime: Date;
  endTime: Date;
  extendSeconds: number; // Anti-sniping extension
  minIncrement: number;
  timeRemaining?: number; // Virtual field for time remaining
  reserveMet?: boolean; // Virtual field for reserve met status
  onlineCount?: number; // Virtual field for online count
  images?: string[]; // Array of image URLs
  bids: mongoose.Types.ObjectId[];
  offers: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBid extends Document {
  _id: string;
  auction: mongoose.Types.ObjectId;
  bidder: mongoose.Types.ObjectId;
  amount: number;
  status: BidStatus;
  timestamp: Date;
  ipAddress: string;
  userAgent?: string;
  shippingInfo?: {
    country: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IOffer extends Document {
  _id: string;
  auction: mongoose.Types.ObjectId;
  buyer: mongoose.Types.ObjectId;
  amount: number;
  status: OfferStatus;
  expiresAt: Date;
  counterOffer?: mongoose.Types.ObjectId;
  isExpired?: boolean; // Virtual field for expired status
  createdAt: Date;
  updatedAt: Date;
}

// Auction Snapshot for API responses
export interface AuctionSnapshot {
  id: string;
  title: string;
  currency: string;
  highBid: number;
  leader: {
    id: string;
    name: string;
  } | null;
  online: number;
  start: Date;
  end: Date;
  reserveMet: boolean;
  status: AuctionStatus;
  buyNowPrice?: number;
  timeRemaining: number;
}

// WebSocket Message Types
export interface WSMessage {
  type:
    | "snapshot"
    | "bid_update"
    | "offer_update"
    | "error"
    | "pong"
    | "book_status_update";
  data: any;
  auctionId?: string;
  bookId?: string;
}

export interface BidRequest {
  amount: number;
}

export interface OfferRequest {
  amount: number;
}

export interface CounterOfferRequest {
  amount: number;
}

// Book Management Types
export interface IBook extends Document {
  _id: string;
  userId: string;
  title: string;
  author: string;
  description?: string;
  isbn?: string;
  publisher?: string;
  publicationDate?: Date;
  language: string;
  genre?: string[];
  tags?: string[];

  // New book information fields
  label?: string; // Book label or subtitle
  series?: string; // Book series name
  volume?: string; // Volume number in series
  tagline?: string; // Book tagline or catchphrase
  notesToReaders?: string; // Special notes to readers
  bookType?: BookType; // Type of book (advance_copy, excerpt, etc.)
  ebookType?: "doc" | "audio"; // Ebook type: document/book or audio book
  narrator?: string; // Audio narrator name
  audioQuality?: string; // Audio quality for distribution

  // Cover image fields (only 1 allowed)
  coverImageKey?: string; // S3 key for cover image
  coverImageName?: string; // Original cover image filename
  coverImageSize?: number; // Cover image file size

  // File fields (only 1 epub and 1 PDF allowed for regular books, 1 audio file for audio books)
  epubFile?: {
    fileKey?: string;
    fileName?: string;
    fileSize?: number;
    checksum?: string;
    uploadedAt?: Date;
  };
  pdfFile?: {
    fileKey?: string;
    fileName?: string;
    fileSize?: number;
    checksum?: string;
    uploadedAt?: Date;
  };
  audioFile?: {
    fileKey?: string;
    fileName?: string;
    fileSize?: number;
    checksum?: string;
    uploadedAt?: Date;
  };

  // Legacy fields for backward compatibility
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: BookFileType;
  checksum?: string;
  metadata: {
    title: string;
    creator: string;
    subject?: string;
    description?: string;
    publisher?: string;
    date?: string;
    language?: string;
    rights?: string;
    identifier?: string;
    format?: string;
    source?: string;
    relation?: string;
    coverage?: string;
    contributor?: string;
    type?: string;
  };
  status: BookStatus;
  uploadDate: Date;
  lastModified: Date;
  coverImageUrl?: string;
  pageCount?: number;
  wordCount?: number;
  readingTime?: number;
  fileUrl: string;
  // Delivery features
  isPublic: boolean;
  allowEmailCapture: boolean;
  deliverySettings: {
    requireEmail: boolean;
    allowAnonymous: boolean;
    maxDownloads?: number;
    expiryDate?: Date;
  };
}

export enum BookStatus {
  DRAFT = "draft",
  UPLOADING = "uploading",
  PROCESSING = "processing",
  READY = "ready",
  ERROR = "error",
  DELETED = "deleted",
}

export enum BookFileType {
  EPUB = "epub",
  PDF = "pdf",
  AUDIO = "audio",
}

export enum BookType {
  ADVANCE_COPY = "advance_copy",
  EXCERPT = "excerpt",
  FULL_BOOK = "full_book",
  NOVELLA = "novella",
  PREVIEW = "preview",
  SAMPLE = "sample",
  SHORT_STORY = "short_story",
  TEASER = "teaser",
  OTHER = "other",
}

// Delivery Link Types
export interface IDeliveryLink extends Document {
  _id: string;
  bookId: string;
  userId: string;
  title: string;
  description?: string;
  slug: string;
  isActive: boolean;
  settings: {
    requireEmail: boolean;
    allowAnonymous: boolean;
    maxDownloads?: number;
    expiryDate?: Date;
    password?: string;
  };
  analytics: {
    totalViews: number;
    totalDownloads: number;
    uniqueVisitors: number;
    emailCaptures: number;
    lastAccessed?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  url: string;
}

// Landing Page Types - Export from landingPage.ts
export * from "./landingPage";

// Analytics Types
export interface IBookAnalytics extends Document {
  _id: string;
  bookId: string;
  userId: string;
  deliveryLinkId?: string;
  landingPageId?: string;
  eventType: AnalyticsEventType;
  eventData: {
    timestamp: Date;
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
    os?: string;
    email?: string;
    downloadUrl?: string;
    streamDuration?: number;
    pageViews?: number;
    conversionType?: string;
  };
  createdAt: Date;
}

export enum AnalyticsEventType {
  PAGE_VIEW = "page_view",
  DOWNLOAD = "download",
  EMAIL_CAPTURE = "email_capture",
  STREAM_START = "stream_start",
  STREAM_COMPLETE = "stream_complete",
  LINK_CLICK = "link_click",
  CONVERSION = "conversion",
  BOUNCE = "bounce",
}

// Email Capture Types
export interface IEmailCapture extends Document {
  _id: string;
  bookId: string;
  userId: string;
  deliveryLinkId?: string;
  landingPageId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string; // Virtual field for full name
  bookTitle?: string; // Virtual field for book title
  source: string;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    city?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  };
  status: EmailCaptureStatus;
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum EmailCaptureStatus {
  NEW = "new",
  CONTACTED = "contacted",
  CONVERTED = "converted",
  UNSUBSCRIBED = "unsubscribed",
  BOUNCED = "bounced",
}

// Integration Types
export interface IIntegration extends Document {
  _id: string;
  userId: string;
  provider: IntegrationProvider;
  apiKey: string;
  status: IntegrationStatus;
  settings?: {
    [key: string]: any;
  };
  lastSync?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  decryptedApiKey: string;
  updateLastSync(): Promise<IIntegration>;
  setError(errorMessage: string): Promise<IIntegration>;
  clearError(): Promise<IIntegration>;
}

export enum IntegrationProvider {
  WordToWallet = "WordToWallet",
  AMAZON_KDP = "amazon_kdp",
  DRAFT2DIGITAL = "draft2digital",
  SMASHWORDS = "smashwords",
  // Email Marketing Providers
  MAILCHIMP = "mailchimp",
  CONVERTKIT = "convertkit",
  ACTIVE_CAMPAIGN = "active_campaign",
  DRIP = "drip",
  SENDINBLUE = "sendinblue",
  // Payment Gateways
  STRIPE = "stripe",
  PAYPAL = "paypal",
  SQUARE = "square",
  RAZORPAY = "razorpay",
}

export enum IntegrationStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ERROR = "error",
  PENDING = "pending",
}

// ARC Link Types
export interface IArcLink extends Document {
  _id: string;
  bookId: string;
  userId: string;
  code: string;
  url: string;
  campaignId?: string;
  expiresAt?: Date;
  maxDownloads?: number;
  downloadsCount: number;
  status: ArcLinkStatus;
  metadata: {
    title: string;
    author: string;
    format: string;
    description?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  isExpired: boolean;
  isMaxDownloadsReached: boolean;
  isAccessible: boolean;
  incrementDownload(): Promise<IArcLink>;
  checkStatus(): Promise<IArcLink>;
}

export enum ArcLinkStatus {
  ACTIVE = "active",
  EXPIRED = "expired",
  MAX_DOWNLOADS_REACHED = "max_downloads_reached",
  DISABLED = "disabled",
  ERROR = "error",
}

// Job Types
export interface IJob extends Document {
  _id: string;
  type: JobType;
  status: JobStatus;
  userId: string;
  bookId?: string;
  arcLinkId?: string;
  progress: number;
  data: {
    [key: string]: any;
  };
  result?: {
    [key: string]: any;
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  canRetry: boolean;
  isInProgress: boolean;
  updateProgress(progress: number): Promise<IJob>;
  markProcessing(): Promise<IJob>;
  markCompleted(result?: any): Promise<IJob>;
  markFailed(error: {
    message: string;
    stack?: string;
    code?: string;
  }): Promise<IJob>;
  cancel(): Promise<IJob>;
}

export enum JobType {
  EPUB_VALIDATION = "epub_validation",
  EPUB_PACKAGING = "epub_packaging",
}

export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  RETRYING = "retrying",
  CANCELLED = "cancelled",
}

// Book Query Types
export interface BookQuery extends PaginationQuery {
  search?: string;
  status?: BookStatus;
  genre?: string;
  language?: string;
  author?: string;
}

// ARC Link Query Types
export interface ArcLinkQuery extends PaginationQuery {
  bookId?: string;
  status?: ArcLinkStatus;
  expired?: boolean;
}

// Job Query Types
export interface JobQuery extends PaginationQuery {
  type?: JobType;
  status?: JobStatus;
  bookId?: string;
}

// Blog Types
export interface IBlog extends Document {
  _id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  tags: string[];
  status: "draft" | "published";
  author: mongoose.Types.ObjectId;
  views: number;
  reactionsCount: number;
  commentsCount: number;
  isActive: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
  incrementViews(): Promise<IBlog>;
}

export interface IBlogModel extends mongoose.Model<IBlog> {
  findPublished(): mongoose.Query<IBlog[], IBlog>;
  findRelated(
    blogId: string,
    tags: string[],
    limit?: number
  ): mongoose.Query<IBlog[], IBlog>;
}

// Comment Types
export interface IComment extends Document {
  _id: string;
  blog: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId; // Optional for anonymous comments
  anonymousName?: string; // For anonymous comments
  anonymousEmail?: string; // For anonymous comments
  content: string;
  parent?: mongoose.Types.ObjectId | null;
  likes: number;
  likedBy: mongoose.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  replies?: IComment[];
  toggleLike(userId: string): Promise<IComment>;
}

// Reaction Types
export interface IReaction extends Document {
  _id: string;
  blog: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  type: "like" | "love" | "thumbsup" | "thumbsdown";
  createdAt: Date;
  updatedAt: Date;
}

// Blog Query Types
export interface BlogQuery extends PaginationQuery {
  search?: string;
  status?: "draft" | "published";
  tag?: string;
  author?: string;
}

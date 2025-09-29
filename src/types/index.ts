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
  subscription?: ISubscription;
  trialEligible: boolean;
  hasCanceledSubscription: boolean;
  createdAt: Date;
  updatedAt: Date;
  fullName: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  updateLastLogin(): Promise<IUser>;
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
  author: string;
  publisher?: string;
  language: string;
  description?: string;
  coverImage?: string;
  totalPages?: number;
  fileSize?: number;
  lastModified?: Date;
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
  type: "snapshot" | "bid_update" | "offer_update" | "error" | "pong";
  data: any;
  auctionId: string;
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

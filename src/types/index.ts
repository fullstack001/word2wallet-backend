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
  createdAt: Date;
  updatedAt: Date;
  fullName: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  updateLastLogin(): Promise<IUser>;
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
  description: string;
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
  description: string;
  subject: mongoose.Types.ObjectId; // Subject ID
  epubFile?: string; // File path
  epubMetadata?: EpubMetadata;
  epubCover?: string; // Cover image path
  chapters: IChapter[];
  multimediaContent?: MultimediaContent;
  isActive: boolean;
  isPublished: boolean;
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

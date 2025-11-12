import { Request, Response } from "express";
import { validationResult } from "express-validator";
import multer from "multer";
import path from "path";
import fs from "fs";
import csv from "csv-parser";
import * as XLSX from "xlsx";
import {
  EmailCampaign,
  CampaignReceiver,
  IEmailCampaign,
  ICampaignReceiver,
} from "../models/EmailCampaign";
import { Book } from "../models/Book";
import { WrittenBook } from "../models/WrittenBook";
import { AuthRequest, ApiResponse } from "../types";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/temp");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "receivers-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".csv", ".xlsx", ".xls"];
    const fileExt = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"));
    }
  },
});

export class EmailCampaignController {
  static upload = upload;

  /**
   * Create a new email campaign
   */
  static async createCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        } as ApiResponse);
        return;
      }

      const userId = req.user!._id;
      const {
        name,
        subject,
        content,
        books = [],
        selectedLink,
        settings = {},
        scheduledAt,
      } = req.body;

      // Validate books exist and belong to user
      if (books.length > 0) {
        const validBooks = await Book.find({
          _id: { $in: books },
          userId: userId,
        });

        if (validBooks.length !== books.length) {
          res.status(400).json({
            success: false,
            message: "One or more books not found or don't belong to you",
          } as ApiResponse);
          return;
        }
      }

      // Use default sender info to avoid spam
      const DEFAULT_SENDER_NAME =
        process.env.DEFAULT_SENDER_NAME || "Word2Wallet";
      const DEFAULT_SENDER_EMAIL =
        process.env.MAILGUN_FROM_EMAIL ||
        process.env.DEFAULT_SENDER_EMAIL ||
        "noreply@word2wallet.com";
      const DEFAULT_SENDER_COMPANY =
        process.env.DEFAULT_SENDER_COMPANY || "Word2Wallet";

      const campaign = new EmailCampaign({
        userId,
        name,
        subject,
        content,
        books,
        selectedLink,
        senderInfo: {
          name: DEFAULT_SENDER_NAME,
          email: DEFAULT_SENDER_EMAIL,
          company: DEFAULT_SENDER_COMPANY,
        },
        settings: {
          trackOpens: settings.trackOpens !== false,
          trackClicks: settings.trackClicks !== false,
          unsubscribeLink: settings.unsubscribeLink !== false,
          replyTo: settings.replyTo,
        },
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        analytics: {
          totalRecipients: 0,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0,
          failed: 0,
        },
      });

      await campaign.save();

      // Note: Campaign will be sent automatically after receivers are uploaded

      res.status(201).json({
        success: true,
        message: "Campaign created successfully",
        data: campaign,
      } as ApiResponse);
    } catch (error) {
      console.error("Create campaign error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create campaign",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get all campaigns for a user
   */
  static async getCampaigns(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const {
        page = 1,
        limit = 10,
        search,
        status,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const query: any = { userId };

      // Apply filters
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { subject: { $regex: search, $options: "i" } },
        ];
      }

      if (status) {
        query.status = status;
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

      const campaigns = await EmailCampaign.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate("books", "title author");

      const total = await EmailCampaign.countDocuments(query);

      res.json({
        success: true,
        message: "Campaigns retrieved successfully",
        data: {
          campaigns,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Get campaigns error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve campaigns",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get a single campaign by ID
   */
  static async getCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const campaign = await EmailCampaign.findOne({
        _id: id,
        userId: userId,
      }).populate("books", "title author files");

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: "Campaign not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Campaign retrieved successfully",
        data: campaign,
      } as ApiResponse);
    } catch (error) {
      console.error("Get campaign error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve campaign",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Update a campaign
   */
  static async updateCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        } as ApiResponse);
        return;
      }

      const userId = req.user!._id;
      const { id } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData.userId;
      delete updateData.analytics;
      delete updateData.receivers;

      const campaign = await EmailCampaign.findOneAndUpdate(
        { _id: id, userId: userId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: "Campaign not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Campaign updated successfully",
        data: campaign,
      } as ApiResponse);
    } catch (error) {
      console.error("Update campaign error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update campaign",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Delete a campaign
   */
  static async deleteCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      const campaign = await EmailCampaign.findOneAndDelete({
        _id: id,
        userId: userId,
      });

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: "Campaign not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: "Campaign deleted successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Delete campaign error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete campaign",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Upload receivers from CSV/Excel file
   */
  static async uploadReceivers(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No file uploaded",
        } as ApiResponse);
        return;
      }

      const userId = req.user!._id;
      const { campaignId } = req.params;
      const filePath = req.file.path;
      const fileExt = path.extname(req.file.originalname).toLowerCase();

      // Find campaign
      const campaign = await EmailCampaign.findOne({
        _id: campaignId,
        userId: userId,
      });

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: "Campaign not found",
        } as ApiResponse);
        return;
      }

      let receivers: ICampaignReceiver[] = [];

      if (fileExt === ".csv") {
        receivers = await EmailCampaignController.parseCSVFile(filePath);
      } else if ([".xlsx", ".xls"].includes(fileExt)) {
        receivers = await EmailCampaignController.parseExcelFile(filePath);
      }

      // Clear existing receivers
      campaign.receivers = [];

      // Add new receivers
      campaign.receivers = receivers;
      campaign.analytics.totalRecipients = receivers.length;

      await campaign.save();

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      // Check if campaign should be sent immediately (no schedule)
      const isScheduled =
        campaign.scheduledAt && campaign.scheduledAt > new Date();

      if (
        !isScheduled &&
        receivers.length > 0 &&
        campaign.books &&
        campaign.books.length > 0
      ) {
        // Send campaign immediately in the background
        EmailCampaignController.sendCampaignImmediately(
          campaign._id.toString()
        ).catch((error) => {
          console.error("Error sending campaign immediately:", error);
        });
      }

      res.json({
        success: true,
        message: "Receivers uploaded successfully",
        data: {
          count: receivers.length,
          campaignId: campaign._id,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Upload receivers error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload receivers",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Parse CSV file
   */
  private static async parseCSVFile(
    filePath: string
  ): Promise<ICampaignReceiver[]> {
    return new Promise((resolve, reject) => {
      const receivers: ICampaignReceiver[] = [];
      const stream = fs.createReadStream(filePath);

      stream
        .pipe(csv())
        .on("data", (row) => {
          const email = row.email || row.Email || row.EMAIL;
          if (email && EmailCampaignController.isValidEmail(email)) {
            receivers.push({
              email: email.toLowerCase().trim(),
              firstName:
                row.firstName || row.first_name || row["First name"] || "",
              lastName: row.lastName || row.last_name || row["Last name"] || "",
              customFields: Object.keys(row)
                .filter(
                  (key) =>
                    ![
                      "email",
                      "firstName",
                      "lastName",
                      "first_name",
                      "last_name",
                      "First name",
                      "Last name",
                      "Email",
                    ].includes(key)
                )
                .reduce((obj, key) => {
                  obj[key] = row[key];
                  return obj;
                }, {} as Record<string, any>),
              status: "pending",
            } as ICampaignReceiver);
          }
        })
        .on("end", () => {
          resolve(receivers);
        })
        .on("error", (error) => {
          reject(error);
        });
    });
  }

  /**
   * Parse Excel file
   */
  private static async parseExcelFile(
    filePath: string
  ): Promise<ICampaignReceiver[]> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const receivers: ICampaignReceiver[] = [];

    for (const row of data as any[]) {
      const email = row.email || row.Email || row.EMAIL;
      if (email && EmailCampaignController.isValidEmail(email)) {
        receivers.push({
          email: email.toLowerCase().trim(),
          firstName: row.firstName || row.first_name || row["First Name"] || "",
          lastName: row.lastName || row.last_name || row["Last Name"] || "",
          customFields: Object.keys(row)
            .filter(
              (key) =>
                ![
                  "email",
                  "firstName",
                  "lastName",
                  "first_name",
                  "last_name",
                  "First Name",
                  "Last Name",
                  "Email",
                ].includes(key)
            )
            .reduce((obj, key) => {
              obj[key] = row[key];
              return obj;
            }, {} as Record<string, any>),
          status: "pending",
        } as ICampaignReceiver);
      }
    }

    return receivers;
  }

  /**
   * Validate email address
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get user's books for campaign selection
   */
  static async getUserBooks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { type = "all" } = req.query;

      let query: any = { userId };

      // Only get regular books for campaigns (not written books)
      const books = await Book.find(query).select(
        "_id title author description status createdAt"
      );

      // Format the results
      const allBooks = books.map((book) => ({
        ...book.toObject(),
        type: "uploaded",
      }));

      res.json({
        success: true,
        message: "Books retrieved successfully",
        data: allBooks,
      } as ApiResponse);
    } catch (error) {
      console.error("Get user books error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve books",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Get landing pages and delivery links for a specific book
   */
  static async getBookLinks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { bookId } = req.params;

      // Import models
      const { LandingPage } = await import("../models/LandingPage");
      const { DeliveryLink } = await import("../models/DeliveryLink");

      // Fetch landing pages and delivery links for the book
      const [landingPages, deliveryLinks] = await Promise.all([
        LandingPage.find({ bookId, userId }).select(
          "_id title slug url type isActive createdAt"
        ),
        DeliveryLink.find({ bookId, userId }).select(
          "_id title slug url isActive createdAt"
        ),
      ]);

      // Format the results
      const links = [
        // Add default reader link
        {
          _id: "reader",
          linkType: "reader" as const,
          displayName: "Reader Link",
          url: `https://read.wordtowallet.com/${bookId}`,
          isActive: true,
          createdAt: new Date(),
        },
        ...landingPages.map((page) => ({
          ...page.toObject(),
          linkType: "landing_page" as const,
          displayName: page.title || `Landing Page - ${page.type}`,
          url: `https://ld.wordtowallet.com/${page._id}`,
        })),
        ...deliveryLinks.map((link) => ({
          ...link.toObject(),
          linkType: "delivery_link" as const,
          displayName: link.title,
          url: link.url || `https://wordtowallet.com/book/${link.slug}`,
        })),
      ];

      res.json({
        success: true,
        message: "Book links retrieved successfully",
        data: links,
      } as ApiResponse);
    } catch (error) {
      console.error("Get book links error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve book links",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Send campaign to all receivers
   */
  static async sendCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { id } = req.params;

      // Find campaign
      const campaign = await EmailCampaign.findOne({
        _id: id,
        userId: userId,
      }).populate("books", "title author files epubFile pdfFile");

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: "Campaign not found",
        } as ApiResponse);
        return;
      }

      // Check if campaign has receivers
      if (!campaign.receivers || campaign.receivers.length === 0) {
        res.status(400).json({
          success: false,
          message: "No receivers added to this campaign",
        } as ApiResponse);
        return;
      }

      // Check if campaign has books
      if (!campaign.books || campaign.books.length === 0) {
        res.status(400).json({
          success: false,
          message: "No books attached to this campaign",
        } as ApiResponse);
        return;
      }

      // Determine if campaign should be sent now or scheduled
      const now = new Date();
      const isScheduled = campaign.scheduledAt && campaign.scheduledAt > now;

      if (isScheduled) {
        // Update campaign status to scheduled
        campaign.status = "scheduled";
        await campaign.save();

        res.json({
          success: true,
          message: "Campaign scheduled successfully",
          data: {
            campaignId: campaign._id,
            scheduledAt: campaign.scheduledAt,
            totalRecipients: campaign.analytics.totalRecipients,
          },
        } as ApiResponse);
        return;
      }

      // Send campaign immediately
      campaign.status = "sending";
      await campaign.save();

      // Send emails to all receivers
      const results = await EmailCampaignController.sendEmailsToReceivers(
        campaign
      );

      // Update campaign status and analytics
      campaign.status = "sent";
      campaign.sentAt = new Date();
      campaign.analytics.sent = results.sentCount;
      campaign.analytics.failed = results.failedCount;
      await campaign.save();

      res.json({
        success: true,
        message: "Campaign sent successfully",
        data: {
          campaignId: campaign._id,
          sent: results.sentCount,
          failed: results.failedCount,
        },
      } as ApiResponse);
    } catch (error) {
      console.error("Send campaign error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send campaign",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }

  /**
   * Send emails to all receivers in the campaign
   */
  private static async sendEmailsToReceivers(
    campaign: IEmailCampaign
  ): Promise<{ sentCount: number; failedCount: number }> {
    const results = { sentCount: 0, failedCount: 0 };
    const { EmailService } = await import("../services/emailService");

    for (const receiver of campaign.receivers) {
      try {
        // Replace variables in email content
        let emailContent = campaign.content;
        emailContent = EmailCampaignController.replaceVariables(
          emailContent,
          receiver,
          campaign.senderInfo,
          campaign.selectedLink
        );

        // Get book attachment
        const bookAttachment = await EmailCampaignController.getBookAttachment(
          campaign.books[0]
        );

        // Send email with campaign subject and content
        const emailOptions: any = {
          to: receiver.email,
          subject: campaign.subject,
          html: emailContent,
          from: `${campaign.senderInfo.name} <${campaign.senderInfo.email}>`,
          replyTo: campaign.settings.replyTo || campaign.senderInfo.email,
        };

        // Attach book if available
        if (bookAttachment) {
          // Convert to plain object to access properties
          const book = bookAttachment.toObject
            ? bookAttachment.toObject()
            : bookAttachment;

          // Handle different book types
          let attachmentFile = null;

          // For regular Book model
          if (book.epubFile && typeof book.epubFile === "object") {
            // epubFile is an object with fileKey
            const fileKey = book.epubFile.fileKey || book.epubFile.fileName;
            if (fileKey) {
              attachmentFile = {
                filename: `${book.title || "book"}.epub`,
                path: path.join(__dirname, "../../uploads/books", fileKey),
              };
            }
          }
          // For WrittenBook model
          else if (book.files && book.files.epub) {
            attachmentFile = {
              filename: `${book.title || "book"}.epub`,
              path: path.join(
                __dirname,
                "../../uploads/generated-books",
                book.files.epub.path
              ),
            };
          }

          if (attachmentFile) {
            emailOptions.attachments = [attachmentFile];
          }
        }

        await EmailService.sendEmail(emailOptions);

        // Update receiver status
        receiver.status = "sent";
        receiver.sentAt = new Date();
        results.sentCount++;
      } catch (error) {
        console.error(`Failed to send email to ${receiver.email}:`, error);
        receiver.status = "failed";
        receiver.errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        results.failedCount++;
      }
    }

    // Save updated campaign with receiver statuses
    await campaign.save();

    return results;
  }

  /**
   * Replace variables in email content with actual values
   */
  private static replaceVariables(
    content: string,
    receiver: ICampaignReceiver,
    senderInfo: IEmailCampaign["senderInfo"],
    selectedLink?: IEmailCampaign["selectedLink"]
  ): string {
    let result = content;

    // Replace receiver variables
    result = result.replace(/\{\{FirstName\}\}/g, receiver.firstName || "");
    result = result.replace(/\{\{LastName\}\}/g, receiver.lastName || "");
    result = result.replace(
      /\{\{FullName\}\}/g,
      `${receiver.firstName || ""} ${receiver.lastName || ""}`.trim() ||
        receiver.email
    );
    result = result.replace(/\{\{Email\}\}/g, receiver.email);

    // Replace sender variables
    result = result.replace(/\{\{SenderEmail\}\}/g, senderInfo.email || "");

    // Replace attachment link with selected link URL
    const attachmentLink = selectedLink?.linkUrl || "#";
    result = result.replace(/\{\{AttachmentLink\}\}/g, attachmentLink);

    return result;
  }

  /**
   * Send campaign immediately after creation (background task)
   */
  private static async sendCampaignImmediately(
    campaignId: string
  ): Promise<void> {
    try {
      const campaign = await EmailCampaign.findById(campaignId).populate(
        "books",
        "title author files epubFile pdfFile"
      );

      if (!campaign) {
        console.error(`Campaign ${campaignId} not found`);
        return;
      }

      // Check if campaign has receivers and books
      if (!campaign.receivers || campaign.receivers.length === 0) {
        console.log(`Campaign ${campaignId} has no receivers, skipping send`);
        return;
      }

      if (!campaign.books || campaign.books.length === 0) {
        console.log(`Campaign ${campaignId} has no books, skipping send`);
        return;
      }

      // Mark campaign as sending
      campaign.status = "sending";
      await campaign.save();

      // Send emails to all receivers
      const results = await EmailCampaignController.sendEmailsToReceivers(
        campaign
      );

      // Update campaign status and analytics
      campaign.status = "sent";
      campaign.sentAt = new Date();
      campaign.analytics.sent = results.sentCount;
      campaign.analytics.failed = results.failedCount;
      await campaign.save();

      console.log(
        `Campaign ${campaignId} sent successfully: ${results.sentCount} sent, ${results.failedCount} failed`
      );
    } catch (error) {
      console.error(`Error sending campaign ${campaignId} immediately:`, error);
    }
  }

  /**
   * Get book attachment for the campaign
   */
  private static async getBookAttachment(bookId: string): Promise<any | null> {
    try {
      const book = await Book.findById(bookId);
      if (book) return book;

      const writtenBook = await WrittenBook.findById(bookId);
      return writtenBook || null;
    } catch (error) {
      console.error("Error fetching book:", error);
      return null;
    }
  }
}

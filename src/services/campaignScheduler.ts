import { EmailCampaign } from "../models/EmailCampaign";
import { EmailCampaignController } from "../controllers/emailCampaignController";

/**
 * Service to manage email campaign scheduling
 */
export class CampaignScheduler {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Start the campaign scheduler
   */
  static start() {
    if (this.isRunning) {
      console.log("Campaign scheduler is already running");
      return;
    }

    console.log("Starting campaign scheduler...");
    this.isRunning = true;

    // Check every minute for campaigns that should be sent
    this.intervalId = setInterval(async () => {
      try {
        await this.processScheduledCampaigns();
      } catch (error) {
        console.error("Error in campaign scheduler:", error);
      }
    }, 60000); // Check every minute

    // Run immediately on start
    this.processScheduledCampaigns();
  }

  /**
   * Stop the campaign scheduler
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("Campaign scheduler stopped");
  }

  /**
   * Process scheduled campaigns that are ready to be sent
   */
  private static async processScheduledCampaigns() {
    const now = new Date();

    try {
      // Find campaigns that are scheduled and should be sent now
      const scheduledCampaigns = await EmailCampaign.find({
        status: "scheduled",
        scheduledAt: { $lte: now },
        "receivers.0": { $exists: true }, // Has receivers
      }).populate("books", "title author files epubFile pdfFile");

      if (scheduledCampaigns.length > 0) {
        console.log(
          `Processing ${scheduledCampaigns.length} scheduled campaigns`
        );

        for (const campaign of scheduledCampaigns) {
          try {
            // Send the campaign
            await this.sendScheduledCampaign(campaign);
            console.log(`Campaign ${campaign._id} sent successfully`);
          } catch (error) {
            console.error(`Failed to send campaign ${campaign._id}:`, error);
            // Update campaign status to failed
            campaign.status = "failed";
            await campaign.save();
          }
        }
      }
    } catch (error) {
      console.error("Error processing scheduled campaigns:", error);
    }
  }

  /**
   * Send a scheduled campaign
   */
  private static async sendScheduledCampaign(campaign: any): Promise<void> {
    // Update campaign status to sending
    campaign.status = "sending";
    await campaign.save();

    // Send emails to all receivers
    const results = await this.sendEmailsToReceivers(campaign);

    // Update campaign status and analytics
    campaign.status = "sent";
    campaign.sentAt = new Date();
    campaign.analytics.sent = results.sentCount;
    campaign.analytics.failed = results.failedCount;
    await campaign.save();
  }

  /**
   * Send emails to all receivers in the campaign (duplicate from controller)
   */
  private static async sendEmailsToReceivers(
    campaign: any
  ): Promise<{ sentCount: number; failedCount: number }> {
    const results = { sentCount: 0, failedCount: 0 };
    const { EmailService } = await import("../services/emailService");

    for (const receiver of campaign.receivers) {
      try {
        // Replace variables in email content
        let emailContent = campaign.content;
        emailContent = this.replaceVariables(
          emailContent,
          receiver,
          campaign.senderInfo
        );

        // Get book attachment
        const bookAttachment = await this.getBookAttachment(campaign.books[0]);

        // Send email
        if (bookAttachment) {
          const { BookDeliveryService } = await import(
            "../services/bookDeliveryService"
          );
          await BookDeliveryService.sendBookViaEmail(
            bookAttachment,
            receiver.email,
            "epub"
          );
        } else {
          await EmailService.sendEmail({
            to: receiver.email,
            subject: campaign.subject,
            html: emailContent,
            from: `${campaign.senderInfo.name} <${campaign.senderInfo.email}>`,
            replyTo: campaign.settings.replyTo || campaign.senderInfo.email,
          });
        }

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
    receiver: any,
    senderInfo: any
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
    result = result.replace(/\{\{SenderName\}\}/g, senderInfo.name || "");
    result = result.replace(/\{\{SenderCompany\}\}/g, senderInfo.company || "");
    result = result.replace(/\{\{SenderEmail\}\}/g, senderInfo.email || "");

    // Replace other variables
    result = result.replace(/\{\{AttachmentLink\}\}/g, "#");

    return result;
  }

  /**
   * Get book attachment for the campaign
   */
  private static async getBookAttachment(bookId: string): Promise<any | null> {
    try {
      const { Book } = await import("../models/Book");
      const { WrittenBook } = await import("../models/WrittenBook");

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

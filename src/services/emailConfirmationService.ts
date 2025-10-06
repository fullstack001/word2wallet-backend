import crypto from "crypto";
import { EmailCapture } from "../models/EmailCapture";
import { EmailService } from "./emailService";

export class EmailConfirmationService {
  /**
   * Generate a confirmation token
   */
  static generateConfirmationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Send confirmation email
   */
  static async sendConfirmationEmail(
    emailCaptureId: string,
    bookTitle: string,
    authorName: string
  ): Promise<void> {
    // Get email capture record
    const emailCapture = await EmailCapture.findById(emailCaptureId);
    if (!emailCapture) {
      throw new Error("Email capture not found");
    }

    // Generate and save confirmation token
    const confirmationToken = this.generateConfirmationToken();
    const confirmationTokenExpiry = new Date();
    confirmationTokenExpiry.setDate(confirmationTokenExpiry.getDate() + 14); // 14 days expiry

    emailCapture.confirmationToken = confirmationToken;
    emailCapture.confirmationTokenExpiry = confirmationTokenExpiry;
    await emailCapture.save();

    // Create confirmation URL
    const confirmationUrl = `${process.env.LANDING_PAGE_URL}/confirm/${confirmationToken}`;

    // Email HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Confirmation for ${bookTitle}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #e9ecef;">
              <h1 style="margin: 0; font-size: 24px; color: #333333;">${bookTitle}</h1>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333333; line-height: 1.6; margin-bottom: 20px;">
                Please click the link below to confirm that you want to sign up for ${authorName}'s newsletter and get your copy of "${bookTitle}":
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-size: 16px; font-weight: bold;">
                  Confirm Email & Get Your Book
                </a>
              </div>

              <p style="font-size: 14px; color: #666666; line-height: 1.6; margin-top: 30px;">
                <strong>This link will expire in two weeks</strong>, so be sure to get your copy before it's gone.
              </p>

              <p style="font-size: 14px; color: #666666; line-height: 1.6; margin-top: 20px;">
                If you have trouble getting your book, click the link above and then click for help at the top of the page. Someone from our support team will be happy to lend a hand!
              </p>

              <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">

              <p style="font-size: 14px; color: #666666; line-height: 1.6;">
                For any other questions, please contact:<br>
                ${authorName} &lt;${
      process.env.SUPPORT_EMAIL || "support@word2wallet.com"
    }&gt;
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; font-size: 12px; color: #666666;">
                © ${new Date().getFullYear()} Word2Wallet. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Email text version
    const emailText = `
Email Confirmation for ${bookTitle}

Please click the link below to confirm that you want to sign up for ${authorName}'s newsletter and get your copy of "${bookTitle}":

${confirmationUrl}

This link will expire in two weeks, so be sure to get your copy before it's gone.

If you have trouble getting your book, click the link above and then click for help at the top of the page. Someone from our support team will be happy to lend a hand!

For any other questions, please contact:
${authorName} <${process.env.SUPPORT_EMAIL || "support@word2wallet.com"}>

© ${new Date().getFullYear()} Word2Wallet. All rights reserved.
    `;

    // Send email
    await EmailService.sendEmail({
      to: emailCapture.email,
      subject: `Email Confirmation for ${bookTitle}`,
      text: emailText,
      html: emailHtml,
    });
  }

  /**
   * Confirm email with token
   */
  static async confirmEmail(token: string): Promise<{
    emailCapture: any;
    book: any;
    downloadUrl: string;
  }> {
    // Find email capture by token (check both confirmed and unconfirmed)
    const emailCapture = await EmailCapture.findOne({
      confirmationToken: token,
    }).populate("bookId");

    if (!emailCapture) {
      throw new Error("Invalid confirmation token");
    }

    // Check if token has expired
    if (
      emailCapture.confirmationTokenExpiry &&
      emailCapture.confirmationTokenExpiry < new Date()
    ) {
      throw new Error("Confirmation token has expired");
    }

    // Mark as confirmed on first visit (keep the token for future visits)
    if (!emailCapture.isConfirmed) {
      emailCapture.isConfirmed = true;
      emailCapture.confirmedAt = new Date();
      await emailCapture.save();
    }

    const book = emailCapture.bookId as any;
    if (!book) {
      throw new Error("Book not found");
    }

    // Generate download URL
    const downloadUrl = `${process.env.API_URL}/books/${book._id}/download`;

    return {
      emailCapture,
      book,
      downloadUrl,
    };
  }
}

export default EmailConfirmationService;

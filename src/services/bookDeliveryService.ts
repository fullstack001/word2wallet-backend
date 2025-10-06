import { Book } from "../models/Book";
import { EmailService } from "./emailService";
import FormData from "form-data";
import https from "https";
import fs from "fs";
import path from "path";

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY!;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN!;
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || "noreply@word2wallet.com";
const MAILGUN_REGION = (process.env.MAILGUN_REGION || "US").toUpperCase();
const API_BASE =
  MAILGUN_REGION === "EU" ? "api.eu.mailgun.net" : "api.mailgun.net";

export class BookDeliveryService {
  /**
   * Send book file via email with attachment
   */
  static async sendBookViaEmail(
    book: any,
    recipientEmail: string,
    format: "epub" | "pdf"
  ): Promise<void> {
    try {
      // Determine file path based on format
      let filePath: string | undefined;
      let fileName: string | undefined;

      if (format === "epub" && book.epubFile?.fileKey) {
        filePath = book.epubFile.fileKey;
        fileName = book.epubFile.fileName || `${book.title}.epub`;
      } else if (format === "pdf" && book.pdfFile?.fileKey) {
        filePath = book.pdfFile.fileKey;
        fileName = book.pdfFile.fileName || `${book.title}.pdf`;
      } else if (book.fileKey) {
        // Legacy support
        filePath = book.fileKey;
        fileName = book.fileName || `${book.title}.${format}`;
      }

      if (!filePath || !fileName) {
        throw new Error(`${format.toUpperCase()} file not found for this book`);
      }

      // Resolve full file path - add uploads directory if not already present
      const normalizedPath =
        filePath.startsWith("uploads/") || filePath.startsWith("uploads\\")
          ? filePath
          : `uploads/${filePath}`;
      const fullPath = path.resolve(normalizedPath);

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${fullPath}`);
      }

      // Create email HTML
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Book: ${book.title}</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <!-- Header -->
              <div style="background-color: #2563eb; padding: 30px; text-align: center;">
                <h1 style="margin: 0; font-size: 28px; color: #ffffff;">Your Book Has Arrived!</h1>
              </div>

              <!-- Content -->
              <div style="padding: 40px 30px;">
                <p style="font-size: 16px; color: #333333; line-height: 1.6; margin-bottom: 20px;">
                  Thank you for downloading <strong>${book.title}</strong> by ${
        book.author
      }.
                </p>

                <p style="font-size: 16px; color: #333333; line-height: 1.6; margin-bottom: 20px;">
                  Your ${format.toUpperCase()} file is attached to this email. You can download it directly from your email client.
                </p>

                <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #1e40af;">
                    <strong>Note:</strong> Some email clients may require you to click a "Download" or "View Attachment" button to access the file.
                  </p>
                </div>

                <p style="font-size: 16px; color: #333333; line-height: 1.6; margin-top: 30px;">
                  Enjoy your reading!
                </p>

                <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">

                <p style="font-size: 14px; color: #666666; line-height: 1.6;">
                  If you have any issues accessing your book, please contact us at 
                  <a href="mailto:support@word2wallet.com" style="color: #2563eb;">support@word2wallet.com</a>
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
Your Book Has Arrived!

Thank you for downloading ${book.title} by ${book.author}.

Your ${format.toUpperCase()} file is attached to this email. You can download it directly from your email client.

Note: Some email clients may require you to click a "Download" or "View Attachment" button to access the file.

Enjoy your reading!

If you have any issues accessing your book, please contact us at support@word2wallet.com

© ${new Date().getFullYear()} Word2Wallet. All rights reserved.
      `;

      // Send email with attachment using Mailgun
      await this.sendEmailWithAttachment({
        to: recipientEmail,
        subject: `Your Book: ${book.title}`,
        text: emailText,
        html: emailHtml,
        attachmentPath: fullPath,
        attachmentFilename: fileName,
      });

      console.log(`Book sent successfully to ${recipientEmail}`);
    } catch (error) {
      console.error("Failed to send book via email:", error);
      throw error;
    }
  }

  /**
   * Send email with file attachment using Mailgun
   */
  private static async sendEmailWithAttachment(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
    attachmentPath: string;
    attachmentFilename: string;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("from", `Word2Wallet <${FROM_EMAIL}>`);
      form.append("to", options.to);
      form.append("subject", options.subject);
      form.append("text", options.text);
      form.append("html", options.html);
      form.append(
        "attachment",
        fs.createReadStream(options.attachmentPath),
        options.attachmentFilename
      );

      const headers = {
        ...form.getHeaders(),
        Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString(
          "base64"
        )}`,
      };

      const req = https.request(
        {
          hostname: API_BASE,
          port: 443,
          path: `/v3/${MAILGUN_DOMAIN}/messages`,
          method: "POST",
          headers,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (
                res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode < 300
              ) {
                resolve(json);
              } else {
                reject(
                  new Error(
                    `HTTP ${res.statusCode || "unknown"}: ${
                      json.message || data
                    }`
                  )
                );
              }
            } catch {
              reject(new Error(`Invalid JSON response: ${data}`));
            }
          });
        }
      );

      req.on("error", reject);
      form.pipe(req);
    });
  }
}

export default BookDeliveryService;

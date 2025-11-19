import { Response, Request } from "express";
import { validationResult } from "express-validator";
import { ApiResponse } from "../types";
import { EmailService } from "../services/emailService";

export class ContactController {
  /**
   * Send contact form email
   * @route POST /api/contact
   * @access Public
   */
  static async sendContactEmail(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          error: errors.array()[0].msg,
        } as ApiResponse);
        return;
      }

      const { name, email, message } = req.body;

      // Escape HTML to prevent XSS
      const escapeHtml = (text: string): string => {
        const map: { [key: string]: string } = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
      };

      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(email);
      const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

      // Create HTML email template
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contact Form Submission</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">New Contact Form Submission</h2>
            
            <div style="background-color: white; padding: 20px; border-radius: 5px; margin-top: 20px;">
              <p><strong>Name:</strong> ${safeName}</p>
              <p><strong>Email:</strong> ${safeEmail}</p>
              <p><strong>Message:</strong></p>
              <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; margin-top: 10px;">
                ${safeMessage}
              </div>
            </div>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
              <p>This email was sent from the contact form on wordtowallet.com</p>
              <p>You can reply directly to this email to respond to ${safeName} at ${safeEmail}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send email to admin
      await EmailService.sendEmail({
        to: "admin@wordtowallet.com",
        subject: `Contact Form Submission from ${name}`,
        html: htmlContent,
        replyTo: email, // Set reply-to to the sender's email
      });

      res.json({
        success: true,
        message:
          "Your message has been sent successfully. We'll get back to you soon!",
      } as ApiResponse);
    } catch (error) {
      console.error("Send contact email error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send message. Please try again later.",
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  }
}

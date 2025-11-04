import { IUser } from "../types";
import { EmailTemplates } from "./emailTemplates";
import https from "https";
import dotenv from "dotenv";
dotenv.config();
const DOMAIN = process.env.MAILGUN_DOMAIN!;
const API_KEY = process.env.MAILGUN_API_KEY!;
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || "noreply@wordtowallet.com";
const REGION = (process.env.MAILGUN_REGION || "US").toUpperCase();
const API_BASE = REGION === "EU" ? "api.eu.mailgun.net" : "api.mailgun.net";

export class EmailService {
  /**
   * Generate text version from HTML
   */
  private static generateTextVersion(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .trim();
  }

  /**
   * Send email via HTTP request (same method as test script)
   */
  private static async sendEmailViaHTTP(emailData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const body = new URLSearchParams(emailData).toString();
      const headers = {
        Authorization: `Basic ${Buffer.from(`api:${API_KEY}`).toString(
          "base64"
        )}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      };

      const req = https.request(
        {
          hostname: API_BASE,
          port: 443,
          path: `/v3/${DOMAIN}/messages`,
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
      req.write(body);
      req.end();
    });
  }

  /**
   * Send welcome email when user starts trial
   */
  static async sendTrialStartEmail(user: IUser, trialEndDate: Date) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping trial start email`
        );
        return null;
      }

      const template = EmailTemplates.getTrialStartEmail({
        user,
        trialEndDate,
      });

      const data = {
        from: `wordtowallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://wordtowallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@wordtowallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Trial start email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send trial start email:", error);
      throw error;
    }
  }

  /**
   * Send email when payment processing starts after trial
   */
  static async sendPaymentProcessingEmail(
    user: IUser,
    subscriptionEndDate: Date
  ) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping payment processing email`
        );
        return null;
      }

      const template = EmailTemplates.getPaymentProcessingEmail({
        user,
        subscriptionEndDate,
      });

      const data = {
        from: `wordtowallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://wordtowallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@wordtowallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Payment processing email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send payment processing email:", error);
      throw error;
    }
  }

  /**
   * Send email when trial successfully converts to paid subscription
   */
  static async sendTrialSuccessEmail(user: IUser, subscriptionEndDate: Date) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping trial success email`
        );
        return null;
      }

      const template = EmailTemplates.getTrialSuccessEmail({
        user,
        subscriptionEndDate,
      });

      const data = {
        from: `wordtowallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://wordtowallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@wordtowallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Trial success email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send trial success email:", error);
      throw error;
    }
  }

  /**
   * Send email when payment fails after trial
   */
  static async sendPaymentFailureEmail(user: IUser, retryDate: Date) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping payment failure email`
        );
        return null;
      }

      const template = EmailTemplates.getPaymentFailureEmail({
        user,
        retryDate,
      });

      const data = {
        from: `wordtowallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://wordtowallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@wordtowallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Payment failure email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send payment failure email:", error);
      throw error;
    }
  }

  /**
   * Generic method to send any email
   */
  static async sendEmail(options: {
    to: string;
    subject: string;
    text?: string;
    html: string;
    from?: string;
    replyTo?: string;
  }) {
    try {
      const data = {
        from: options.from || `wordtowallet <${FROM_EMAIL}>`,
        to: [options.to],
        subject: options.subject,
        text: options.text || this.generateTextVersion(options.html),
        html: options.html,
        "h:Reply-To": options.replyTo || "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Email sent successfully:", response);
      return response;
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  }

  /**
   * Send welcome email for new users
   */
  static async sendWelcomeEmail(user: IUser) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping welcome email`
        );
        return null;
      }

      const template = EmailTemplates.getWelcomeEmail({ user });

      const data = {
        from: `wordtowallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://wordtowallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@wordtowallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Welcome email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(user: IUser, resetToken: string) {
    try {
      const template = EmailTemplates.getPasswordResetEmail({
        user,
        resetToken,
      });

      const data = {
        from: `wordtowallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Password reset email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      throw error;
    }
  }

  /**
   * Send email verification email
   */
  static async sendEmailVerificationEmail(
    user: IUser,
    verificationToken: string,
    verificationCode: string
  ) {
    try {
      const template = EmailTemplates.getEmailVerificationEmail({
        user,
        verificationToken,
        verificationCode,
      });

      const data = {
        from: `wordtowallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Email verification email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send email verification email:", error);
      throw error;
    }
  }

  /**
   * Send subscription cancelled email
   */
  static async sendSubscriptionCancelledEmail(
    user: IUser,
    cancellationDate: Date
  ) {
    try {
      // Check if user has unsubscribed from emails
      if (user.emailUnsubscribed) {
        console.log(
          `User ${user.email} has unsubscribed from emails, skipping subscription cancelled email`
        );
        return null;
      }

      const template = EmailTemplates.getSubscriptionCancelledEmail({
        user,
        cancellationDate,
      });

      const data = {
        from: `wordtowallet <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        text: template.text || this.generateTextVersion(template.html),
        html: template.html,
        "h:Reply-To": "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://wordtowallet.com/unsubscribe?email=${encodeURIComponent(
          user.email
        )}>, <mailto:unsubscribe@wordtowallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Subscription cancelled email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send subscription cancelled email:", error);
      throw error;
    }
  }

  /**
   * Send purchase confirmation email with download link
   */
  static async sendPurchaseConfirmation(
    email: string,
    customerName: string,
    bookTitle: string,
    downloadLink: string,
    expiresAt: Date
  ) {
    try {
      const expiryDate = expiresAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #667eea; color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .info-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Thank You for Your Purchase!</h1>
    </div>
    <div class="content">
      <p>Hi ${customerName},</p>
      <p>Thank you for purchasing <strong>${bookTitle}</strong>! Your book is ready to download.</p>
      
      <div class="info-box">
        <p><strong>📚 Book:</strong> ${bookTitle}</p>
        <p><strong>📧 Email:</strong> ${email}</p>
        <p><strong>⏰ Access Expires:</strong> ${expiryDate}</p>
        <p><strong>💾 Downloads:</strong> 3 downloads available</p>
      </div>

      <p style="text-align: center;">
        <a href="${downloadLink}" class="button">Download Your Book Now</a>
      </p>

      <p style="font-size: 14px; color: #666;">
        Your download link is valid until <strong>${expiryDate}</strong> and can be used up to 3 times. 
        Please save this email for future reference.
      </p>

      <p style="font-size: 14px; color: #666;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${downloadLink}" style="color: #667eea; word-break: break-all;">${downloadLink}</a>
      </p>

      <hr style="border: 1px solid #eee; margin: 30px 0;">

      <p><strong>Need Help?</strong></p>
      <p>If you have any questions or issues with your download, please reply to this email and we'll be happy to assist you.</p>

      <p>Enjoy your reading!</p>
    </div>
    <div class="footer">
      <p>This email was sent to ${email}</p>
      <p>© ${new Date().getFullYear()} wordtowallet. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `;

      const textContent = `
Thank You for Your Purchase!

Hi ${customerName},

Thank you for purchasing ${bookTitle}! Your book is ready to download.

Book: ${bookTitle}
Email: ${email}
Access Expires: ${expiryDate}
Downloads: 3 downloads available

Download your book here: ${downloadLink}

Your download link is valid until ${expiryDate} and can be used up to 3 times. 
Please save this email for future reference.

Need Help?
If you have any questions or issues with your download, please reply to this email and we'll be happy to assist you.

Enjoy your reading!

---
This email was sent to ${email}
© ${new Date().getFullYear()} wordtowallet. All rights reserved.
      `;

      const data = {
        from: `wordtowallet <${FROM_EMAIL}>`,
        to: [email],
        subject: `Your Book is Ready: ${bookTitle}`,
        text: textContent,
        html: htmlContent,
        "h:Reply-To": "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
      };

      const response = await this.sendEmailViaHTTP(data);
      console.log("Purchase confirmation email sent:", response);
      return response;
    } catch (error) {
      console.error("Failed to send purchase confirmation email:", error);
      throw error;
    }
  }
}

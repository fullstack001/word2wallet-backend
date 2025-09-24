import { IUser } from "../types";

export interface EmailTemplate {
  subject: string;
  html: string;
}

export interface EmailTemplateData {
  user: IUser;
  [key: string]: any;
}

export class EmailTemplates {
  /**
   * Base HTML template with common styling
   */
  static getBaseTemplate(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Word2Wallet</title>
        <style>
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .header { padding: 20px !important; }
            .content { padding: 20px !important; }
            .button { display: block !important; width: 100% !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: Arial, sans-serif;">
        <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          ${content}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Create header section
   */
  static createHeader(
    title: string,
    subtitle: string,
    gradient: string = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  ): string {
    return `
      <div class="header" style="background: ${gradient}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">${title}</h1>
        <p style="color: white; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${subtitle}</p>
      </div>
    `;
  }

  /**
   * Create content section
   */
  static createContent(content: string): string {
    return `
      <div class="content" style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        ${content}
      </div>
    `;
  }

  /**
   * Create info box
   */
  static createInfoBox(
    title: string,
    content: string,
    color: string = "#17a2b8",
    bgColor: string = "#d1ecf1"
  ): string {
    return `
      <div style="background: ${bgColor}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
        <h3 style="color: ${color}; margin-top: 0; font-size: 16px; font-weight: bold;">${title}</h3>
        ${content}
      </div>
    `;
  }

  /**
   * Create button
   */
  static createButton(
    text: string,
    url: string,
    color: string = "#007bff",
    bgColor: string = "#007bff"
  ): string {
    return `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" 
           class="button"
           style="background: ${bgColor}; color: ${color}; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
          ${text}
        </a>
      </div>
    `;
  }

  /**
   * Create footer
   */
  static createFooter(additionalText?: string): string {
    return `
      <div style="text-align: center; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <p style="margin: 0; font-size: 12px; color: #666;">
          © 2024 Word2Wallet. All rights reserved.<br>
          ${
            additionalText ||
            "You're receiving this email because you have an account with Word2Wallet."
          }
        </p>
      </div>
    `;
  }

  /**
   * Create list
   */
  static createList(items: string[], ordered: boolean = false): string {
    const tag = ordered ? "ol" : "ul";
    const listItems = items
      .map((item) => `<li style="margin: 5px 0;">${item}</li>`)
      .join("");
    return `<${tag} style="margin: 10px 0; padding-left: 20px;">${listItems}</${tag}>`;
  }

  /**
   * Trial Start Email Template
   */
  static getTrialStartEmail(
    data: EmailTemplateData & { trialEndDate: Date }
  ): EmailTemplate {
    const { user, trialEndDate } = data;

    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hi ${
        user.firstName
      }!</h2>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">Welcome to Word2Wallet Pro! Your 7-day free trial is now active and you have full access to all our premium features.</p>
      
      ${this.createInfoBox(
        "✨ What you get with your trial:",
        this.createList([
          "Full platform access",
          "Interactive ePub3 creation",
          "Multilingual support",
          "Direct email marketing tools",
          "Advanced analytics",
        ]),
        "#28a745",
        "#d4edda"
      )}
      
      ${this.createInfoBox(
        "⏰ Trial Details:",
        `
          <p style="margin: 0; color: #856404;"><strong>Trial ends:</strong> ${trialEndDate.toLocaleDateString(
            "en-US",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          )}</p>
          <p style="margin: 5px 0 0 0; color: #856404; font-size: 14px;">You can cancel anytime during your trial with no charges.</p>
        `,
        "#ffc107",
        "#fff3cd"
      )}
      
      ${this.createButton(
        "Start Using Word2Wallet Pro",
        `${process.env.FRONTEND_URL}/`,
        "white",
        "#007bff"
      )}
      
      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        Questions? Reply to this email or contact our support team.
      </p>
    `;

    return {
      subject:
        "🎉 Welcome to Word2Wallet Pro - Your 7-Day Free Trial Has Started!",
      html: this.getBaseTemplate(
        this.createHeader(
          "🎉 Welcome to Word2Wallet Pro!",
          "Your 7-day free trial has started"
        ) +
          this.createContent(content) +
          this.createFooter(
            "You're receiving this email because you started a trial with Word2Wallet."
          )
      ),
    };
  }

  /**
   * Payment Processing Email Template
   */
  static getPaymentProcessingEmail(
    data: EmailTemplateData & { subscriptionEndDate: Date }
  ): EmailTemplate {
    const { user, subscriptionEndDate } = data;

    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hi ${
        user.firstName
      }!</h2>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">Your 7-day free trial has ended and we're now processing your payment to continue your Word2Wallet Pro subscription.</p>
      
      ${this.createInfoBox(
        "📋 Payment Details:",
        this.createList([
          "<strong>Plan:</strong> Word2Wallet Pro",
          "<strong>Amount:</strong> $20.00/month",
          `<strong>Next billing date:</strong> ${subscriptionEndDate.toLocaleDateString(
            "en-US",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          )}`,
        ]),
        "#17a2b8",
        "#d1ecf1"
      )}
      
      ${this.createInfoBox(
        "ℹ️ What happens next:",
        this.createList([
          "Your payment will be processed automatically",
          "You'll receive a confirmation email once successful",
          "Your subscription will continue uninterrupted",
        ]),
        "#17a2b8",
        "#d1ecf1"
      )}
      
      ${this.createButton(
        "Manage Your Subscription",
        `${process.env.FRONTEND_URL}/dashboard`,
        "white",
        "#28a745"
      )}
      
      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        If you have any questions about your billing, please contact our support team.
      </p>
    `;

    return {
      subject: "💳 Your Word2Wallet Pro subscription is being processed",
      html: this.getBaseTemplate(
        this.createHeader(
          "💳 Payment Processing",
          "Your trial has ended, payment is being processed",
          "linear-gradient(135deg, #ffc107 0%, #ff8c00 100%)"
        ) +
          this.createContent(content) +
          this.createFooter(
            "You're receiving this email because your trial has ended and payment is being processed."
          )
      ),
    };
  }

  /**
   * Trial Success Email Template
   */
  static getTrialSuccessEmail(
    data: EmailTemplateData & { subscriptionEndDate: Date }
  ): EmailTemplate {
    const { user, subscriptionEndDate } = data;

    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px;">Congratulations ${
        user.firstName
      }!</h2>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">Your payment has been processed successfully and your Word2Wallet Pro subscription is now active. Thank you for choosing Word2Wallet!</p>
      
      ${this.createInfoBox(
        "🎉 Your subscription details:",
        this.createList([
          "<strong>Plan:</strong> Word2Wallet Pro",
          "<strong>Status:</strong> Active",
          "<strong>Amount:</strong> $20.00/month",
          `<strong>Next billing date:</strong> ${subscriptionEndDate.toLocaleDateString(
            "en-US",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          )}`,
        ]),
        "#28a745",
        "#d4edda"
      )}
      
      ${this.createInfoBox(
        "🚀 You now have access to:",
        this.createList([
          "All premium features",
          "Priority support",
          "Advanced analytics",
          "Unlimited projects",
        ]),
        "#28a745",
        "#d4edda"
      )}
      
      ${this.createButton(
        "Access Your Dashboard",
        `${process.env.FRONTEND_URL}/dashboard`,
        "white",
        "#007bff"
      )}
      
      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        Need help getting started? Check out our <a href="${
          process.env.FRONTEND_URL
        }/help" style="color: #007bff;">help center</a> or contact support.
      </p>
    `;

    return {
      subject: "✅ Welcome to Word2Wallet Pro - Your subscription is active!",
      html: this.getBaseTemplate(
        this.createHeader(
          "✅ Subscription Active!",
          "Your Word2Wallet Pro subscription is now active",
          "linear-gradient(135deg, #28a745 0%, #20c997 100%)"
        ) +
          this.createContent(content) +
          this.createFooter(
            "You're receiving this email because your subscription is now active."
          )
      ),
    };
  }

  /**
   * Payment Failure Email Template
   */
  static getPaymentFailureEmail(
    data: EmailTemplateData & { retryDate: Date }
  ): EmailTemplate {
    const { user, retryDate } = data;

    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hi ${
        user.firstName
      }!</h2>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">We were unable to process your payment for your Word2Wallet Pro subscription. This could be due to an expired card, insufficient funds, or other payment issues.</p>
      
      ${this.createInfoBox(
        "🚨 What you need to do:",
        this.createList(
          [
            "Update your payment method in your account",
            "Ensure your card has sufficient funds",
            "Check that your card hasn't expired",
            "Contact your bank if the issue persists",
          ],
          true
        ),
        "#dc3545",
        "#f8d7da"
      )}
      
      ${this.createInfoBox(
        "⏰ Important:",
        `<p style="margin: 0; color: #721c24;">We'll retry your payment on ${retryDate.toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        )}. Please update your payment method before then to avoid service interruption.</p>`,
        "#dc3545",
        "#f8d7da"
      )}
      
      ${this.createButton(
        "Update Payment Method",
        `${process.env.FRONTEND_URL}/dashboard`,
        "white",
        "#dc3545"
      )}
      
      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        Need help? Contact our support team and we'll be happy to assist you.
      </p>
    `;

    return {
      subject: "⚠️ Payment failed - Please update your payment method",
      html: this.getBaseTemplate(
        this.createHeader(
          "⚠️ Payment Failed",
          "We couldn't process your payment",
          "linear-gradient(135deg, #dc3545 0%, #c82333 100%)"
        ) +
          this.createContent(content) +
          this.createFooter(
            "You're receiving this email because your payment failed."
          )
      ),
    };
  }

  /**
   * Welcome Email Template (for new users)
   */
  static getWelcomeEmail(data: EmailTemplateData): EmailTemplate {
    const { user } = data;

    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px;">Welcome to Word2Wallet, ${
        user.firstName
      }!</h2>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">Thank you for joining Word2Wallet! We're excited to help you create amazing interactive content.</p>
      
      ${this.createInfoBox(
        "🚀 Get started with:",
        this.createList([
          "Create your first interactive ePub",
          "Explore our content creation tools",
          "Set up your profile",
          "Join our community",
        ]),
        "#007bff",
        "#cce7ff"
      )}
      
      ${this.createButton(
        "Get Started",
        `${process.env.FRONTEND_URL}/dashboard`,
        "white",
        "#007bff"
      )}
      
      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        Need help? Check out our <a href="${
          process.env.FRONTEND_URL
        }/help" style="color: #007bff;">help center</a> or contact support.
      </p>
    `;

    return {
      subject: "🎉 Welcome to Word2Wallet!",
      html: this.getBaseTemplate(
        this.createHeader(
          "🎉 Welcome to Word2Wallet!",
          "Let's create something amazing together"
        ) +
          this.createContent(content) +
          this.createFooter(
            "You're receiving this email because you created an account with Word2Wallet."
          )
      ),
    };
  }

  /**
   * Password Reset Email Template
   */
  static getPasswordResetEmail(
    data: EmailTemplateData & { resetToken: string }
  ): EmailTemplate {
    const { user, resetToken } = data;

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hi ${
        user.firstName
      }!</h2>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">We received a request to reset your password for your Word2Wallet account.</p>
      
      ${this.createInfoBox(
        "🔐 Reset your password:",
        `
          <p style="margin: 0; color: #333;">Click the button below to reset your password. This link will expire in 1 hour.</p>
        `,
        "#6c757d",
        "#e2e3e5"
      )}
      
      ${this.createButton("Reset Password", resetUrl, "white", "#6c757d")}
      
      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
      </p>
    `;

    return {
      subject: "🔐 Reset your Word2Wallet password",
      html: this.getBaseTemplate(
        this.createHeader(
          "🔐 Password Reset",
          "Reset your Word2Wallet password",
          "linear-gradient(135deg, #6c757d 0%, #495057 100%)"
        ) +
          this.createContent(content) +
          this.createFooter(
            "You're receiving this email because you requested a password reset."
          )
      ),
    };
  }

  /**
   * Subscription Cancelled Email Template
   */
  static getSubscriptionCancelledEmail(
    data: EmailTemplateData & { cancellationDate: Date }
  ): EmailTemplate {
    const { user, cancellationDate } = data;

    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hi ${
        user.firstName
      }!</h2>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">We're sorry to see you go! Your Word2Wallet Pro subscription has been cancelled.</p>
      
      ${this.createInfoBox(
        "📅 Cancellation Details:",
        this.createList([
          `<strong>Cancellation date:</strong> ${cancellationDate.toLocaleDateString(
            "en-US",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          )}`,
          "<strong>Access continues until:</strong> End of current billing period",
          "<strong>Data retention:</strong> 30 days after cancellation",
        ]),
        "#6c757d",
        "#e2e3e5"
      )}
      
      ${this.createInfoBox(
        "💡 We'd love to have you back:",
        this.createList([
          "Your data will be saved for 30 days",
          "You can reactivate anytime",
          "Contact us if you need help",
          "We're always improving based on feedback",
        ]),
        "#17a2b8",
        "#d1ecf1"
      )}
      
      ${this.createButton(
        "Reactivate Subscription",
        `${process.env.FRONTEND_URL}/dashboard`,
        "white",
        "#17a2b8"
      )}
      
      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        Thank you for being part of the Word2Wallet community. We hope to see you again soon!
      </p>
    `;

    return {
      subject: "👋 Your Word2Wallet Pro subscription has been cancelled",
      html: this.getBaseTemplate(
        this.createHeader(
          "👋 Subscription Cancelled",
          "We're sorry to see you go",
          "linear-gradient(135deg, #6c757d 0%, #495057 100%)"
        ) +
          this.createContent(content) +
          this.createFooter(
            "You're receiving this email because your subscription was cancelled."
          )
      ),
    };
  }
}

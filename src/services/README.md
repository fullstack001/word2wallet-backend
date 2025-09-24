# Email System Documentation

## Overview

The Word2Wallet email system provides a comprehensive, template-based email solution using Mailgun. It's designed to be easily extensible and maintainable for future email needs.

## Architecture

### Core Components

1. **EmailTemplates** (`emailTemplates.ts`) - Template system for creating email content
2. **EmailService** (`emailService.ts`) - Service for sending emails via Mailgun
3. **Template System** - Modular, reusable email templates

## Template System

### Base Template Structure

All emails use a consistent base template with:

- Responsive design (mobile-friendly)
- Consistent branding
- Professional styling
- Accessibility features

### Template Components

#### 1. Header Section

```typescript
createHeader(title: string, subtitle: string, gradient?: string)
```

- Customizable gradient backgrounds
- Consistent typography
- Mobile responsive

#### 2. Content Section

```typescript
createContent(content: string)
```

- Main content area
- Consistent padding and styling

#### 3. Info Boxes

```typescript
createInfoBox(title: string, content: string, color?: string, bgColor?: string)
```

- Highlighted information sections
- Customizable colors
- Support for lists and rich content

#### 4. Buttons

```typescript
createButton(text: string, url: string, color?: string, bgColor?: string)
```

- Call-to-action buttons
- Consistent styling
- Mobile responsive

#### 5. Lists

```typescript
createList(items: string[], ordered?: boolean)
```

- Ordered and unordered lists
- Consistent styling

#### 6. Footer

```typescript
createFooter(additionalText?: string)
```

- Standard footer with copyright
- Customizable additional text

## Available Email Templates

### 1. Trial Start Email

**Method:** `EmailTemplates.getTrialStartEmail(data)`
**Data Required:**

- `user: IUser`
- `trialEndDate: Date`

**Features:**

- Welcome message
- Trial benefits list
- Trial end date
- Call-to-action button

### 2. Payment Processing Email

**Method:** `EmailTemplates.getPaymentProcessingEmail(data)`
**Data Required:**

- `user: IUser`
- `subscriptionEndDate: Date`

**Features:**

- Payment details
- Next steps information
- Billing information

### 3. Trial Success Email

**Method:** `EmailTemplates.getTrialSuccessEmail(data)`
**Data Required:**

- `user: IUser`
- `subscriptionEndDate: Date`

**Features:**

- Success confirmation
- Subscription details
- Access benefits
- Dashboard link

### 4. Payment Failure Email

**Method:** `EmailTemplates.getPaymentFailureEmail(data)`
**Data Required:**

- `user: IUser`
- `retryDate: Date`

**Features:**

- Failure explanation
- Action steps
- Retry information
- Support contact

### 5. Welcome Email

**Method:** `EmailTemplates.getWelcomeEmail(data)`
**Data Required:**

- `user: IUser`

**Features:**

- Welcome message
- Getting started guide
- Feature highlights

### 6. Password Reset Email

**Method:** `EmailTemplates.getPasswordResetEmail(data)`
**Data Required:**

- `user: IUser`
- `resetToken: string`

**Features:**

- Reset instructions
- Secure token link
- Security information

### 7. Subscription Cancelled Email

**Method:** `EmailTemplates.getSubscriptionCancelledEmail(data)`
**Data Required:**

- `user: IUser`
- `cancellationDate: Date`

**Features:**

- Cancellation confirmation
- Access timeline
- Reactivation options

## Usage Examples

### Sending a Trial Start Email

```typescript
import { EmailService } from "../services/emailService";

// In your controller
await EmailService.sendTrialStartEmail(user, trialEndDate);
```

### Creating a Custom Email Template

```typescript
// In emailTemplates.ts
static getCustomEmail(data: EmailTemplateData & { customField: string }): EmailTemplate {
  const { user, customField } = data;

  const content = `
    <h2>Hi ${user.firstName}!</h2>
    <p>Your custom message here: ${customField}</p>
    ${this.createButton("Custom Action", "/custom-url")}
  `;

  return {
    subject: "Custom Email Subject",
    html: this.getBaseTemplate(
      this.createHeader("Custom Title", "Custom Subtitle") +
      this.createContent(content) +
      this.createFooter()
    )
  };
}
```

### Adding to EmailService

```typescript
// In emailService.ts
static async sendCustomEmail(user: IUser, customField: string) {
  try {
    const template = EmailTemplates.getCustomEmail({ user, customField });

    const data = {
      from: `Word2Wallet <${FROM_EMAIL}>`,
      to: [user.email],
      subject: template.subject,
      html: template.html,
    };

    const response = await mg.messages.create(DOMAIN, data);
    console.log("Custom email sent:", response);
    return response;
  } catch (error) {
    console.error("Failed to send custom email:", error);
    throw error;
  }
}
```

## Environment Variables

```env
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=your_mailgun_domain_here
MAILGUN_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=https://your-frontend-url.com
```

## Best Practices

### 1. Template Design

- Use consistent color schemes
- Keep content concise and clear
- Include clear call-to-action buttons
- Test on mobile devices

### 2. Content Guidelines

- Use personalization (user's name)
- Include relevant dates and information
- Provide clear next steps
- Include support contact information

### 3. Technical Considerations

- Always handle email sending errors gracefully
- Don't let email failures break main functionality
- Log email sending for debugging
- Use try-catch blocks for error handling

### 4. Performance

- Email sending is asynchronous
- Don't block main application flow
- Consider rate limiting for bulk emails

## Adding New Email Types

### Step 1: Create Template Method

```typescript
// In emailTemplates.ts
static getNewEmailType(data: EmailTemplateData & { customData: any }): EmailTemplate {
  const { user, customData } = data;

  const content = `
    <h2>Hi ${user.firstName}!</h2>
    <p>Your custom content here</p>
    ${this.createButton("Action", "/url")}
  `;

  return {
    subject: "Your Subject Here",
    html: this.getBaseTemplate(
      this.createHeader("Title", "Subtitle") +
      this.createContent(content) +
      this.createFooter("Custom footer text")
    )
  };
}
```

### Step 2: Add Service Method

```typescript
// In emailService.ts
static async sendNewEmailType(user: IUser, customData: any) {
  try {
    const template = EmailTemplates.getNewEmailType({ user, customData });

    const data = {
      from: `Word2Wallet <${FROM_EMAIL}>`,
      to: [user.email],
      subject: template.subject,
      html: template.html,
    };

    const response = await mg.messages.create(DOMAIN, data);
    console.log("New email type sent:", response);
    return response;
  } catch (error) {
    console.error("Failed to send new email type:", error);
    throw error;
  }
}
```

### Step 3: Use in Controllers

```typescript
// In your controller
await EmailService.sendNewEmailType(user, customData);
```

## Testing

### Manual Testing

1. Set up test Mailgun account
2. Use test email addresses
3. Verify email rendering in different clients
4. Test mobile responsiveness

### Automated Testing

```typescript
// Example test
describe("EmailService", () => {
  it("should send trial start email", async () => {
    const user = { firstName: "John", email: "test@example.com" };
    const trialEndDate = new Date();

    const result = await EmailService.sendTrialStartEmail(user, trialEndDate);
    expect(result).toBeDefined();
  });
});
```

## Troubleshooting

### Common Issues

1. **Email not sending**

   - Check Mailgun API key and domain
   - Verify environment variables
   - Check Mailgun dashboard for errors

2. **Template rendering issues**

   - Validate HTML structure
   - Check for unclosed tags
   - Test in email clients

3. **Styling problems**
   - Use inline CSS for email clients
   - Test across different email providers
   - Consider email client limitations

### Debug Tips

1. Enable console logging
2. Check Mailgun logs
3. Test with different email addresses
4. Verify template data structure

## Future Enhancements

### Planned Features

- Email template preview system
- A/B testing for email content
- Email analytics integration
- Template versioning
- Bulk email capabilities
- Email scheduling

### Integration Opportunities

- User preference management
- Email frequency controls
- Unsubscribe handling
- Email analytics
- Template management UI

## Support

For questions or issues with the email system:

1. Check this documentation
2. Review error logs
3. Test with Mailgun dashboard
4. Contact development team

---

_Last updated: 2024_

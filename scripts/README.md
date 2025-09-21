# Scripts Directory

This directory contains utility scripts for the Word2Wallet backend application.

## Available Scripts

### createAdmin.ts

Creates an admin user using the same database and models as the main application.

**Usage:**

```bash
# Using environment variables (recommended)
npm run create-admin

# Using command line arguments
npm run create-admin <email> <password> <firstName> <lastName>
```

**Features:**

- Uses the same User model and database configuration as the main app
- Validates input data (email format, password strength)
- Prevents duplicate admin creation
- Comprehensive error handling
- TypeScript for type safety

**Environment Variables:**

- `ADMIN_EMAIL` - Admin user email (default: admin@word2wallet.com)
- `ADMIN_PASSWORD` - Admin user password (default: admin123456)
- `ADMIN_FIRST_NAME` - Admin first name (default: Admin)
- `ADMIN_LAST_NAME` - Admin last name (default: User)

### setup.js

Original setup script for initial project configuration.

## Integration with Main App

All scripts in this directory are designed to work seamlessly with the main application:

- **Same Database**: Uses identical database connection and configuration
- **Same Models**: Imports and uses the actual User, Subject, and Course models
- **Same Types**: Uses the same TypeScript interfaces and enums
- **Same Validation**: Applies the same validation rules and constraints

## Development

When adding new scripts:

1. **Use TypeScript**: Prefer `.ts` files for type safety
2. **Import Models**: Use the actual models from `../src/models/`
3. **Use Database Config**: Import and use `connectDB` from `../src/config/database`
4. **Handle Errors**: Implement comprehensive error handling
5. **Add to package.json**: Add npm scripts for easy execution

## Security

- Scripts use the same security measures as the main app
- Passwords are hashed using the same bcrypt configuration
- Input validation follows the same rules as API endpoints
- Environment variables are used for sensitive configuration

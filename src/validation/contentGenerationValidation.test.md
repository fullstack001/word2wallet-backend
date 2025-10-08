# Content Generation Validation Test Cases

## Overview

This document describes the validation rules for the content generation API endpoint.

## Validation Rules

### Mode Validation (Required)

- **Field:** `mode`
- **Type:** String
- **Required:** Yes
- **Allowed Values:** `"RAW_XHTML"` or `"STRICT_NATIVE_BLOCKS"`
- **Error Messages:**
  - "Mode is required" (if missing)
  - 'Mode must be either "RAW_XHTML" or "STRICT_NATIVE_BLOCKS"' (if invalid value)

---

## RAW_XHTML Mode Validation

When `mode === "RAW_XHTML"`:

### HTML Field (Required for RAW_XHTML)

- **Field:** `html`
- **Type:** String
- **Required:** Yes (only when mode is RAW_XHTML)
- **Constraints:**
  - Min length: 1 character
  - Max length: 50,000 characters
- **Error Messages:**
  - "HTML content is required for RAW_XHTML mode"
  - "HTML content must be between 1 and 50000 characters"

### Test Cases for RAW_XHTML Mode

#### ✅ Valid Requests

```json
{
  "mode": "RAW_XHTML",
  "html": "<h2>Hello World</h2><p>This is valid HTML</p>"
}
```

```json
{
  "mode": "RAW_XHTML",
  "html": "<div><h1>Title</h1><p>Content with <strong>formatting</strong></p></div>"
}
```

#### ❌ Invalid Requests

**Missing HTML:**

```json
{
  "mode": "RAW_XHTML"
}
```

Error: "HTML content is required for RAW_XHTML mode"

**Empty HTML:**

```json
{
  "mode": "RAW_XHTML",
  "html": ""
}
```

Error: "HTML content is required for RAW_XHTML mode"

**HTML Too Long (>50,000 characters):**

```json
{
  "mode": "RAW_XHTML",
  "html": "<p>..." (50,001+ characters)
}
```

Error: "HTML content must be between 1 and 50000 characters"

---

## STRICT_NATIVE_BLOCKS Mode Validation

When `mode === "STRICT_NATIVE_BLOCKS"`:

### Title Field (Optional)

- **Field:** `title`
- **Type:** String
- **Required:** No
- **Constraints:**
  - Min length: 3 characters (if provided)
  - Max length: 200 characters
- **Error Message:**
  - "Chapter title must be between 3 and 200 characters"

### Description Field (Optional)

- **Field:** `description`
- **Type:** String
- **Required:** No
- **Constraints:**
  - Min length: 10 characters (if provided)
  - Max length: 1,000 characters
- **Error Message:**
  - "Chapter description must be between 10 and 1000 characters"

### Instructions Field (Optional)

- **Field:** `instructions`
- **Type:** String
- **Required:** No
- **Constraints:**
  - Max length: 5,000 characters
- **Error Message:**
  - "Instructions must be less than 5000 characters"

### Course Title Field (Optional)

- **Field:** `courseTitle`
- **Type:** String
- **Required:** No
- **Constraints:**
  - Max length: 200 characters
- **Error Message:**
  - "Course title must be less than 200 characters"

### Subject Name Field (Optional)

- **Field:** `subjectName`
- **Type:** String
- **Required:** No
- **Constraints:**
  - Max length: 100 characters
- **Error Message:**
  - "Subject name must be less than 100 characters"

### Strict Field (Optional)

- **Field:** `strict`
- **Type:** Boolean
- **Required:** No
- **Default:** `true` (in controller)
- **Error Message:**
  - "Strict must be a boolean value"

### Test Cases for STRICT_NATIVE_BLOCKS Mode

#### ✅ Valid Requests

**Minimal Request:**

```json
{
  "mode": "STRICT_NATIVE_BLOCKS"
}
```

**With Title and Description:**

```json
{
  "mode": "STRICT_NATIVE_BLOCKS",
  "title": "Introduction to Mathematics",
  "description": "This chapter covers basic mathematical concepts."
}
```

**Full Request:**

```json
{
  "mode": "STRICT_NATIVE_BLOCKS",
  "strict": true,
  "title": "Chapter 1: Getting Started",
  "description": "An introduction to the fundamental concepts covered in this course.",
  "instructions": "Create engaging content with examples",
  "courseTitle": "Web Development Fundamentals",
  "subjectName": "Computer Science"
}
```

**With Instructions Only:**

```json
{
  "mode": "STRICT_NATIVE_BLOCKS",
  "instructions": "Generate a chapter about quantum physics with 3 sections and include relevant examples."
}
```

#### ❌ Invalid Requests

**Title Too Short:**

```json
{
  "mode": "STRICT_NATIVE_BLOCKS",
  "title": "Hi"
}
```

Error: "Chapter title must be between 3 and 200 characters"

**Title Too Long:**

```json
{
  "mode": "STRICT_NATIVE_BLOCKS",
  "title": "Very long title..." (201+ characters)
}
```

Error: "Chapter title must be between 3 and 200 characters"

**Description Too Short:**

```json
{
  "mode": "STRICT_NATIVE_BLOCKS",
  "description": "Too short"
}
```

Error: "Chapter description must be between 10 and 1000 characters"

**Description Too Long:**

```json
{
  "mode": "STRICT_NATIVE_BLOCKS",
  "description": "Very long description..." (1,001+ characters)
}
```

Error: "Chapter description must be between 10 and 1000 characters"

**Instructions Too Long:**

```json
{
  "mode": "STRICT_NATIVE_BLOCKS",
  "instructions": "Very long instructions..." (5,001+ characters)
}
```

Error: "Instructions must be less than 5000 characters"

**Invalid Strict Type:**

```json
{
  "mode": "STRICT_NATIVE_BLOCKS",
  "strict": "yes"
}
```

Error: "Strict must be a boolean value"

---

## Common Validation Errors

### Missing Mode

```json
{
  "title": "Chapter Title",
  "description": "Chapter description"
}
```

Error: "Mode is required"

### Invalid Mode Value

```json
{
  "mode": "INVALID_MODE",
  "title": "Chapter Title"
}
```

Error: 'Mode must be either "RAW_XHTML" or "STRICT_NATIVE_BLOCKS"'

---

## Edge Cases

### Empty String vs Null vs Undefined

**Empty String (after trim):**

- Treated as missing/invalid for required fields
- Passes validation for optional fields (if not constrained)

**Null:**

- Fails validation for required fields
- Passes for optional fields

**Undefined:**

- Fails validation for required fields
- Passes for optional fields

### Whitespace Handling

All string fields are trimmed before validation:

```json
{
  "mode": "  RAW_XHTML  ",
  "html": "  <h1>Hello</h1>  "
}
```

This is valid and will be processed as:

```json
{
  "mode": "RAW_XHTML",
  "html": "<h1>Hello</h1>"
}
```

---

## Testing with cURL

### Test RAW_XHTML Mode

**Valid Request:**

```bash
curl -X POST http://localhost:5000/api/content-generation/generate-chapter-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "mode": "RAW_XHTML",
    "html": "<h2>Test Content</h2><p>This is a test.</p>"
  }'
```

**Invalid Request (Missing HTML):**

```bash
curl -X POST http://localhost:5000/api/content-generation/generate-chapter-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "mode": "RAW_XHTML"
  }'
```

### Test STRICT_NATIVE_BLOCKS Mode

**Valid Request:**

```bash
curl -X POST http://localhost:5000/api/content-generation/generate-chapter-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "mode": "STRICT_NATIVE_BLOCKS",
    "title": "Introduction to AI",
    "description": "Learn the basics of artificial intelligence and machine learning."
  }'
```

**Invalid Request (Title Too Short):**

```bash
curl -X POST http://localhost:5000/api/content-generation/generate-chapter-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "mode": "STRICT_NATIVE_BLOCKS",
    "title": "AI"
  }'
```

---

## Validation Response Format

When validation fails, the API returns:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "type": "field",
      "value": "<provided_value>",
      "msg": "<error_message>",
      "path": "<field_name>",
      "location": "body"
    }
  ]
}
```

**Example Error Response:**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "type": "field",
      "value": "",
      "msg": "HTML content is required for RAW_XHTML mode",
      "path": "html",
      "location": "body"
    }
  ]
}
```

---

## Best Practices

1. **Always Include Mode:** The `mode` field is required for all requests.

2. **Match Fields to Mode:**

   - For `RAW_XHTML`, include `html`
   - For `STRICT_NATIVE_BLOCKS`, include `title` and/or `description` and/or `instructions`

3. **Provide Context:** For better AI generation, include `courseTitle` and `subjectName` when using `STRICT_NATIVE_BLOCKS` mode.

4. **Use Strict Mode:** Set `strict: true` (default) to prevent AI from adding templates or promotional content.

5. **Handle Validation Errors:** Always check for validation errors in the response before processing.

6. **Stay Within Limits:**
   - HTML: Max 50,000 characters
   - Instructions: Max 5,000 characters
   - Titles: Max 200 characters
   - Descriptions: Max 1,000 characters

---

## Summary Table

| Field          | Mode                 | Required | Type    | Min Length | Max Length | Notes                                 |
| -------------- | -------------------- | -------- | ------- | ---------- | ---------- | ------------------------------------- |
| `mode`         | Both                 | Yes      | String  | -          | -          | "RAW_XHTML" or "STRICT_NATIVE_BLOCKS" |
| `html`         | RAW_XHTML            | Yes      | String  | 1          | 50,000     | Only for RAW_XHTML mode               |
| `title`        | STRICT_NATIVE_BLOCKS | No       | String  | 3          | 200        | Optional                              |
| `description`  | STRICT_NATIVE_BLOCKS | No       | String  | 10         | 1,000      | Optional                              |
| `instructions` | STRICT_NATIVE_BLOCKS | No       | String  | -          | 5,000      | Optional                              |
| `courseTitle`  | Both                 | No       | String  | -          | 200        | Optional, provides context            |
| `subjectName`  | Both                 | No       | String  | -          | 100        | Optional, provides context            |
| `strict`       | STRICT_NATIVE_BLOCKS | No       | Boolean | -          | -          | Optional, defaults to true            |

---

**Last Updated:** October 8, 2025

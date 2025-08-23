# JSON Form Renderer

A comprehensive web-based tool for testing and validating JSON form structures. This renderer visualizes form JSON files as interactive forms with proper styling and validation.

## Features

### 🎨 **Visual Form Rendering**
- **All Field Types Supported:**
  - `text` - Text input fields
  - `textarea` - Multi-line text areas
  - `date` - Date picker inputs
  - `signature` - Digital signature placeholders
  - `checkbox` - Single checkbox fields
  - `multipleCheckbox` - Multiple choice checkboxes
  - `info` - Information/display-only fields

### 🔍 **Form Validation**
- **Structure Validation:** Checks for proper JSON structure
- **Required Field Validation:** Identifies missing required fields
- **Field Type Analysis:** Breakdown of field types used
- **Option Validation:** Validates multipleCheckbox options arrays
- **Real-time Statistics:** Field counts, completion rates

### 📊 **Analytics & Insights**
- Form completion tracking
- Field type distribution
- Required vs optional field analysis
- Validation error reporting
- Warning notifications for structural issues

### 🚀 **User Experience**
- **Drag & Drop:** File upload with drag and drop support
- **Quick Load:** Pre-configured buttons for example forms
- **Responsive Design:** Works on desktop and mobile
- **Modern UI:** Pink/purple aesthetic with smooth animations
- **Export Functionality:** Download form data and validation results
- **Fullscreen Mode:** Distraction-free form viewing

## Usage

### Loading Forms

1. **File Upload:**
   - Click "Choose JSON File" button
   - Or drag and drop JSON files onto the upload area

2. **Quick Load Examples:**
   - Click any of the example buttons in the sidebar
   - Pre-configured for existing JSON forms in the project

### Validation

1. Click the **Validate** button (shield icon) in the floating actions
2. View detailed validation results in the side panel
3. Check for:
   - Structural errors
   - Missing required fields
   - Field type distribution
   - Completion statistics

### Export

1. Fill out the form fields
2. Click the **Export** button (download icon)
3. Downloads a JSON file containing:
   - Original form structure
   - Current form values
   - Validation results
   - Export timestamp

## Supported JSON Structure

```json
{
  "_id": "form_identifier",
  "name": "Form Title",
  "description": "Form description",
  "stepNumber": "1",
  "filledBy": "user_type",
  "formStructure": [
    {
      "section": "section_id",
      "sectionTitle": "Section Title",
      "fields": [
        {
          "fieldName": "field_id",
          "label": "Field Label",
          "fieldType": "text|textarea|date|signature|checkbox|multipleCheckbox|info",
          "required": true|false,
          "options": ["option1", "option2"], // for multipleCheckbox
          "default": "default_value" // optional
        }
      ]
    }
  ]
}
```

## Field Type Examples

### Text Input
```json
{
  "fieldName": "candidateName",
  "label": "Candidate Name",
  "fieldType": "text",
  "required": true
}
```

### Multiple Checkbox
```json
{
  "fieldName": "evidenceTypes",
  "label": "Evidence Submitted",
  "fieldType": "multipleCheckbox",
  "required": true,
  "options": ["Resume", "Certificates", "Work Samples", "References"]
}
```

### Information Field
```json
{
  "fieldName": "instructions",
  "label": "Please complete all required fields before submission.",
  "fieldType": "info",
  "required": false
}
```

## Technical Details

### Files Structure
```
form-renderer/
├── index.html          # Main HTML interface
├── styles.css          # CSS styling with pink/purple theme
├── script.js           # JavaScript functionality
└── README.md          # This documentation
```

### Dependencies
- **Font Awesome 6.0.0** - Icons
- **Google Fonts (Inter)** - Typography
- **Pure CSS/JS** - No frameworks required

### Browser Support
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Validation Rules

### ✅ **Passes Validation**
- All required fields have `fieldName` and `label`
- multipleCheckbox fields have valid `options` array
- Form structure follows expected JSON schema
- Required fields are properly marked

### ⚠️ **Warnings**
- Missing field labels
- Missing field names
- Empty options arrays for multipleCheckbox
- Unusual field type combinations

### ❌ **Errors**
- Invalid JSON structure
- Missing required field values (when testing form completion)
- Unsupported field types
- Malformed form structure

## Customization

### Theme Colors
Modify CSS variables in `styles.css`:
```css
:root {
    --primary-color: #8B5FBF;      /* Purple */
    --secondary-color: #E91E63;    /* Pink */
    --accent-color: #FF6B9D;       /* Light Pink */
}
```

### Adding New Field Types
1. Add rendering logic in `generateFieldHTML()` method
2. Add styling in CSS with appropriate class
3. Add validation rules in `performValidation()` method
4. Update legend in HTML sidebar

## Testing Forms

The renderer is specifically designed to test these JSON forms:
- **SHB30221 Certificate III in Makeup** - RPL Assessment
- **CPC40120 Certificate IV in Building and Construction** - Candidate Guide
- **CPC31420 Certificate III in Waterproofing** - Marking Guide
- **Custom JSON Forms** - Any form following the structure

## Troubleshooting

### Form Not Loading
- Check JSON file validity
- Ensure file follows expected structure
- Check browser console for errors

### Fields Not Rendering
- Verify field types are supported
- Check for missing required properties
- Validate options arrays for multipleCheckbox

### Validation Errors
- Review required field completeness
- Check field naming consistency
- Ensure proper nesting structure

---

**Created for comprehensive JSON form testing and validation** 🎯


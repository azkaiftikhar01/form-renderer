class JSONFormRenderer {
    constructor() {
        this.currentFormData = null;
        this.formValues = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupQuickLoadButtons();
    }

    setupEventListeners() {
        // File input handler
        const fileInput = document.getElementById('jsonFileInput');
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Floating action buttons
        document.getElementById('validateBtn').addEventListener('click', () => this.validateForm());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportFormData());
        document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());

        // Validation panel close
        document.getElementById('closeValidation').addEventListener('click', () => this.closeValidationPanel());

        // Drag and drop for file upload
        const fileLabel = document.querySelector('.file-label');
        fileLabel.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = 'var(--accent-color)';
            fileLabel.style.backgroundColor = 'rgba(139, 95, 191, 0.1)';
        });

        fileLabel.addEventListener('dragleave', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = 'transparent';
            fileLabel.style.backgroundColor = '';
        });

        fileLabel.addEventListener('drop', (e) => {
            e.preventDefault();
            fileLabel.style.borderColor = 'transparent';
            fileLabel.style.backgroundColor = '';
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/json') {
                this.loadJSONFile(files[0]);
            }
        });
    }

    setupQuickLoadButtons() {
        const quickLoadButtons = document.querySelectorAll('.example-btn');
        quickLoadButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const filePath = button.getAttribute('data-file');
                try {
                    const response = await fetch(filePath);
                    const jsonData = await response.json();
                    this.renderForm(jsonData);
                    this.showNotification('Form loaded successfully!', 'success');
                } catch (error) {
                    console.error('Error loading example file:', error);
                    this.showNotification('Failed to load example file. Please check if the file exists.', 'error');
                }
            });
        });
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/json') {
            this.loadJSONFile(file);
        } else {
            this.showNotification('Please select a valid JSON file.', 'error');
        }
    }

    loadJSONFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                this.renderForm(jsonData);
                this.showNotification('Form loaded successfully!', 'success');
            } catch (error) {
                console.error('Error parsing JSON:', error);
                this.showNotification('Invalid JSON file. Please check the file format.', 'error');
            }
        };
        reader.readAsText(file);
    }

    renderForm(jsonData) {
        this.currentFormData = jsonData;
        this.formValues = {};

        // Update form information
        this.updateFormInfo(jsonData);

        // Hide welcome message and show form
        document.getElementById('welcomeMessage').style.display = 'none';
        document.getElementById('renderedForm').style.display = 'block';
        document.getElementById('formInfo').style.display = 'block';

        // Render the form
        const formContainer = document.getElementById('renderedForm');
        formContainer.innerHTML = this.generateFormHTML(jsonData);

        // Setup form interactions
        this.setupFormInteractions();
    }

    updateFormInfo(jsonData) {
        document.getElementById('formName').textContent = jsonData.name || 'N/A';
        document.getElementById('formDescription').textContent = jsonData.description || 'N/A';
        document.getElementById('formStepNumber').textContent = jsonData.stepNumber || 'N/A';
        document.getElementById('formFilledBy').textContent = jsonData.filledBy || 'N/A';
        
        const totalSections = jsonData.formStructure ? jsonData.formStructure.length : 0;
        let totalFields = 0;
        
        if (jsonData.formStructure) {
            jsonData.formStructure.forEach(section => {
                if (section.fields) {
                    totalFields += section.fields.length;
                }
            });
        }
        
        document.getElementById('totalSections').textContent = totalSections;
        document.getElementById('totalFields').textContent = totalFields;
    }

    generateFormHTML(jsonData) {
        let html = `<div class="form-header">
            <h1>${jsonData.name || 'Untitled Form'}</h1>
            <p>${jsonData.description || 'No description available'}</p>
        </div>`;

        if (jsonData.formStructure) {
            jsonData.formStructure.forEach((section, sectionIndex) => {
                html += this.generateSectionHTML(section, sectionIndex);
            });
        }

        return html;
    }

    generateSectionHTML(section, sectionIndex) {
        let html = `<div class="form-section" data-section="${sectionIndex}">
            <h2 class="section-title">${section.sectionTitle || `Section ${sectionIndex + 1}`}</h2>`;

        if (section.fields) {
            section.fields.forEach((field, fieldIndex) => {
                html += this.generateFieldHTML(field, sectionIndex, fieldIndex);
            });
        }

        html += '</div>';
        return html;
    }

    generateFieldHTML(field, sectionIndex, fieldIndex) {
        const fieldId = `field_${sectionIndex}_${fieldIndex}`;
        const isRequired = field.required ? ' *' : '';
        const requiredClass = field.required ? 'required' : '';
        
        let html = `<div class="form-field ${field.fieldType}" data-field-type="${field.fieldType}" style="--field-index: ${fieldIndex}">
            <label class="field-label" for="${fieldId}">
                ${field.label || field.fieldName || 'Untitled Field'}
                ${isRequired ? '<span class="field-required">*</span>' : ''}
                <span class="field-type-badge ${field.fieldType}">${field.fieldType}</span>
            </label>`;

        switch (field.fieldType) {
            case 'text':
                html += `<input type="text" id="${fieldId}" name="${field.fieldName}" class="form-input ${requiredClass}" 
                    ${field.required ? 'required' : ''} 
                    ${field.default ? `value="${field.default}"` : ''} />`;
                break;

            case 'email':
                html += `<input type="email" id="${fieldId}" name="${field.fieldName}" class="form-input ${requiredClass}" 
                    ${field.required ? 'required' : ''} 
                    ${field.default ? `value="${field.default}"` : ''} />`;
                break;

            case 'textarea':
                html += `<textarea id="${fieldId}" name="${field.fieldName}" class="form-textarea ${requiredClass}" 
                    ${field.required ? 'required' : ''}>${field.default || ''}</textarea>`;
                break;

            case 'date':
                html += `<input type="date" id="${fieldId}" name="${field.fieldName}" class="form-input ${requiredClass}" 
                    ${field.required ? 'required' : ''} 
                    ${field.default ? `value="${field.default}"` : ''} />`;
                break;

            case 'signature':
                html += `<div class="signature-field" data-field="${fieldId}">
                    <i class="fas fa-signature"></i>
                    <p>Click here to add signature</p>
                    <small>Digital signature placeholder</small>
                </div>`;
                break;

            case 'checkbox':
                html += `<div class="checkbox-group">
                    <div class="checkbox-item">
                        <input type="checkbox" id="${fieldId}" name="${field.fieldName}" class="checkbox-input" 
                            ${field.required ? 'required' : ''} />
                        <label for="${fieldId}" class="checkbox-label">Yes/Enabled</label>
                    </div>
                </div>`;
                break;

            case 'multipleCheckbox':
                html += '<div class="checkbox-group">';
                if (field.options && Array.isArray(field.options)) {
                    field.options.forEach((option, optionIndex) => {
                        const optionId = `${fieldId}_option_${optionIndex}`;
                        html += `<div class="checkbox-item">
                            <input type="checkbox" id="${optionId}" name="${field.fieldName}" 
                                value="${option}" class="checkbox-input" />
                            <label for="${optionId}" class="checkbox-label">${option}</label>
                        </div>`;
                    });
                }
                html += '</div>';
                break;

            case 'dropdown':
                html += `<select id="${fieldId}" name="${field.fieldName}" class="form-select ${requiredClass}" 
                    ${field.required ? 'required' : ''}>`;
                if (field.options && Array.isArray(field.options)) {
                    if (field.default) {
                        html += `<option value="" disabled ${!field.default ? 'selected' : ''}>Select an option</option>`;
                    }
                    field.options.forEach((option, optionIndex) => {
                        const isSelected = field.default === option ? 'selected' : '';
                        html += `<option value="${option}" ${isSelected}>${option}</option>`;
                    });
                }
                html += '</select>';
                break;

            case 'info':
                html = `<div class="form-field info" data-field-type="info" style="--field-index: ${fieldIndex}">
                    <div class="info-field">
                        <i class="fas fa-info-circle" style="margin-right: 0.5rem; color: var(--primary-color);"></i>
                        ${field.label || field.fieldName || 'Information field'}
                    </div>
                </div>`;
                break;

            default:
                html += `<div class="info-field">
                    <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem; color: var(--warning-color);"></i>
                    Unsupported field type: ${field.fieldType}
                </div>`;
        }

        if (field.fieldType !== 'info') {
            html += '</div>';
        }

        return html;
    }

    setupFormInteractions() {
        // Add change listeners to all form inputs
        const formInputs = document.querySelectorAll('.form-input, .form-textarea, .checkbox-input');
        formInputs.forEach(input => {
            input.addEventListener('change', (e) => this.updateFormValue(e));
            input.addEventListener('input', (e) => this.updateFormValue(e));
        });

        // Signature field interactions
        const signatureFields = document.querySelectorAll('.signature-field');
        signatureFields.forEach(field => {
            field.addEventListener('click', () => {
                field.style.background = 'rgba(139, 95, 191, 0.1)';
                field.innerHTML = `
                    <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                    <p style="color: var(--success-color);">Signature Added</p>
                    <small>Click to change signature</small>
                `;
            });
        });
    }

    updateFormValue(event) {
        const input = event.target;
        const fieldName = input.name;
        
        if (input.type === 'checkbox') {
            if (!this.formValues[fieldName]) {
                this.formValues[fieldName] = [];
            }
            
            if (input.checked) {
                if (!this.formValues[fieldName].includes(input.value)) {
                    this.formValues[fieldName].push(input.value);
                }
            } else {
                this.formValues[fieldName] = this.formValues[fieldName].filter(val => val !== input.value);
            }
        } else {
            this.formValues[fieldName] = input.value;
        }
    }

    validateForm() {
        const validation = this.performValidation();
        this.showValidationResults(validation);
    }

    performValidation() {
        const results = {
            valid: true,
            errors: [],
            warnings: [],
            fieldCounts: {},
            totalFields: 0,
            requiredFields: 0,
            filledRequiredFields: 0
        };

        if (!this.currentFormData || !this.currentFormData.formStructure) {
            results.valid = false;
            results.errors.push('No form data to validate');
            return results;
        }

        // Count field types
        this.currentFormData.formStructure.forEach(section => {
            if (section.fields) {
                section.fields.forEach(field => {
                    results.totalFields++;
                    
                    if (!results.fieldCounts[field.fieldType]) {
                        results.fieldCounts[field.fieldType] = 0;
                    }
                    results.fieldCounts[field.fieldType]++;

                    // Check required fields
                    if (field.required) {
                        results.requiredFields++;
                        
                        const fieldValue = this.formValues[field.fieldName];
                        if (fieldValue && (Array.isArray(fieldValue) ? fieldValue.length > 0 : fieldValue.toString().trim())) {
                            results.filledRequiredFields++;
                        } else {
                            results.errors.push(`Required field "${field.label || field.fieldName}" is not filled`);
                        }
                    }

                    // Validate field structure
                    if (!field.fieldName) {
                        results.warnings.push(`Field in section "${section.sectionTitle}" missing fieldName`);
                    }
                    
                    if (!field.label) {
                        results.warnings.push(`Field "${field.fieldName}" missing label`);
                    }

                    // Validate multipleCheckbox options
                    if (field.fieldType === 'multipleCheckbox' && (!field.options || !Array.isArray(field.options))) {
                        results.warnings.push(`MultipleCheckbox field "${field.fieldName}" missing or invalid options array`);
                    }

                    // Validate dropdown options
                    if (field.fieldType === 'dropdown' && (!field.options || !Array.isArray(field.options))) {
                        results.warnings.push(`Dropdown field "${field.fieldName}" missing or invalid options array`);
                    }
                });
            }
        });

        if (results.errors.length > 0) {
            results.valid = false;
        }

        return results;
    }

    showValidationResults(validation) {
        const validationPanel = document.getElementById('validationPanel');
        const validationContent = document.getElementById('validationContent');

        let html = `
            <div class="validation-summary ${validation.valid ? 'valid' : 'invalid'}">
                <h4><i class="fas fa-${validation.valid ? 'check-circle' : 'exclamation-triangle'}"></i> 
                    Validation ${validation.valid ? 'Passed' : 'Failed'}</h4>
            </div>

            <div class="validation-stats">
                <h5>Form Statistics:</h5>
                <ul>
                    <li>Total Fields: ${validation.totalFields}</li>
                    <li>Required Fields: ${validation.requiredFields}</li>
                    <li>Filled Required: ${validation.filledRequiredFields}/${validation.requiredFields}</li>
                </ul>
            </div>

            <div class="field-type-breakdown">
                <h5>Field Type Breakdown:</h5>
                <ul>
        `;

        Object.entries(validation.fieldCounts).forEach(([type, count]) => {
            html += `<li>${type}: ${count}</li>`;
        });

        html += '</ul></div>';

        if (validation.errors.length > 0) {
            html += `
                <div class="validation-errors">
                    <h5><i class="fas fa-times-circle"></i> Errors (${validation.errors.length}):</h5>
                    <ul>
            `;
            validation.errors.forEach(error => {
                html += `<li>${error}</li>`;
            });
            html += '</ul></div>';
        }

        if (validation.warnings.length > 0) {
            html += `
                <div class="validation-warnings">
                    <h5><i class="fas fa-exclamation-triangle"></i> Warnings (${validation.warnings.length}):</h5>
                    <ul>
            `;
            validation.warnings.forEach(warning => {
                html += `<li>${warning}</li>`;
            });
            html += '</ul></div>';
        }

        validationContent.innerHTML = html;
        validationPanel.classList.add('open');

        // Add validation styles
        const style = document.createElement('style');
        style.textContent = `
            .validation-summary.valid { background: #d4edda; color: #155724; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
            .validation-summary.invalid { background: #f8d7da; color: #721c24; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
            .validation-stats, .field-type-breakdown, .validation-errors, .validation-warnings { margin-bottom: 1.5rem; }
            .validation-stats h5, .field-type-breakdown h5, .validation-errors h5, .validation-warnings h5 { 
                color: var(--primary-color); margin-bottom: 0.5rem; font-size: 1rem; 
            }
            .validation-errors { background: #fff5f5; padding: 1rem; border-radius: 8px; border-left: 4px solid var(--error-color); }
            .validation-warnings { background: #fffbf0; padding: 1rem; border-radius: 8px; border-left: 4px solid var(--warning-color); }
            .validation-stats ul, .field-type-breakdown ul, .validation-errors ul, .validation-warnings ul { 
                margin: 0; padding-left: 1.5rem; 
            }
            .validation-stats li, .field-type-breakdown li, .validation-errors li, .validation-warnings li { 
                margin-bottom: 0.25rem; 
            }
        `;
        document.head.appendChild(style);
    }

    closeValidationPanel() {
        document.getElementById('validationPanel').classList.remove('open');
    }

    exportFormData() {
        if (!this.currentFormData) {
            this.showNotification('No form data to export', 'error');
            return;
        }

        const exportData = {
            formStructure: this.currentFormData,
            formValues: this.formValues,
            exportTimestamp: new Date().toISOString(),
            validation: this.performValidation()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `form-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Form data exported successfully!', 'success');
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i>
            <span>${message}</span>
        `;

        // Add notification styles
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 2rem;
                right: 2rem;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                animation: slideInRight 0.3s ease-out;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                max-width: 300px;
                box-shadow: var(--card-shadow);
            }
            .notification.success { background: var(--success-color); }
            .notification.error { background: var(--error-color); }
            .notification.info { background: var(--primary-color); }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the form renderer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new JSONFormRenderer();
});


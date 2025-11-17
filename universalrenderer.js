import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiSave,
  FiSend,
  FiArrowLeft,
  FiUser,
  FiFileText,
  FiCalendar,
  FiMail,
  FiPhone,
  FiMapPin,
  FiHash,
  FiType,
  FiCheckSquare,
  FiChevronDown,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiChevronRight,
  FiBook,
  FiClipboard,
  FiUsers,
  FiAward,
  FiTarget,
} from "react-icons/fi";
 const logo = import.meta.env.VITE_LOGO_CA_URL;
import { applicationService } from "../../../../services/applicationService";
import { authService } from "../../../../services/authService";
import { formSubmissionService } from "../../../../services/formSubmissionService";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import USITooltip from "../../../../components/USITooltip";
 

const UniversalFormRenderer = () => {
  const { applicationId, formTemplateId, mode } = useParams();
  const navigate = useNavigate();
  const [formTemplate, setFormTemplate] = useState(null);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [application, setApplication] = useState(null);
  const [isResubmission, setIsResubmission] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  // RPL specific state
  const [expandedStages, setExpandedStages] = useState({});
  const [expandedUnits, setExpandedUnits] = useState({});
  // const [currentActiveStage, setCurrentActiveStage] = useState(0);

  // Map profile fields to common candidate field names
  const mapProfileToCandidate = (user) => ({
    firstName: user?.firstName || user?.givenName || "",
    lastName: user?.lastName || user?.surname || "",
    fullName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "",
    email: user?.email || "",
    phone: user?.phone || user?.mobile || "",
    address: user?.address?.full || [user?.address?.street, user?.address?.city, user?.address?.state, user?.address?.postalCode]
      .filter(Boolean)
      .join(", ") || "",
    dateOfBirth: user?.dateOfBirth || user?.dob || "",
    usi: user?.usi || "",
  });

  // Prefill candidate fields if the field name/label matches known keys and field is empty
  const prefillCandidateFields = (dataObject, allFields, user) => {
    const profile = mapProfileToCandidate(user);
    const candidateKeys = Object.keys(profile);
    allFields.forEach((field) => {
      const key = (field.fieldName || "").toLowerCase();
      const label = (field.label || "").toLowerCase();
      const isCandidateField =
        candidateKeys.some((k) => key.includes(k) || label.includes(k)) ||
        key.includes("candidate") || label.includes("candidate");

      if (!isCandidateField) return;

      // Try direct name match first, then by label containment
      let matchedValue = null;
      for (const k of candidateKeys) {
        if (key.includes(k) || label.includes(k)) {
          matchedValue = profile[k];
          break;
        }
      }

      if (matchedValue != null && matchedValue !== "") {
        const current = dataObject[field.fieldName];
        const isEmpty = current == null || current === "" || (Array.isArray(current) && current.length === 0);
        if (isEmpty) {
          dataObject[field.fieldName] = matchedValue;
        }
      }
    });
  };

  useEffect(() => {
    fetchFormData();
  }, [applicationId, formTemplateId]);

  const fetchFormData = async () => {
    try {
      setLoading(true);

      const isResubmit = mode === "resubmit";
      setIsResubmission(isResubmit);

      const [formResponse, appResponse, profileResponse] = await Promise.all([
        formSubmissionService.getFormForFilling(applicationId, formTemplateId),
        applicationService.getApplicationById(applicationId),
        authService.getProfile(),
      ]);

      setFormTemplate(formResponse.data.formTemplate);
      setExistingSubmission(formResponse.data.existingSubmission);
      setApplication(appResponse.data);
      const currentUser = profileResponse?.data?.user || profileResponse?.user || null;

      // Log validation mode for debugging
      console.log("Form validation mode:", {
        strictValidation: import.meta.env.VITE_STRICT_VALIDATION,
        formName: formResponse.data.formTemplate?.name,
        validationEnabled: import.meta.env.VITE_STRICT_VALIDATION !== 'false'
      });

      // Initialize form data
      if (formResponse.data.existingSubmission) {
        // Prefill candidate info for any missing/empty fields but keep it editable
        const template = formResponse.data.formTemplate;
        const allFields = getAllFields(template.formStructure);
        const existingData = { ...(formResponse.data.existingSubmission.formData || {}) };
        if (currentUser) {
          prefillCandidateFields(existingData, allFields, currentUser);
        }
        setFormData(existingData);
      } else {
        const initialData = {};

        // Check if this is an RPL form
        if (isRPLForm(formResponse.data.formTemplate)) {
          initializeRPLFormData(formResponse.data.formTemplate, initialData);
        } else {
          // Regular form initialization
        const allFields = getAllFields(
          formResponse.data.formTemplate.formStructure
        );
        allFields.forEach((field) => {
            if (field.fieldType === "checkbox" || field.fieldType === "multipleCheckbox") {
              if (field.options) {
                // Multiple checkbox with options - initialize as empty array
                initialData[field.fieldName] = [];
              } else {
                // Single checkbox - initialize as false
                initialData[field.fieldName] = false;
              }
            } else if (field.fieldType === "radio" && field.options) {
              initialData[field.fieldName] = "";
            } else {
              initialData[field.fieldName] = "";
          }
        });
        // Prefill candidate info with profile data while keeping fields editable
        if (currentUser) {
          prefillCandidateFields(initialData, allFields, currentUser);
        }
        }
        setFormData(initialData);
      }

      // Initialize expanded sections
      if (isRPLForm(formResponse.data.formTemplate)) {
        initializeRPLExpandedSections(formResponse.data.formTemplate);
      } else {
        const sectionsObj = {};
        console.log("Form structure:", formResponse.data.formTemplate.formStructure);
        console.log("Has nested sections:", hasNestedSections(formResponse.data.formTemplate.formStructure));
        
        if (hasNestedSections(formResponse.data.formTemplate.formStructure)) {
          formResponse.data.formTemplate.formStructure.forEach(
            (section, index) => {
              // For standard forms with fields, expand sections by default
              const sectionKey = section.section || index;
              sectionsObj[sectionKey] = true;
              console.log(`Setting section ${sectionKey} to expanded:`, sectionsObj[sectionKey]);
            }
          );
        }
        console.log("Final expanded sections object:", sectionsObj);
        setExpandedSections(sectionsObj);
      }
    } catch (error) {
      console.error("Error fetching form data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check if this is an RPL form
  const isRPLForm = (template) => {
    // All forms are treated the same - no special RPL handling needed
    return false;
  };

  // Helper function to detect USI fields with proper word boundaries
  const isUSIField = (field = {}, sectionTitle = "") => {
    try {
      const label = String(field.label || "").toLowerCase();
      const name = String(field.fieldName || "").toLowerCase();
      const title = String(sectionTitle || "").toLowerCase();
      
      // More explicit USI matching - only match when it's specifically about USI
      const usiRegex = /\busi\b/; // Word boundary to match "usi" as standalone word
      const uniqueStudentRegex = /unique\s+student\s+identifier/;
      
      return (
        usiRegex.test(label) ||
        uniqueStudentRegex.test(label) ||
        usiRegex.test(name) ||
        uniqueStudentRegex.test(name) ||
        usiRegex.test(title) ||
        uniqueStudentRegex.test(title)
      );
    } catch (_) {
      return false;
    }
  };

  // New renderer for Stage 1 Self-Assessment Checklist
  const renderStage1Checklist = (section) => {
    return (
      <div className="space-y-6">
        {section.fields?.map((field, fieldIndex) => (
          <div
            key={field.fieldName}
            className="border border-gray-200 rounded-xl p-6"
          >
            {field.fieldType !== "label" && field.fieldType !== "info" && (
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
                  {isUSIField(field) && (
                    <USITooltip />
                  )}
              </label>
            </div>
            )}

            {renderField(field)}

            {errors[field.fieldName] && (
              <div className="mt-2 flex items-center space-x-2 text-red-600 text-sm">
                <FiAlertCircle className="w-4 h-4" />
                <span>{errors[field.fieldName]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // New renderer for Stage 2 Assessment Questions
  const renderStage2Questions = (section) => {
    return (
      <div className="space-y-8">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-blue-900 mb-3">
            Instructions
          </h4>
          <p className="text-blue-800 mb-4">
            For each question, select Never, Sometimes, or Regularly based on
            your experience.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["Regularly", "Sometimes", "Never"].map((option, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-3 border border-blue-200"
              >
                <span className="font-medium text-blue-900">{option}</span>
              </div>
            ))}
          </div>
        </div>

        {section.fields?.map((unitField) => (
          <div
            key={unitField.fieldName}
            className="border border-gray-200 rounded-xl overflow-hidden"
          >
            <div
              className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 cursor-pointer hover:from-indigo-100 hover:to-purple-100 transition-all duration-200"
              onClick={() => toggleUnit(unitField.fieldName)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                  <FiAward className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">
                    {unitField.label}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {unitField.totals?.totalQuestions || 0} questions
                  </p>
                </div>
              </div>
              <FiChevronRight
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                  expandedUnits[unitField.fieldName] ? "rotate-90" : ""
                }`}
              />
            </div>

            {expandedUnits[unitField.fieldName] && (
              <div className="p-6 space-y-6">
                {unitField.questions?.map((question, questionIndex) => (
                  <div
                    key={question.questionId}
                    className="bg-white rounded-lg p-4 border border-gray-200"
                  >
                    <p className="text-sm text-gray-700 mb-3">
                      {question.question}
                    </p>

                    <div className="flex space-x-6">
                      {question.options?.map((option) => (
                        <div
                          key={option}
                          className="flex items-center space-x-2"
                        >
                          <div
                            className="relative cursor-pointer"
                            onClick={() =>
                              handleInputChange(question.questionId, option)
                            }
                          >
                            <div
                              className={`
                              w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200
                              ${
                                formData[question.questionId] === option
                                  ? "bg-indigo-500 border-indigo-500"
                                  : "border-gray-300 hover:border-gray-400"
                              }
                            `}
                            >
                              {formData[question.questionId] === option && (
                                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                              )}
                            </div>
                          </div>
                          <label
                            className="text-xs text-gray-600 cursor-pointer"
                            onClick={() =>
                              handleInputChange(question.questionId, option)
                            }
                          >
                            {option}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // New renderer for Evidence Matrix (Table B)
  const renderEvidenceMatrix = (section) => {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-amber-900 mb-2">
            Evidence Matrix
          </h4>
          <p className="text-amber-800">
            Check the boxes to indicate which evidence types you have for each
            unit.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-xl border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Evidence Type
                </th>
                {/* Render unit headers - you'll need to extract unit codes from your structure */}
                {[
                  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
                  19,
                ].map((unitNum) => (
                  <th
                    key={unitNum}
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Unit {unitNum}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {section.fields?.map((evidenceField, evidenceIndex) => (
                <tr key={evidenceField.fieldName} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded text-xs flex items-center justify-center font-medium">
                        {evidenceIndex + 1}
                      </span>
                      <span>{evidenceField.label}</span>
                    </div>
                  </td>
                  {evidenceField.units?.map((unit, unitIndex) => {
                    const fieldName = `${evidenceField.fieldName}_${unit}`;
                    const isChecked = formData[fieldName] || false;

                    return (
                      <td key={unitIndex} className="px-4 py-3 text-center">
                        <div
                          className="relative cursor-pointer inline-flex"
                          onClick={() =>
                            handleInputChange(fieldName, !isChecked)
                          }
                        >
                          <div
                            className={`
                            w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
                            ${
                              isChecked
                                ? "bg-blue-500 border-blue-500"
                                : "border-gray-300 hover:border-gray-400"
                            }
                          `}
                          >
                            {isChecked && (
                              <FiCheckSquare className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Initialize RPL form data
  const initializeRPLFormData = (template, initialData) => {
    template.formStructure.forEach((section) => {
      if (section.section === "stage1Checklist") {
        section.content.subsections?.forEach((subsection) => {
          if (subsection.fieldType === "checkbox" && subsection.options) {
            initialData[subsection.id] = [];
          }
        });
      } else if (section.section === "stage2Questions") {
        section.content.units?.forEach((unit) => {
          unit.questions?.forEach((category) => {
            category.tasks?.forEach((task, taskIndex) => {
              const fieldName = `${unit.unitCode}_${category.category}_${taskIndex}`;
              initialData[fieldName] = "";
            });
          });
        });
      } else if (section.section === "tableA" || section.section === "tableB") {
        // Initialize evidence matrix data
        section.content.units?.forEach((unit) => {
          section.content.evidenceTypes?.forEach((evidenceType) => {
            const fieldName = `${section.section}_${unit.unitCode || unit}_${
              evidenceType.id
            }`;
            initialData[fieldName] = false;
          });
        });
      } else if (section.section === "stage1SelfAssessmentChecklist") {
        section.fields?.forEach((field) => {
          if (field.fieldType === "checkbox" && field.options) {
            initialData[field.fieldName] = [];
          } else if (field.fieldType === "radio") {
            initialData[field.fieldName] = "";
          } else {
            initialData[field.fieldName] = "";
          }
        });
      }

      // Handle Stage 2 - Self-Assessment Questions
      else if (section.section === "stage2SelfAssessmentQuestions") {
        section.fields?.forEach((unitField) => {
          if (unitField.questions) {
            unitField.questions.forEach((question) => {
              initialData[question.questionId] = "";
            });
          }
        });
      }

      // Handle Table A and Table B - Evidence Mapping
      else if (
        section.section === "tableAEvidenceMapping" ||
        section.section === "tableBEvidenceTypes"
      ) {
        section.fields?.forEach((field) => {
          if (field.subFields) {
            field.subFields.forEach((subField) => {
              initialData[subField.fieldName] = false;
            });
          }
          if (field.fieldType === "evidenceMatrix") {
            field.units?.forEach((unit) => {
              const fieldName = `${field.fieldName}_${unit}`;
              initialData[fieldName] = false;
            });
          }
        });
      }
    });
  };

  // Initialize RPL expanded sections
  // Initialize RPL expanded sections
  const initializeRPLExpandedSections = (template) => {
    const stagesObj = {};
    const unitsObj = {};

    template.formStructure.forEach((section, index) => {
      stagesObj[section.section || index]  = false; // Open all sections by default for RPL 

      if (section.section === "stage2Questions" && section.content.units) {
        section.content.units.forEach((unit) => {
          unitsObj[unit.unitCode] = false;
        });
      }
    });

    setExpandedStages(stagesObj);
    setExpandedUnits(unitsObj);
  };

  // Helper function to check if form structure has nested sections
  const hasNestedSections = (formStructure) => {
    return (
      formStructure && formStructure.length > 0 && formStructure[0].section
    );
  };

  // Helper function to get all fields from either flat or nested structure
  // Enhanced getAllFields function to handle complex structures
  const getAllFields = (formStructure) => {
    if (!formStructure) return [];

    if (hasNestedSections(formStructure)) {
      const fields = formStructure.flatMap((section) => section.fields || []);

      // Add virtual fields for ALL sections without explicit fields
      formStructure.forEach((section) => {
        if (!section.fields && section.content) {
          const sectionKey = section.section || "general";

          // Add acknowledgement field for every content section
          fields.push({
            fieldName: `${sectionKey}_acknowledgement`,
            fieldType: "checkbox",
            label: "Acknowledgement",
            required: true,
          });

          // Handle simple fields arrays
          if (section.content.fields && Array.isArray(section.content.fields)) {
            section.content.fields.forEach((field) => {
              fields.push(field);
            });
          }

          // Handle unit competency structures
          if (Array.isArray(section.content)) {
            section.content.forEach((unit, unitIndex) => {
              if (unit.unitCode) {
                // Read competency standards
                if (unit.readCompetencyStandards) {
                  fields.push({
                    fieldName: `${unit.unitCode}_readStandards`,
                    fieldType: "radio",
                    label: "Have you read the competency standards?",
                    options: unit.readCompetencyStandards.options || [
                      "Yes",
                      "No",
                    ],
                    required: true,
                  });
                }

                // Competencies
                if (unit.competencies && Array.isArray(unit.competencies)) {
                  unit.competencies.forEach((competency, compIndex) => {
                    if (competency.frequency) {
                      fields.push({
                        fieldName: `${unit.unitCode}_comp${compIndex}_frequency`,
                        fieldType: "radio",
                        label: `Competency ${compIndex + 1} Frequency`,
                        options: competency.frequency.options || [
                          "Often",
                          "Sometimes",
                          "Rarely",
                        ],
                        required: true,
                      });
                    }

                    if (competency.explanation) {
                      fields.push({
                        fieldName: `${unit.unitCode}_comp${compIndex}_explanation`,
                        fieldType: "textarea",
                        label: `Competency ${compIndex + 1} Explanation`,
                        required: false,
                      });
                    }
                  });
                }

                // Additional information
                if (unit.additionalInformation) {
                  fields.push({
                    fieldName: `${unit.unitCode}_additionalInfo`,
                    fieldType: "textarea",
                    label:
                      unit.additionalInformation.label ||
                      "Additional Information",
                    required: false,
                  });
                }

                // Signature
                if (unit.thirdPartySignature) {
                  fields.push({
                    fieldName: `${unit.unitCode}_signature`,
                    fieldType: "text",
                    label: unit.thirdPartySignature.label || "Signature",
                    required: true,
                  });
                }

                // Date
                if (unit.date) {
                  fields.push({
                    fieldName: `${unit.unitCode}_date`,
                    fieldType: "date",
                    label: unit.date.label || "Date",
                    required: true,
                  });
                }

                // RTO Use Only fields
                if (unit.rtoUseOnly) {
                  if (unit.rtoUseOnly.assessorName) {
                    fields.push({
                      fieldName: `${unit.unitCode}_assessorName`,
                      fieldType: "text",
                      label:
                        unit.rtoUseOnly.assessorName.label || "Assessor Name",
                      required: false,
                    });
                  }

                  if (unit.rtoUseOnly.verified) {
                    fields.push({
                      fieldName: `${unit.unitCode}_verified`,
                      fieldType: "radio",
                      label: unit.rtoUseOnly.verified.label || "Verified",
                      options: unit.rtoUseOnly.verified.options || [
                        "Yes",
                        "No",
                      ],
                      required: false,
                    });
                  }

                  if (unit.rtoUseOnly.verificationDate) {
                    fields.push({
                      fieldName: `${unit.unitCode}_verificationDate`,
                      fieldType: "date",
                      label:
                        unit.rtoUseOnly.verificationDate.label ||
                        "Verification Date",
                      required: false,
                    });
                  }
                }
              }
            });
          }
        }
      });

      return fields;
    } else {
      return formStructure;
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Check if strict validation is enabled via environment variable
    // VITE_STRICT_VALIDATION=false -> Skip required field validation (for testing)
    // VITE_STRICT_VALIDATION=true or unset -> Enable full validation (for production)
    const strictValidation = import.meta.env.VITE_STRICT_VALIDATION !== 'false';
    
    // If strict validation is disabled, only validate non-required validations (email format, number format)
    if (!strictValidation) {
      console.log("Strict validation disabled via env var - skipping required field validation");
      
      // Only validate email and number format, not required fields
      if (isRPLForm(formTemplate)) {
        validateRPLForm(newErrors, false); // Pass false to skip required validation
      } else {
        const allFields = getAllFields(formTemplate.formStructure);
        allFields.forEach((field) => {
          // Email validation (always validate format)
          if (field.fieldType === "email" && formData[field.fieldName]) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData[field.fieldName])) {
              newErrors[field.fieldName] = `${field.label} must be a valid email`;
            }
          }

          // Number validation (always validate format)
          if (field.fieldType === "number" && formData[field.fieldName]) {
            if (isNaN(formData[field.fieldName])) {
              newErrors[field.fieldName] = `${field.label} must be a number`;
            }
          }
        });
      }
      
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    // Strict validation enabled - validate everything
    if (isRPLForm(formTemplate)) {
      // RPL specific validation
      validateRPLForm(newErrors, true);
    } else {
      // Regular form validation
      const allFields = getAllFields(formTemplate.formStructure);
      allFields.forEach((field) => {
        if (field.required) {
          const value = formData[field.fieldName];

          if (field.fieldType === "checkbox") {
            if (!value) {
              newErrors[field.fieldName] = `${field.label} is required`;
            }
          } else if (!value || value === "") {
            newErrors[field.fieldName] = `${field.label} is required`;
          }
        }

        // Email validation
        if (field.fieldType === "email" && formData[field.fieldName]) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(formData[field.fieldName])) {
            newErrors[field.fieldName] = `${field.label} must be a valid email`;
          }
        }

        // Number validation
        if (field.fieldType === "number" && formData[field.fieldName]) {
          if (isNaN(formData[field.fieldName])) {
            newErrors[field.fieldName] = `${field.label} must be a number`;
          }
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRPLForm = (newErrors, strictValidation = true) => {
    // Add RPL specific validation logic here
    // For example, check if minimum questions are answered per unit
    console.log("RPL form validation would go here");
    
    if (strictValidation) {
      // Add strict validation logic for RPL forms
      // This would include checking required fields, minimum questions answered, etc.
      console.log("Strict RPL validation enabled");
    } else {
      console.log("Loose RPL validation - skipping required field checks");
    }
  };

  const handleInputChange = (fieldName, value) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));

    if (errors[fieldName]) {
      setErrors((prev) => ({
        ...prev,
        [fieldName]: "",
      }));
    }
  };

  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const toggleStage = (stageKey) => {
    setExpandedStages((prev) => ({
      ...prev,
      [stageKey]: !prev[stageKey],
    }));
  };

  const toggleUnit = (unitKey) => {
    setExpandedUnits((prev) => ({
      ...prev,
      [unitKey]: !prev[unitKey],
    }));
  };

  // Collapse/Expand all functions
  const expandAllSections = () => {
    if (!formTemplate?.formStructure) return;
    const allSections = {};
    formTemplate.formStructure.forEach((section, index) => {
      const sectionKey = section.section || index;
      allSections[sectionKey] = true;
    });
    setExpandedSections(allSections);
  };

  const collapseAllSections = () => {
    if (!formTemplate?.formStructure) return;
    const allSections = {};
    formTemplate.formStructure.forEach((section, index) => {
      const sectionKey = section.section || index;
      allSections[sectionKey] = false;
    });
    setExpandedSections(allSections);
  };

  const expandAllStages = () => {
    if (!formTemplate?.formStructure) return;
    const allStages = {};
    formTemplate.formStructure.forEach((section, index) => {
      const sectionKey = section.section || index;
      allStages[sectionKey] = true;
    });
    setExpandedStages(allStages);
  };

  const collapseAllStages = () => {
    if (!formTemplate?.formStructure) return;
    const allStages = {};
    formTemplate.formStructure.forEach((section, index) => {
      const sectionKey = section.section || index;
      allStages[sectionKey] = false;
    });
    setExpandedStages(allStages);
  };

  // Check if all sections are expanded
  const areAllSectionsExpanded = () => {
    if (!formTemplate?.formStructure) return false;
    return formTemplate.formStructure.every((section, index) => {
      const sectionKey = section.section || index;
      return expandedSections[sectionKey] === true;
    });
  };

  // Check if all stages are expanded
  const areAllStagesExpanded = () => {
    if (!formTemplate?.formStructure) return false;
    return formTemplate.formStructure.every((section, index) => {
      const sectionKey = section.section || index;
      return expandedStages[sectionKey] === true;
    });
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);

      if (isResubmission) {
        await formSubmissionService.resubmitForm(existingSubmission.id, {
          formData,
          status: "draft",
        });
      } else {
        await formSubmissionService.submitForm(applicationId, formTemplateId, {
          formData,
          status: "draft",
        });
      }

      alert("Draft saved successfully!");
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Error saving draft. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
       if (!validateForm()) {
    // Add this toast notification
    toast.error("Please fix the errors before submitting.");
    return;
  }
      setSubmitting(true);

      if (isResubmission) {
        await formSubmissionService.resubmitForm(existingSubmission.id, {
          formData,
        });
      } else {
        await formSubmissionService.submitForm(applicationId, formTemplateId, {
          formData,
          status: "submitted",
        });
      }

      navigate("/dashboard");
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Error submitting form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldIcon = (fieldType) => {
    switch (fieldType) {
      case "email":
        return <FiMail className="w-4 h-4" />;
      case "phone":
        return <FiPhone className="w-4 h-4" />;
      case "date":
        return <FiCalendar className="w-4 h-4" />;
      case "number":
        return <FiHash className="w-4 h-4" />;
      case "checkbox":
      case "checkbox-matrix":
        return <FiCheckSquare className="w-4 h-4" />;
      case "rating-matrix":
        return <FiTarget className="w-4 h-4" />;
      case "select":
        return <FiChevronDown className="w-4 h-4" />;
      case "textarea":
        return <FiFileText className="w-4 h-4" />;
      default:
        return <FiType className="w-4 h-4" />;
    }
  };

  const renderField = (field) => {
    const hasError = errors[field.fieldName];
    const value = formData[field.fieldName] || "";

    const baseInputClasses = `
      w-full px-4 py-3 rounded-xl border transition-all duration-200
      ${
        hasError
          ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
          : "border-gray-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      }
      focus:outline-none
    `;

    switch (field.fieldType) {
      case "info":
        return (
          <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
            {field.label && (
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{field.label}</p>
            )}
            {field.text && (
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{field.text}</p>
            )}
            {field.image && (
              <div className="mt-3">
                <img src={field.image} alt={field.label || "info"} className="max-w-full h-auto rounded" />
              </div>
            )}
          </div>
        );

      case "label":
        return (
          <div className="p-4 bg-gray-50 border-l-4 border-gray-300 rounded">
            {field.label && (
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{field.label}</p>
            )}
            {field.text && (
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{field.text}</p>
            )}
            {field.image && (
              <div className="mt-3">
                <img src={field.image} alt={field.label || "label"} className="max-w-full h-auto rounded" />
               </div>
            )}
          </div>
        );
      case "text":
      case "email":
      case "phone":
      case "tel":
      case "number":
        const isUsiField = isUSIField(field);
        return (
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {getFieldIcon(field.fieldType)}
            </div>
            <input
              type={isUsiField ? "text" : (field.fieldType === "number" ? "number" : "text")}
              value={value}
              onChange={(e) =>
                handleInputChange(field.fieldName, e.target.value)
              }
              placeholder={field.placeholder}
              maxLength={isUsiField ? 10 : undefined}
              className={`${baseInputClasses} pl-11`}
            />
          </div>
        );

      case "date":
        return (
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <FiCalendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={value}
              onChange={(e) =>
                handleInputChange(field.fieldName, e.target.value)
              }
              className={`${baseInputClasses} pl-11`}
              {
                ...(() => {
                  // Backdating rule: disallow past dates for all date fields
                  // EXCEPT for date of birth fields, where future dates are disallowed
                  const today = new Date().toISOString().split("T")[0];
                  const name = String(field.fieldName || "").toLowerCase();
                  const label = String(field.label || "").toLowerCase();
                  const isDOB = /\b(dob|date\s*of\s*birth|birth)\b/.test(name) || /\b(dob|date\s*of\s*birth|birth)\b/.test(label);
                  return isDOB ? { max: today } : { min: today };
                })()
              }
            />
          </div>
        );

      case "textarea":
        return (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={baseInputClasses}
          />
        );

      case "select":
        return (
          <div className="relative">
            <select
              value={value}
              onChange={(e) =>
                handleInputChange(field.fieldName, e.target.value)
              }
              className={`${baseInputClasses} appearance-none cursor-pointer`}
            >
              <option value="">Select</option>
              {field.options?.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              <FiChevronDown className="w-4 h-4" />
            </div>
          </div>
        );

      case "radio":
        return (
          <div className="space-y-3">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div
                  className="relative cursor-pointer"
                  onClick={() => handleInputChange(field.fieldName, option)}
                >
                  <input
                    type="radio"
                    name={field.fieldName}
                    value={option}
                    checked={value === option}
                    onChange={(e) =>
                      handleInputChange(field.fieldName, e.target.value)
                    }
                    className="sr-only"
                  />
                  <div
                    className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200
                    ${
                      value === option
                        ? "bg-blue-500 border-blue-500"
                        : "border-gray-300 hover:border-gray-400"
                    }
                  `}
                  >
                    {value === option && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                </div>
                <label
                  className="text-sm text-gray-700 cursor-pointer"
                  onClick={() => handleInputChange(field.fieldName, option)}
                >
                  {option}
                </label>
              </div>
            ))}
          </div>
        );

      case "checkbox":
      case "multipleCheckbox":
        if (field.options) {
          const selectedValues = Array.isArray(value) ? value : [];
          return (
            <div className="space-y-3">
              {field.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div
                    className="relative cursor-pointer"
                    onClick={() => {
                      const newValues = selectedValues.includes(option)
                        ? selectedValues.filter((v) => v !== option)
                        : [...selectedValues, option];
                      handleInputChange(field.fieldName, newValues);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(option)}
                      onChange={() => {}}
                      className="sr-only"
                    />
                    <div
                      className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
                      ${
                        selectedValues.includes(option)
                          ? "bg-blue-500 border-blue-500"
                          : "border-gray-300 hover:border-gray-400"
                      }
                    `}
                    >
                      {selectedValues.includes(option) && (
                        <FiCheckSquare className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                  <label
                    className="text-sm text-gray-700 cursor-pointer"
                    onClick={() => {
                      const newValues = selectedValues.includes(option)
                        ? selectedValues.filter((v) => v !== option)
                        : [...selectedValues, option];
                      handleInputChange(field.fieldName, newValues);
                    }}
                  >
                    {option}
                  </label>
                </div>
              ))}
            </div>
          );
        } else {
          return (
            <div className="flex items-center space-x-3">
              <div
                className="relative cursor-pointer"
                onClick={() => handleInputChange(field.fieldName, !value)}
              >
                <input
                  type="checkbox"
                  checked={!!value}
                  onChange={(e) =>
                    handleInputChange(field.fieldName, e.target.checked)
                  }
                  className="sr-only"
                />
                <div
                  className={`
                  w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
                  ${
                    value
                      ? "bg-blue-500 border-blue-500"
                      : "border-gray-300 hover:border-gray-400"
                  }
                `}
                >
                  {value && <FiCheckSquare className="w-3 h-3 text-white" />}
                </div>
              </div>
              <label
                className="text-sm text-gray-700 cursor-pointer"
                onClick={() => handleInputChange(field.fieldName, !value)}
              >
                {field.label}
              </label>
            </div>
          );
        }

      case "assessmentMatrix":
        // Render a list of questions with radio options. Each answer is stored as `${field.fieldName}_${questionId}`
        return (
          <div className="space-y-4">
            {Array.isArray(field.questions) && field.questions.length > 0 ? (
              field.questions.map((q, qIndex) => {
                const qKey = `${field.fieldName}_${q.questionId}`;
                const qValue = formData[qKey] || "";
                const options = q.options || ["Never", "Sometimes", "Regularly"];
                return (
                  <div key={qKey} className="p-4 border border-gray-200 rounded-xl">
                    <p className="text-sm text-gray-800 mb-3">{q.question}</p>
                    <div className="flex flex-wrap gap-4">
                      {options.map((opt, optIndex) => (
                        <label key={`${qKey}_${optIndex}`} className="inline-flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name={qKey}
                            value={opt}
                            checked={qValue === opt}
                            onChange={(e) => handleInputChange(qKey, e.target.value)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500">No questions configured.</div>
            )}
          </div>
        );

      case "checkbox-matrix":
        // Render a matrix of checkboxes with units as columns
        return (
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                      Evidence Type
                    </th>
                    {field.units?.map((unit, index) => (
                      <th key={index} className="px-3 py-3 text-center text-xs font-medium text-gray-700 border-b border-gray-200 min-w-[80px]">
                        {unit}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-200 font-medium">
                      {field.label}
                    </td>
                    {field.units?.map((unit, unitIndex) => {
                      const checkboxKey = `${field.fieldName}_${unit}`;
                      const isChecked = formData[checkboxKey] || false;
                      return (
                        <td key={unitIndex} className="px-3 py-3 text-center border-b border-gray-200">
                          <div className="flex justify-center">
                            <div
                              className="relative cursor-pointer"
                              onClick={() => handleInputChange(checkboxKey, !isChecked)}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="sr-only"
                              />
                              <div
                                className={`
                                w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
                                ${
                                  isChecked
                                    ? "bg-blue-500 border-blue-500"
                                    : "border-gray-300 hover:border-gray-400"
                                }
                              `}
                              >
                                {isChecked && (
                                  <FiCheckSquare className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "rating-matrix":
        // Render a matrix of questions with rating options
        return (
          <div className="space-y-4">
            {Array.isArray(field.questions) && field.questions.length > 0 ? (
              field.questions.map((question, qIndex) => {
                const questionKey = `${field.fieldName}_question_${qIndex}`;
                const questionValue = formData[questionKey] || "";
                const options = field.options || ["Never", "Sometimes", "Regularly"];
                return (
                  <div key={questionKey} className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                    <p className="text-sm font-medium text-gray-800 mb-3">
                      {qIndex + 1}. {question}
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {options.map((option, optIndex) => (
                        <label key={`${questionKey}_${optIndex}`} className="inline-flex items-center space-x-2 cursor-pointer">
                          <div
                            className="relative cursor-pointer"
                            onClick={() => handleInputChange(questionKey, option)}
                          >
                            <input
                              type="radio"
                              name={questionKey}
                              value={option}
                              checked={questionValue === option}
                              onChange={(e) => handleInputChange(questionKey, e.target.value)}
                              className="sr-only"
                            />
                            <div
                              className={`
                              w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200
                              ${
                                questionValue === option
                                  ? "bg-blue-500 border-blue-500"
                                  : "border-gray-300 hover:border-gray-400"
                              }
                            `}
                            >
                              {questionValue === option && (
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              )}
                            </div>
                          </div>
                          <span className="text-sm text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500">No questions configured.</div>
            )}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClasses}
          />
        );
    }
  };

  // Generic function to render any content structure
  // Enhanced generic function to render any content structure
  const renderGenericContent = (content, sectionKey) => {
    if (!content) return null;

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 rounded-lg p-4">
          {/* Description */}
          {content.description && (
            <p className="text-blue-800 mb-4">{content.description}</p>
          )}

          {/* Contents array */}
          {content.contents && Array.isArray(content.contents) && (
            <ul className="space-y-2 mb-4">
              {content.contents.map((item, index) => (
                <li
                  key={index}
                  className="text-blue-700 text-sm flex items-start space-x-2"
                >
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Steps array */}
          {content.steps && Array.isArray(content.steps) && (
            <div className="space-y-3 mb-4">
              {content.steps.map((step, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg p-3 border border-blue-200"
                >
                  <h5 className="font-semibold text-blue-900">
                    {step.stepNumber
                      ? `Step ${step.stepNumber}`
                      : `Step ${index + 1}`}
                    : {step.title}
                  </h5>
                  {step.description && (
                    <p className="text-blue-700 text-sm mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Rules array */}
          {content.rules && Array.isArray(content.rules) && (
            <div className="space-y-3 mb-4">
              {content.rules.map((rule, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg p-4 border border-blue-200"
                >
                  <h5 className="font-semibold text-blue-900 mb-2">
                    {rule.type}
                  </h5>
                  {rule.criteria && Array.isArray(rule.criteria) && (
                    <ul className="space-y-1">
                      {rule.criteria.map((criterion, criterionIndex) => (
                        <li
                          key={criterionIndex}
                          className="text-blue-700 text-sm flex items-start space-x-2"
                        >
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Purposes array */}
          {content.purposes && Array.isArray(content.purposes) && (
            <div className="bg-white rounded-lg p-4 border border-blue-200 mb-4">
              <h5 className="font-semibold text-blue-900 mb-2">Purpose</h5>
              <ul className="space-y-1">
                {content.purposes.map((purpose, index) => (
                  <li
                    key={index}
                    className="text-blue-700 text-sm flex items-start space-x-2"
                  >
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{purpose}</span>
                  </li>
                ))}
              </ul>
              {content.process && (
                <p className="text-blue-700 text-sm mt-3">
                  <strong>Process:</strong> {content.process}
                </p>
              )}
            </div>
          )}

          {/* Handle any other properties */}
          {Object.entries(content).map(([key, value]) => {
            // Skip already rendered properties
            if (
              [
                "description",
                "contents",
                "steps",
                "rules",
                "purposes",
                "process",
              ].includes(key)
            ) {
              return null;
            }

            // Handle arrays
            if (Array.isArray(value)) {
              // Special handling for fields array
              if (key === "fields") {
                return (
                  <div key={key} className="space-y-6">
                    <h5 className="font-semibold text-blue-900 mb-3 capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </h5>
                    {value.map((field, fieldIndex) => (
                      <div key={field.fieldName || fieldIndex}>
                        {field.fieldType !== "checkbox" || !field.options ? (
                          field.fieldType !== "label" && field.fieldType !== "info" ? (
                          <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                                {field.label}
                              {field.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                                {isUSIField(field) && (
                                  <USITooltip />
                              )}
                            </label>

                            {field.description && (
                                <p className="text-xs text-gray-500 mb-3">
                                  {field.description}
                              </p>
                            )}
                          </div>
                          ) : null
                        ) : null}

                        {renderField(field)}

                        {errors[field.fieldName] && (
                          <div className="mt-2 flex items-center space-x-2 text-red-600 text-sm">
                            <FiAlertCircle className="w-4 h-4" />
                            <span>{errors[field.fieldName]}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }

              // Handle unit competency arrays
              if (
                value.every(
                  (item) => item.unitCode || item.unitName || item.competencies
                )
              ) {
                return (
                  <div key={key} className="space-y-6">
                    <h5 className="font-semibold text-blue-900 mb-3 capitalize">
                      Unit Competencies
                    </h5>
                    {value.map((unit, unitIndex) => (
                      <div
                        key={unitIndex}
                        className="border border-gray-200 rounded-xl p-6"
                      >
                        <div className="mb-6">
                          <h6 className="text-lg font-semibold text-gray-800">
                            {unit.unitCode} - {unit.unitName}
                          </h6>
                        </div>

                        {/* Read Competency Standards */}
                        {unit.readCompetencyStandards && (
                          <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-800 mb-2">
                              Have you read the competency standards for this
                              unit?
                            </label>
                            <div className="flex space-x-6">
                              {unit.readCompetencyStandards.options?.map(
                                (option) => (
                                  <div
                                    key={option}
                                    className="flex items-center space-x-2"
                                  >
                                    <div
                                      className="relative cursor-pointer"
                                      onClick={() => {
                                        const fieldName = `${unit.unitCode}_readStandards`;
                                        handleInputChange(fieldName, option);
                                      }}
                                    >
                                      <div
                                        className={`
                                      w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200
                                      ${
                                        formData[
                                          `${unit.unitCode}_readStandards`
                                        ] === option
                                          ? "bg-blue-500 border-blue-500"
                                          : "border-gray-300 hover:border-gray-400"
                                      }
                                    `}
                                      >
                                        {formData[
                                          `${unit.unitCode}_readStandards`
                                        ] === option && (
                                          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                        )}
                                      </div>
                                    </div>
                                    <label
                                      className="text-sm text-gray-600 cursor-pointer"
                                      onClick={() => {
                                        const fieldName = `${unit.unitCode}_readStandards`;
                                        handleInputChange(fieldName, option);
                                      }}
                                    >
                                      {option}
                                    </label>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {/* Competencies */}
                        {unit.competencies &&
                          Array.isArray(unit.competencies) && (
                            <div className="space-y-4">
                              <h6 className="font-semibold text-gray-800">
                                Competencies Assessment
                              </h6>
                              {unit.competencies.map(
                                (competency, compIndex) => (
                                  <div
                                    key={compIndex}
                                    className="bg-gray-50 rounded-lg p-4"
                                  >
                                    <p className="text-sm text-gray-700 mb-3">
                                      {competency.description}
                                    </p>

                                    {/* Frequency */}
                                    {competency.frequency && (
                                      <div className="mb-3">
                                        <label className="block text-xs font-medium text-gray-600 mb-2">
                                          How often do you perform this task?
                                        </label>
                                        <div className="flex space-x-4">
                                          {competency.frequency.options?.map(
                                            (option) => (
                                              <div
                                                key={option}
                                                className="flex items-center space-x-2"
                                              >
                                                <div
                                                  className="relative cursor-pointer"
                                                  onClick={() => {
                                                    const fieldName = `${unit.unitCode}_comp${compIndex}_frequency`;
                                                    handleInputChange(
                                                      fieldName,
                                                      option
                                                    );
                                                  }}
                                                >
                                                  <div
                                                    className={`
                                              w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200
                                              ${
                                                formData[
                                                  `${unit.unitCode}_comp${compIndex}_frequency`
                                                ] === option
                                                  ? "bg-blue-500 border-blue-500"
                                                  : "border-gray-300 hover:border-gray-400"
                                              }
                                            `}
                                                  >
                                                    {formData[
                                                      `${unit.unitCode}_comp${compIndex}_frequency`
                                                    ] === option && (
                                                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                                    )}
                                                  </div>
                                                </div>
                                                <label
                                                  className="text-xs text-gray-600 cursor-pointer"
                                                  onClick={() => {
                                                    const fieldName = `${unit.unitCode}_comp${compIndex}_frequency`;
                                                    handleInputChange(
                                                      fieldName,
                                                      option
                                                    );
                                                  }}
                                                >
                                                  {option}
                                                </label>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Explanation */}
                                    {competency.explanation && (
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-2">
                                          Please explain or provide examples:
                                        </label>
                                        <textarea
                                          value={
                                            formData[
                                              `${unit.unitCode}_comp${compIndex}_explanation`
                                            ] || ""
                                          }
                                          onChange={(e) => {
                                            const fieldName = `${unit.unitCode}_comp${compIndex}_explanation`;
                                            handleInputChange(
                                              fieldName,
                                              e.target.value
                                            );
                                          }}
                                          placeholder="Provide explanation or examples..."
                                          rows={2}
                                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100 focus:outline-none text-sm"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          )}

                        {/* Additional Information */}
                        {unit.additionalInformation && (
                          <div className="mt-6">
                            <label className="block text-sm font-medium text-gray-800 mb-2">
                              {unit.additionalInformation.label}
                            </label>
                            <textarea
                              value={
                                formData[`${unit.unitCode}_additionalInfo`] ||
                                ""
                              }
                              onChange={(e) => {
                                const fieldName = `${unit.unitCode}_additionalInfo`;
                                handleInputChange(fieldName, e.target.value);
                              }}
                              placeholder="Provide any additional information..."
                              rows={3}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                            />
                          </div>
                        )}

                        {/* Third Party Signature */}
                        {unit.thirdPartySignature && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-800 mb-2">
                              {unit.thirdPartySignature.label}
                            </label>
                            <input
                              type="text"
                              value={
                                formData[`${unit.unitCode}_signature`] || ""
                              }
                              onChange={(e) => {
                                const fieldName = `${unit.unitCode}_signature`;
                                handleInputChange(fieldName, e.target.value);
                              }}
                              placeholder="Enter signature"
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                            />
                          </div>
                        )}

                        {/* Date */}
                        {unit.date && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-800 mb-2">
                              {unit.date.label}
                            </label>
                            <input
                              type="date"
                              value={formData[`${unit.unitCode}_date`] || ""}
                              onChange={(e) => {
                                const fieldName = `${unit.unitCode}_date`;
                                handleInputChange(fieldName, e.target.value);
                              }}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                            />
                          </div>
                        )}

                        {/* RTO Use Only */}
                        {unit.rtoUseOnly && (
                          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <h6 className="font-semibold text-yellow-900 mb-3">
                              RTO Use Only
                            </h6>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {unit.rtoUseOnly.assessorName && (
                                <div>
                                  <label className="block text-sm font-medium text-yellow-800 mb-2">
                                    {unit.rtoUseOnly.assessorName.label}
                                  </label>
                                  <input
                                    type="text"
                                    value={
                                      formData[
                                        `${unit.unitCode}_assessorName`
                                      ] || ""
                                    }
                                    onChange={(e) => {
                                      const fieldName = `${unit.unitCode}_assessorName`;
                                      handleInputChange(
                                        fieldName,
                                        e.target.value
                                      );
                                    }}
                                    placeholder="Assessor name"
                                    className="w-full px-3 py-2 rounded-lg border border-yellow-300 bg-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-100 focus:outline-none text-sm"
                                  />
                                </div>
                              )}

                              {unit.rtoUseOnly.verified && (
                                <div>
                                  <label className="block text-sm font-medium text-yellow-800 mb-2">
                                    {unit.rtoUseOnly.verified.label}
                                  </label>
                                  <div className="flex space-x-4">
                                    {unit.rtoUseOnly.verified.options?.map(
                                      (option) => (
                                        <div
                                          key={option}
                                          className="flex items-center space-x-2"
                                        >
                                          <div
                                            className="relative cursor-pointer"
                                            onClick={() => {
                                              const fieldName = `${unit.unitCode}_verified`;
                                              handleInputChange(
                                                fieldName,
                                                option
                                              );
                                            }}
                                          >
                                            <div
                                              className={`
                                            w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200
                                            ${
                                              formData[
                                                `${unit.unitCode}_verified`
                                              ] === option
                                                ? "bg-yellow-500 border-yellow-500"
                                                : "border-yellow-300 hover:border-yellow-400"
                                            }
                                          `}
                                            >
                                              {formData[
                                                `${unit.unitCode}_verified`
                                              ] === option && (
                                                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                              )}
                                            </div>
                                          </div>
                                          <label
                                            className="text-sm text-yellow-700 cursor-pointer"
                                            onClick={() => {
                                              const fieldName = `${unit.unitCode}_verified`;
                                              handleInputChange(
                                                fieldName,
                                                option
                                              );
                                            }}
                                          >
                                            {option}
                                          </label>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                              {unit.rtoUseOnly.verificationDate && (
                                <div>
                                  <label className="block text-sm font-medium text-yellow-800 mb-2">
                                    {unit.rtoUseOnly.verificationDate.label}
                                  </label>
                                  <input
                                    type="date"
                                    value={
                                      formData[
                                        `${unit.unitCode}_verificationDate`
                                      ] || ""
                                    }
                                    onChange={(e) => {
                                      const fieldName = `${unit.unitCode}_verificationDate`;
                                      handleInputChange(
                                        fieldName,
                                        e.target.value
                                      );
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-yellow-300 bg-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-100 focus:outline-none text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }

              // Regular array rendering for other arrays
              return (
                <div
                  key={key}
                  className="bg-white rounded-lg p-4 border border-blue-200 mb-4"
                >
                  <h5 className="font-semibold text-blue-900 mb-2 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </h5>
                  <ul className="space-y-1">
                    {value.map((item, index) => (
                      <li
                        key={index}
                        className="text-blue-700 text-sm flex items-start space-x-2"
                      >
                        <span className="text-blue-500 mt-1">•</span>
                        <span>
                          {typeof item === "string"
                            ? item
                            : JSON.stringify(item)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }

            // Render objects
            if (typeof value === "object" && value !== null) {
              return (
                <div
                  key={key}
                  className="bg-white rounded-lg p-4 border border-blue-200 mb-4"
                >
                  <h5 className="font-semibold text-blue-900 mb-2 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </h5>
                  <pre className="text-blue-700 text-sm whitespace-pre-wrap">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              );
            }

            // Render simple values
            if (typeof value === "string" || typeof value === "number") {
              return (
                <div
                  key={key}
                  className="bg-white rounded-lg p-4 border border-blue-200 mb-4"
                >
                  <h5 className="font-semibold text-blue-900 mb-2 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </h5>
                  <p className="text-blue-700 text-sm">{value}</p>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    );
  };

  // RPL specific renderers
  const renderRPLChecklistSection = (section) => {
    return (
      <div className="space-y-6">
        {section.content.subsections?.map((subsection) => (
          <div
            key={subsection.id}
            className="border border-gray-200 rounded-xl p-6"
          >
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              {subsection.title}
            </h4>

            {subsection.fieldType === "checkbox" && subsection.options && (
              <div className="space-y-3">
                {subsection.options.map((option, index) => {
                  const fieldName = subsection.id;
                  const selectedValues = Array.isArray(formData[fieldName])
                    ? formData[fieldName]
                    : [];

                  return (
                    <div key={index} className="flex items-start space-x-3">
                      <div
                        className="relative cursor-pointer mt-1"
                        onClick={() => {
                          const newValues = selectedValues.includes(option)
                            ? selectedValues.filter((v) => v !== option)
                            : [...selectedValues, option];
                          handleInputChange(fieldName, newValues);
                        }}
                      >
                        <div
                          className={`
                          w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
                          ${
                            selectedValues.includes(option)
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-300 hover:border-gray-400"
                          }
                        `}
                        >
                          {selectedValues.includes(option) && (
                            <FiCheckSquare className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </div>
                      <label
                        className="text-sm text-gray-700 cursor-pointer leading-relaxed flex-1"
                        onClick={() => {
                          const fieldName = subsection.id;
                          const selectedValues = Array.isArray(
                            formData[fieldName]
                          )
                            ? formData[fieldName]
                            : [];
                          const newValues = selectedValues.includes(option)
                            ? selectedValues.filter((v) => v !== option)
                            : [...selectedValues, option];
                          handleInputChange(fieldName, newValues);
                        }}
                      >
                        {option}
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderRPLQuestionsSection = (section) => {
    return (
      <div className="space-y-8">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-blue-900 mb-3">
            Instructions
          </h4>
          <p className="text-blue-800 mb-4">{section.content.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {section.content.instructions.options.map((option, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-3 border border-blue-200"
              >
                <span className="font-medium text-blue-900">{option}</span>
              </div>
            ))}
          </div>

          <div className="text-sm text-blue-700">
            {section.content.instructions.guidance.map((guidance, index) => (
              <p key={index} className="mb-2">
                • {guidance}
              </p>
            ))}
          </div>
        </div>

        {section.content.units?.map((unit) => (
          <div
            key={unit.unitCode}
            className="border border-gray-200 rounded-xl overflow-hidden"
          >
            <div
              className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 cursor-pointer hover:from-indigo-100 hover:to-purple-100 transition-all duration-200"
              onClick={() => toggleUnit(unit.unitCode)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                  <FiAward className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">
                    {unit.unitTitle}
                  </h4>
                  <p className="text-sm text-gray-600">{unit.unitCode}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                  {unit.totalQuestions} questions
                </span>
                <FiChevronRight
                  className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                    expandedUnits[unit.unitCode] ? "rotate-90" : ""
                  }`}
                />
              </div>
            </div>

            {expandedUnits[unit.unitCode] && (
              <div className="p-6 space-y-6">
                {unit.questions?.map((category, categoryIndex) => (
                  <div
                    key={categoryIndex}
                    className="bg-gray-50 rounded-xl p-4"
                  >
                    <h5 className="text-md font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                      <FiTarget className="w-4 h-4 text-indigo-500" />
                      <span>{category.category}</span>
                    </h5>

                    <div className="space-y-4">
                      {category.tasks?.map((task, taskIndex) => {
                        const fieldName = `${unit.unitCode}_${category.category}_${taskIndex}`;
                        const value = formData[fieldName] || "";

                        return (
                          <div
                            key={taskIndex}
                            className="bg-white rounded-lg p-4 border border-gray-200"
                          >
                            <p className="text-sm text-gray-700 mb-3">{task}</p>

                            <div className="flex space-x-6">
                              {["Regularly", "Sometimes", "Never"].map(
                                (option) => (
                                  <div
                                    key={option}
                                    className="flex items-center space-x-2"
                                  >
                                    <div
                                      className="relative cursor-pointer"
                                      onClick={() =>
                                        handleInputChange(fieldName, option)
                                      }
                                    >
                                      <input
                                        type="radio"
                                        name={fieldName}
                                        value={option}
                                        checked={value === option}
                                        onChange={(e) =>
                                          handleInputChange(
                                            fieldName,
                                            e.target.value
                                          )
                                        }
                                        className="sr-only"
                                      />
                                      <div
                                        className={`
                                      w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200
                                      ${
                                        value === option
                                          ? "bg-indigo-500 border-indigo-500"
                                          : "border-gray-300 hover:border-gray-400"
                                      }
                                    `}
                                      >
                                        {value === option && (
                                          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                        )}
                                      </div>
                                    </div>
                                    <label
                                      className="text-xs text-gray-600 cursor-pointer"
                                      onClick={() =>
                                        handleInputChange(fieldName, option)
                                      }
                                    >
                                      {option}
                                    </label>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderRPLEvidenceMatrix = (section) => {
    console.log("Rendering evidence matrix for section:", section.section);
    console.log("Section content:", section.content);
    console.log("Units:", section.content?.units);
    console.log("Evidence types:", section.content?.evidenceTypes);

    return (
      <div className="space-y-6">
        {/* Debug info */}
        {/* <div className="bg-red-100 border border-red-200 rounded-xl p-4 mb-4">
          <h4 className="text-red-900 font-bold">DEBUG - {section.section}</h4>
          <p className="text-red-800 text-sm">
            Units: {section.content?.units?.length || 0}
          </p>
          <p className="text-red-800 text-sm">
            Evidence Types: {section.content?.evidenceTypes?.length || 0}
          </p>
          <p className="text-red-800 text-xs">
            First unit: {JSON.stringify(section.content?.units?.[0])}
          </p>
        </div> */}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-amber-900 mb-2">
            Evidence Matrix - {section.section}
          </h4>
          <p className="text-amber-800">{section.content?.description}</p>
        </div>

        {/* Only render table if we have both units and evidence types */}
        {section.content?.units && section.content?.evidenceTypes ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-xl border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Evidence Type
                  </th>
                  {section.content.units.map((unit, index) => (
                    <th
                      key={index}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {typeof unit === "string"
                        ? unit.split(" - ")[0]
                        : unit.unitCode || unit}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {section.content.evidenceTypes.map(
                  (evidenceType, evidenceIndex) => (
                    <tr key={evidenceIndex} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded text-xs flex items-center justify-center font-medium">
                            {evidenceType.id}
                          </span>
                          <span>{evidenceType.type}</span>
                        </div>
                      </td>
                      {section.content.units.map((unit, unitIndex) => {
                        const unitCode =
                          typeof unit === "string"
                            ? unit.split(" - ")[0]
                            : unit.unitCode || unit;
                        const fieldName = `${section.section}_${unitCode}_${evidenceType.id}`;
                        const isChecked = formData[fieldName] || false;

                        return (
                          <td key={unitIndex} className="px-4 py-3 text-center">
                            <div
                              className="relative cursor-pointer inline-flex"
                              onClick={() => {
                                console.log(
                                  "Clicking evidence matrix checkbox:",
                                  fieldName,
                                  "current value:",
                                  isChecked,
                                  "new value:",
                                  !isChecked
                                );
                                handleInputChange(fieldName, !isChecked);
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  console.log(
                                    "Checkbox change event:",
                                    fieldName,
                                    e.target.checked
                                  );
                                  handleInputChange(
                                    fieldName,
                                    e.target.checked
                                  );
                                }}
                                className="sr-only"
                              />
                              <div
                                className={`
     w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
     ${
       isChecked
         ? "bg-blue-500 border-blue-500"
         : "border-gray-300 hover:border-gray-400"
     }
   `}
                              >
                                {isChecked && (
                                  <FiCheckSquare className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-yellow-100 border border-yellow-200 rounded-xl p-4">
            <p className="text-yellow-800">
              Missing data: Units ({section.content?.units ? "✓" : "✗"}) or
              Evidence Types ({section.content?.evidenceTypes ? "✓" : "✗"})
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderRPLUnitDetailsSection = (section) => {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-amber-900 mb-2">
            Unit Competency Details
          </h4>
          <p className="text-amber-800">{section.content?.description}</p>
        </div>

        {/* Render each unit's details */}
        {section.content?.units?.map((unit, unitIndex) => (
          <div
            key={unitIndex}
            className="border border-gray-200 rounded-xl overflow-hidden"
          >
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <FiAward className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">
                    {unit.unitTitle}
                  </h4>
                  <p className="text-sm text-gray-600">{unit.unitCode}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Evidence Description */}
              {unit.evidence?.description && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-900 mb-2">
                    Evidence Requirements
                  </h5>
                  <p className="text-blue-800 text-sm">
                    {unit.evidence.description}
                  </p>
                </div>
              )}

              {/* Requirements */}
              {unit.evidence?.requirements && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-semibold text-gray-900 mb-3">
                    Requirements
                  </h5>
                  <ul className="space-y-2">
                    {unit.evidence.requirements.map((req, reqIndex) => (
                      <li
                        key={reqIndex}
                        className="text-gray-700 text-sm flex items-start space-x-2"
                      >
                        <span className="text-blue-500 mt-1">•</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tools Required */}
              {unit.evidence?.toolsRequired && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unit.evidence.toolsRequired.handTools && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <h5 className="font-semibold text-green-900 mb-3">
                        Hand Tools
                      </h5>
                      <ul className="space-y-1">
                        {unit.evidence.toolsRequired.handTools.map(
                          (tool, toolIndex) => (
                            <li
                              key={toolIndex}
                              className="text-green-700 text-sm"
                            >
                              • {tool.charAt(0).toUpperCase() + tool.slice(1)}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                  {unit.evidence.toolsRequired.powerTools && (
                    <div className="bg-orange-50 rounded-lg p-4">
                      <h5 className="font-semibold text-orange-900 mb-3">
                        Power Tools
                      </h5>
                      <ul className="space-y-1">
                        {unit.evidence.toolsRequired.powerTools.map(
                          (tool, toolIndex) => (
                            <li
                              key={toolIndex}
                              className="text-orange-700 text-sm"
                            >
                              • {tool.charAt(0).toUpperCase() + tool.slice(1)}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Evidence Collection Checkboxes */}
              {unit.evidenceColumns && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h5 className="font-semibold text-yellow-900 mb-3">
                    Evidence Collection
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(unit.evidenceColumns).map(
                      ([key, label]) => {
                        const fieldName = `${unit.unitCode}_${key}`;
                        const isChecked = formData[fieldName] || false;

                        return (
                          <div
                            key={key}
                            className="flex items-center space-x-3"
                          >
                            <div
                              className="relative cursor-pointer"
                              onClick={() =>
                                handleInputChange(fieldName, !isChecked)
                              }
                            >
                              <div
                                className={`
                            w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
                            ${
                              isChecked
                                ? "bg-yellow-500 border-yellow-500"
                                : "border-gray-300 hover:border-gray-400"
                            }
                          `}
                              >
                                {isChecked && (
                                  <FiCheckSquare className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>
                            <label
                              className="text-sm text-yellow-800 cursor-pointer"
                              onClick={() =>
                                handleInputChange(fieldName, !isChecked)
                              }
                            >
                              {label}
                            </label>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderRPLContentSection = (section) => {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-green-900 mb-2">
            {section.sectionTitle}
          </h4>
          {section.content?.description && (
            <p className="text-green-800">{section.content?.description}</p>
          )}

          {section.content?.steps && (
            <div className="mt-4 space-y-3">
              {section.content?.steps.map((step, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg p-4 border border-green-200"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {step.stepNumber || index + 1}
                    </div>
                    <div>
                      <h5 className="font-semibold text-green-900">
                        {step.title}
                      </h5>
                      <p className="text-green-700 text-sm mt-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {section.content?.rules && (
            <div className="mt-4 space-y-3">
              {section.content.rules.map((rule, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg p-4 border border-green-200"
                >
                  <h5 className="font-semibold text-green-900 mb-2">
                    {rule.type}
                  </h5>
                  <ul className="space-y-1">
                    {rule.criteria.map((criterion, criterionIndex) => (
                      <li
                        key={criterionIndex}
                        className="text-green-700 text-sm flex items-start space-x-2"
                      >
                        <span className="text-green-500 mt-1">•</span>
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {section.content?.stages && (
            <div className="mt-4 space-y-3">
              {section.content.stages.map((stage, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg p-4 border border-green-200"
                >
                  <h5 className="font-semibold text-green-900">
                    {stage.stage}: {stage.title}
                  </h5>
                  <p className="text-green-700 text-sm mt-1">
                    {stage.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRPLFormStructure = () => {
    if (!isRPLForm(formTemplate)) return null;

    const allExpanded = areAllStagesExpanded();

    return (
      <div className="space-y-8">
        {/* Collapse/Expand All Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={allExpanded ? collapseAllStages : expandAllStages}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 shadow-sm"
          >
            <FiChevronRight
              className={`w-4 h-4 transition-transform duration-200 ${
                allExpanded ? "rotate-90" : ""
              }`}
            />
            <span>{allExpanded ? "Collapse All" : "Expand All"}</span>
          </button>
        </div>

        {/* Progress indicator */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 fixed w-full left-0 z-10 bottom-0 hidden md:block">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Form Progress
            </h3>
            <span className="text-sm text-gray-500">
              {
                Object.keys(expandedStages).filter((key) => expandedStages[key])
                  .length
              }{" "}
              of {formTemplate.formStructure.length} Sections
            </span>
          </div>
          <div className="flex space-x-2">
            {formTemplate.formStructure.map((section, index) => (
              <div
                key={section.section || index}
                className={`flex-1 h-1 rounded-full transition-all duration-200 ${
                  expandedStages[section.section || index]
                    ? "bg-blue-500"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* RPL Form Sections */}
        {formTemplate.formStructure.map((section, sectionIndex) => {
          const sectionKey = section.section || sectionIndex;
          const isExpanded = expandedStages[sectionKey];

          return (
            <div
              key={sectionKey}
              className="border border-gray-200 rounded-xl overflow-hidden"
            >
              {/* Section Header */}
              <div
                className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-indigo-50 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-all duration-200"
                onClick={() => toggleStage(sectionKey)}
              >
                <div className="flex items-start md:items-center space-x-4 flex-col md:flex-row">
                  <div className="w-7 h-7 md:w-12 md:h-12 bg-blue-500 rounded-xl mb-2 flex items-center justify-center">
                    <span className="text-white text-lg font-bold">
                      {sectionIndex + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-md md:text-xl font-semibold text-gray-800">
                      {section.sectionTitle}
                    </h3>
                    {section.content?.description && (
                      <p className="text-gray-600 text-sm mt-1">
                        {section.content.description.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                </div>
                <FiChevronRight
                  className={`w-6 h-6 hidden md:block text-gray-500 transition-transform duration-200 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </div>

              {isExpanded && (
                <div className="p-6 bg-white">
                  {section.section === "stage1Checklist" ? (
                    renderRPLChecklistSection(section)
                  ) : section.section === "stage1SelfAssessmentChecklist" ? (
                    renderStage1Checklist(section)
                  ) : section.section === "stage2SelfAssessmentQuestions" ||
                    section.section === "unit1Assessment" ||
                    section.section === "unit2Assessment" ||
                    section.section === "unit3Assessment" ||
                    section.section === "unit4Assessment" ||
                    section.section === "unit5Assessment" ||
                    section.section === "unit6Assessment" ||
                    section.section === "unit7Assessment" ||
                    section.section === "unit8Assessment" ||
                    section.section === "unit9Assessment" ||
                    section.section === "unit10Assessment" ||
                    section.section === "unit11Assessment" ||
                    section.section === "unit12Assessment" ||
                    section.section === "unit13Assessment" ||
                    section.section === "unit14Assessment" ||
                    section.section === "unit15Assessment" ||
                    section.section === "unit16Assessment"
                    ? (
                    renderStage2Questions(section)
                  ) : section.section === "tableAEvidenceMapping" ? (
                    renderGenericContent(section)
                  ) : section.section === "tableBEvidenceTypes" ? (
                    renderEvidenceMatrix(section)
                  ) : section.section === "stage2Questions" ? (
                    renderRPLQuestionsSection(section)
                  ) : section.section === "tableA" ? (
                    renderRPLUnitDetailsSection(section)
                  ) : section.section === "tableB" ? (
                    renderRPLEvidenceMatrix(section)
                  ) : section.section === "stage3LLN" ? (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                      <h4 className="text-lg font-semibold text-purple-900 mb-2">
                        LLN Assessment
                      </h4>
                      <p className="text-purple-800">
                        {section.content?.description}
                      </p>
                      <div className="mt-4 p-4 bg-purple-100 rounded-lg">
                        <p className="text-purple-900 text-sm">
                          <strong>Note:</strong> This section will be completed
                          as part of a separate LLN assessment process.
                        </p>
                      </div>
                    </div>
                  ) : (
                    renderRPLContentSection(section)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFormStructure = () => {
    if (!formTemplate?.formStructure) return null;

    console.log("Rendering form structure:", {
      formTemplate: formTemplate,
      formStructure: formTemplate.formStructure,
      isRPL: isRPLForm(formTemplate),
      hasNested: hasNestedSections(formTemplate.formStructure),
      expandedSections: expandedSections
    });

    // Check if this is an RPL form
    if (isRPLForm(formTemplate)) {
      console.log("Rendering as RPL form");
      return renderRPLFormStructure();
    }

    // Add this right after the hasNestedSections check
    if (hasNestedSections(formTemplate.formStructure)) {
      console.log("Rendering nested sections, expanded state:", expandedSections);
      const allExpanded = areAllSectionsExpanded();
      
      return (
        <div>
          {/* Collapse/Expand All Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={allExpanded ? collapseAllSections : expandAllSections}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 shadow-sm"
            >
              <FiChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${
                  allExpanded ? "rotate-90" : ""
                }`}
              />
              <span>{allExpanded ? "Collapse All" : "Expand All"}</span>
            </button>
          </div>

          {formTemplate.formStructure.map((section, sectionIndex) => {
        const sectionKey = section.section || sectionIndex;
        const isExpanded = expandedSections[sectionKey];
        console.log(`Section ${sectionKey}:`, { section, isExpanded, fields: section.fields, expandedSections });

        return (
          <div key={sectionKey} className="mb-8">
            <div
              className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl cursor-pointer hover:from-gray-100 hover:to-gray-200 transition-all duration-200 mb-4"
              onClick={() => toggleSection(sectionKey)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {sectionIndex + 1}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {section.sectionTitle}
                </h3>
              </div>
              <FiChevronRight
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
            </div>

            {isExpanded && (
              <div className="space-y-6 pl-6">
                {/* Render content if no fields */}
                {!section.fields &&
                  section.content &&
                  renderGenericContent(section.content, section.section)}

                {/* Render fields if they exist */}
                {section.fields?.map((field, fieldIndex) => (
                  <div key={field.fieldName}>
                    {field.fieldType !== "label" && field.fieldType !== "info" && (
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                          {field.label}
                          {field.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                          {isUSIField(field) && (
                            <USITooltip />
                          )}
                        </label>

                        {field.description && (
                          <p className="text-xs text-gray-500 mb-3">
                            {field.description}
                          </p>
                        )}
                      </div>
                    )}

                    {renderField(field)}

                    {errors[field.fieldName] && (
                      <div className="mt-2 flex items-center space-x-2 text-red-600 text-sm">
                        <FiAlertCircle className="w-4 h-4" />
                        <span>{errors[field.fieldName]}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
        </div>
      );
    } else {
      console.log("Rendering flat structure");
      return (
        <div className="space-y-6">
          {formTemplate.formStructure.map((field, index) => (
            <div key={field.fieldName}>
              {field.fieldType !== "label" && field.fieldType !== "info" && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                    {isUSIField(field) && (
                      <USITooltip />
                    )}
                  </label>

                  {field.description && (
                    <p className="text-xs text-gray-500 mb-3">
                      {field.description}
                    </p>
                  )}
                </div>
              )}

              {renderField(field)}

              {errors[field.fieldName] && (
                <div className="mt-2 flex items-center space-x-2 text-red-600 text-sm">
                  <FiAlertCircle className="w-4 h-4" />
                  <span>{errors[field.fieldName]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      style={{
        background: `
         radial-gradient(ellipse at top left, rgba(128, 166, 255, 0.15) 0%, rgba(128, 166, 255, 0.1) 30%, rgba(241, 241, 242, 0) 60%),
         radial-gradient(ellipse at bottom right, rgba(255, 160, 118, 0.15) 0%, rgba(255, 160, 118, 0.3) 30%, rgba(241, 241, 242, 0) 60%),
         #F1F1F2
       `,
      }}
    >
      <Toaster position="top-right" />
      {/* Header */}
      <div className="pt-6 px-6 max-w-6xl mx-auto">
        <div className="backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 mb-8">
          <div className="py-6 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 rounded-xl transition-all duration-200"
                >
                  <FiArrowLeft className="w-5 h-5" />
                </button>
                <img src={logo} alt="Certified Logo" className="h-12 w-auto" />
                <div>
                  <h1 className="text-xl bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {formTemplate?.name}
                  </h1>
                  <p className="text-sm font-light text-gray-600">
                    {application?.certificationId?.name}
                  </p>
                  {isRPLForm(formTemplate) && (
                    <p className="text-xs text-blue-600 font-medium">
                      {formTemplate?.courseCode} - RPL Assessment
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {existingSubmission && (
                  <div className="flex items-center space-x-2">
                    {existingSubmission.status === "submitted" && (
                      <div className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        <FiCheckCircle className="w-3 h-3" />
                        <span>Submitted</span>
                      </div>
                    )}
                    {existingSubmission.status === "draft" && (
                      <div className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                        <FiClock className="w-3 h-3" />
                        <span>Draft</span>
                      </div>
                    )}
                  </div>
                )}

                {isResubmission && (
                  <div className="flex items-center space-x-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                    <FiRefreshCw className="w-3 h-3" />
                    <span>Resubmission</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-6 max-w-6xl mx-auto pb-8">
        <div className="bg-white rounded-2xl shadow-lg border border-white/50 overflow-hidden">
          {/* Form Header */}
          <div className="p-8 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 text-white">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                {isRPLForm(formTemplate) ? (
                  <FiBook className="w-6 h-6 text-white" />
                ) : (
                  <FiFileText className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-2">
                  {formTemplate?.name}
                </h2>
                <p className="text-blue-100 leading-relaxed">
                  {formTemplate?.description}
                </p>

                {isResubmission && existingSubmission?.assessorFeedback && (
                  <div className="mt-4 p-4 bg-orange-500/20 backdrop-blur-sm rounded-xl border border-orange-300/30">
                    <div className="flex items-start space-x-3">
                      <FiAlertCircle className="w-5 h-5 text-orange-200 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-orange-100 mb-1">
                          Assessor Feedback
                        </h4>
                        <p className="text-orange-100 text-sm leading-relaxed">
                          {existingSubmission.assessorFeedback}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="p-8">{renderFormStructure()}</div>

          {/* Form Actions */}
          <div className="p-8 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center space-x-2 px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <FiArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </button>

              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  <FiSave className="w-4 h-4" />
                  <span>{saving ? "Saving..." : "Save Draft"}</span>
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 shadow-lg disabled:opacity-50"
                >
                  <FiSend className="w-4 h-4" />
                  <span>
                    {submitting
                      ? "Submitting..."
                      : isResubmission
                      ? "Resubmit Form"
                      : "Submit Form"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversalFormRenderer;

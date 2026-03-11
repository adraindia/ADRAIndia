export const CASE_FIELDS = [
  { k: "submitterName",  label: "Your Name & Designation",                        type: "text",     ph: "e.g. Ritu Sharma, Cluster Coordinator" },
  { k: "submitterEmail", label: "Your Email",                                      type: "text",     ph: "email@adraindia.org" },
  { k: "projectName",    label: "Project / Programme Name",                        type: "text",     ph: "e.g. BRIDGE-UP Immunization, UP" },
  { k: "beneficiary",    label: "Beneficiary Name (initials OK for privacy)",     type: "text",     ph: "e.g. Sunita D." },
  { k: "age",            label: "Age",                                             type: "text",     ph: "e.g. 28" },
  { k: "gender",         label: "Gender",                                          type: "select",   opts: ["Female", "Male", "Other", "Prefer not to say"] },
  { k: "location",       label: "Village / Block / District",                      type: "text",     ph: "e.g. Rampur village, Lucknow dist., UP" },
  { k: "background",     label: "Background — situation BEFORE ADRA's work",      type: "textarea", ph: "Be specific. Include distance to health centre, number of children, economic situation." },
  { k: "challenge",      label: "Specific challenge or barrier this person faced", type: "textarea", ph: "e.g. Fear of vaccination, no transport, family resistance..." },
  { k: "intervention",   label: "What did ADRA / the project team specifically do?", type: "textarea", ph: "Who did what? Name the ASHA/AWW/coordinator if appropriate." },
  { k: "outcome",        label: "What changed? What is the outcome?",              type: "textarea", ph: "Concrete change — include numbers if possible." },
  { k: "quote",          label: "Direct quote from beneficiary (their exact words)", type: "textarea", ph: "Write exactly what they said, translated if needed. Don't paraphrase here." },
  { k: "photoCredit",    label: "Photo credit (if photo attached)",                type: "text",     ph: "Photo: © 2025 ADRA India | Your Name" },
  { k: "extraNotes",     label: "Anything else for the communications team?",      type: "textarea", ph: "Context, follow-up needed, sensitivity flags, etc." },
];

export const NEWSLETTER_FIELDS = [
  { k: "submitterName",   label: "Your Name & Designation",              type: "text",     ph: "e.g. State Programme Manager" },
  { k: "submitterEmail",  label: "Your Email",                           type: "text",     ph: "" },
  { k: "projectName",     label: "Project / Programme Name",             type: "text",     ph: "" },
  { k: "reportingPeriod", label: "Reporting Period",                     type: "text",     ph: "e.g. January–March 2025" },
  { k: "geography",       label: "State / District / Coverage Area",     type: "text",     ph: "" },
  { k: "achievement1",    label: "Key Achievement #1 (with numbers)",   type: "textarea", ph: "e.g. 1,240 children vaccinated across 18 villages..." },
  { k: "achievement2",    label: "Key Achievement #2",                  type: "textarea", ph: "" },
  { k: "achievement3",    label: "Key Achievement #3 (optional)",       type: "textarea", ph: "" },
  { k: "humanStory",      label: "One human story or moment from the field", type: "textarea", ph: "A sentence or two about something that stood out." },
  { k: "challenges",      label: "Key challenges faced",                 type: "textarea", ph: "What was hard? What slowed things down?" },
  { k: "upcoming",        label: "What's coming up next quarter?",       type: "textarea", ph: "Planned activities, milestones, events." },
];

export const REPORT_FIELDS = [
  { k: "submitterName",      label: "Your Name & Designation",              type: "text",     ph: "" },
  { k: "submitterEmail",     label: "Your Email",                           type: "text",     ph: "" },
  { k: "projectName",        label: "Project Name",                         type: "text",     ph: "" },
  { k: "donorName",          label: "Donor / Funder",                       type: "text",     ph: "e.g. ECHO, USAID, Tata Trusts" },
  { k: "reportingPeriod",    label: "Reporting Period",                     type: "text",     ph: "" },
  { k: "geography",          label: "Geography (State / District)",         type: "text",     ph: "" },
  { k: "totalBeneficiaries", label: "Total Beneficiaries Reached",         type: "text",     ph: "e.g. 4,200 (2,800 female, 1,400 male)" },
  { k: "keyIndicators",      label: "Key Indicators & Results (target vs actual)", type: "textarea", ph: "- Children vaccinated: Target 1,000 / Actual 1,187\n- Sessions held: Target 50 / Actual 63" },
  { k: "highlight",          label: "Standout result or highlight",         type: "textarea", ph: "The most impressive thing that happened this period." },
  { k: "challenges",         label: "Challenges & How They Were Addressed", type: "textarea", ph: "" },
  { k: "lessons",            label: "Lessons Learned / Adaptations Made",  type: "textarea", ph: "" },
  { k: "nextSteps",          label: "Next Steps / Planned Activities",      type: "textarea", ph: "" },
];

export const TYPE_LABELS = {
  case_story: "Case Story",
  newsletter:  "Newsletter Update",
  report:      "Impact Report",
};

export const TYPE_ICONS = {
  case_story: "📖",
  newsletter:  "📰",
  report:      "📊",
};

export const TYPE_DESCS = {
  case_story: "Beneficiary story from field",
  newsletter:  "Programme update for newsletter",
  report:      "Donor-facing impact snapshot",
};

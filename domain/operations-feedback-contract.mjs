// Opt-in UAT metadata only. No operational records, attachments or free-text diagnostics.
export const feedbackContract=Object.freeze({
 workflows:['sign_in','onboarding','loads','dispatch','driver_execution','documents','finance','administration','accessibility'],
 symptoms:['cannot_complete','unexpected_result','unavailable_control','layout','access_denied','recovery'],
 severities:['blocking','major','minor'],
 reproducibility:['always','intermittent','once'],
 transitions:{reported:['triaged'],triaged:['in_progress'],in_progress:['awaiting_retest'],awaiting_retest:[],closed:[]},
 reasons:['investigating','fix_available','needs_details','cannot_reproduce'],
});
export const feedbackKinds=Object.freeze(['uatfeedback','uatfeedbackevent']);

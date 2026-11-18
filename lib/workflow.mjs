export const actionStates = {
  open: 'Open', in_progress: 'In progress', blocked: 'Blocked',
  completed: 'Completed', cancelled: 'Cancelled', failed: 'Failed',
};

export const actionTransitions = {
  open: ['in_progress', 'blocked', 'completed', 'cancelled'],
  in_progress: ['blocked', 'completed', 'failed', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  completed: ['open'],
  cancelled: ['open'],
  failed: ['open'],
};

export const requirementTransitions = {
  draft: ['brief_confirmed', 'cancelled'],
  brief_confirmed: ['sourcing', 'paused', 'cancelled'],
  sourcing: ['interviewing', 'filled', 'paused', 'cancelled', 'unsuccessful'],
  interviewing: ['sourcing', 'filled', 'paused', 'cancelled', 'unsuccessful'],
  paused: ['sourcing', 'cancelled', 'unsuccessful'],
  filled: [], cancelled: ['draft'], unsuccessful: ['draft'],
};

const common = ['unknown', 'not_confirmed', 'not_provided', 'other'];
const application = ['candidate_withdrew', 'candidate_unavailable', 'employer_declined',
  'compensation_mismatch', 'role_changed', 'role_mismatch', 'assessment_criteria_unmet',
  'position_cancelled', 'accepted_other_offer', 'interview_not_held', 'communication_breakdown'];
export const outcomeReasons = Object.fromEntries(Object.entries({
  action: ['work_carried_out', 'contact_made', 'no_response', 'incorrect_contact',
    'follow_up_requested', 'no_longer_needed', 'completed_by_colleague', 'dependency_pending'],
  application,
  introduction: [...application, 'profile_shared', 'candidate_declined'],
  requirement: ['filled', 'hiring_paused', 'role_cancelled', 'budget_withdrawn',
    'priorities_changed', 'role_changed', 'filled_elsewhere', 'partner_unresponsive', 'terms_not_agreed', 'no_longer_valid'],
  interview: ['held', 'rescheduled', 'candidate_unavailable', 'employer_unavailable',
    'candidate_withdrew', 'assessment_criteria_unmet', 'offer_extended', 'no_decision'],
  placement: ['joined', 'did_not_join', 'placement_ended', 'resigned', 'employment_ended',
    'terms_changed', 'compensation_mismatch', 'working_conditions_changed', 'role_withdrawn', 'mutual_separation'],
  commercial: ['payment_received', 'partial_payment', 'invoice_disputed', 'invoice_incorrect',
    'documentation_missing', 'agreement_disputed', 'invoice_adjusted', 'obligation_voided'],
  collection: ['reminder_sent', 'payment_reported', 'partial_payment_reported', 'approval_pending',
    'date_postponed', 'contact_unavailable', 'allocation_pending', 'invoice_disputed'],
}).map(([type, reasons]) => [type, [...reasons, ...common]]));

export const terminalActionStates = ['completed', 'failed', 'cancelled'];

export function workflowDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateActionTransition(from, to, fields = {}) {
  if (!actionTransitions[from]?.includes(to)) return 'Choose an available status transition.';
  if (to === 'blocked' && (!fields.blocker?.trim() || !fields.blockerOwner?.trim()
      || !workflowDate(fields.reviewDate))) return 'Enter a blocker, responsible party and valid review date.';
  if (terminalActionStates.includes(to)) {
    if (!outcomeReasons.action.includes(fields.reason)) return 'Choose an action outcome reason.';
    if (!fields.outcome?.trim()) return 'Describe what happened when this action closed.';
  }
  return '';
}

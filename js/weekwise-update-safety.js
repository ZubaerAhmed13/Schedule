/* Safety gates for applying a waiting offline-app update.
   Only release source code is replaced; the planner never clears localStorage. */
(function(root){'use strict';
 function reason(doc,reviewDirty=false){
  if(!doc||typeof doc.querySelector!=='function')throw new Error('Document is required for update checks.');
  const active=doc.querySelector('#taskModal.show,#utilityModal.show,#templateModal:not([hidden]),#captureConfirmDialog[open],#taskQuickEdit:not([hidden]),#taskBulkDialog[open],#todayHighlightDialog[open],#signinLanding:not([hidden])');
  if(active)return 'Close or save your open editor or dialog before updating Weekwise.';
  if(reviewDirty)return 'Save your unfinished weekly review before updating Weekwise.';
  const quick=doc.querySelector('#workspaceCaptureInput');
  if(quick&&typeof quick.value==='string'&&quick.value.trim())return 'Add or clear your unfinished quick-capture text before updating Weekwise.';
  return '';
 }
 root.WeekwiseUpdateSafety=Object.freeze({reason});
})(typeof window!=='undefined'?window:globalThis);

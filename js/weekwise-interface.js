/* Presentation only: the canonical editor and navigation own all planner writes. */
(function(root){
  'use strict';
  const $=id=>document.getElementById(id);
  function reveal(control){
    for(let parent=control?.parentElement;parent;parent=parent.parentElement){
      if(parent.tagName==='DETAILS')parent.open=true;
    }
  }
  function prepareEditor(){
    const groups={
      taskPriorityOptions:['modalTodayPriority','modalPriority','modalStatus','modalSchedulingMode','modalFocusEstimate','modalDurationEstimate','modalImportance','modalUrgency'],
      taskRepeatOptions:['modalRecurrence','modalReminderAt','modalReminderAt2','modalReminderAt3','modalReminderAt4','modalReminderAt5','modalDueDate'],
      taskOrganizeOptions:['modalSection','modalTags'],
      taskNotesOptions:['modalSubtasks','modalAttachments']
    };
    const defaults={modalPriority:'none',modalStatus:'todo',modalSchedulingMode:'flexible',modalRecurrence:'none',modalImportance:'unclassified',modalUrgency:'unclassified'};
    for(const [id,fields] of Object.entries(groups)){
      $(id).open=fields.some(name=>{const el=$(name);return el.type==='checkbox'?el.checked:!!el.value&&el.value!==(defaults[name]||'');});
    }
    if(!$('modalRequiresCompletion').checked)$('taskPriorityOptions').open=true;
    if($('editTaskId').value&&$('modalFolder').value)$('taskOrganizeOptions').open=true;
    document.querySelector('.task-template-tools').open=false;
  }
  function navigation(view){
    document.body.dataset.activeView=view;
    document.querySelectorAll('#workspaceSidebar [data-workspace-view]').forEach(button=>{
      if(button.dataset.workspaceView===view)reveal(button);
    });
  }
  // Browsers cannot focus invalid fields inside closed details without revealing them.
  document.addEventListener('invalid',event=>reveal(event.target),true);
  root.WeekwiseInterface=Object.freeze({prepareEditor,navigation});
})(window);

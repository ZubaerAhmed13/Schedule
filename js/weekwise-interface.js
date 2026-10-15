/* Presentation only: the canonical editor and navigation own all planner writes. */
(function(root){
  'use strict';
  let app=null,lastOwner=null,lastView=null;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const groups=['workspaceTools','workspaceLists','workspaceFolders','workspaceTags'];
  const paths={star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',pin:'<path d="m9 3 6 0-1 6 4 4H6l4-4-1-6ZM12 13v8"/>',sliders:'<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',edit:'<path d="m4 15 11-11 5 5-11 11-6 1 1-6ZM13 6l5 5"/>',remove:'<path d="M5 6h14M9 6V3h6v3M7 6l1 15h8l1-15M10 10v7m4-7v7"/>',focus:'<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6m-3 0v3"/>'};
  function icon(name){return '<svg class="ww-icon" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.sliders)+'</svg>';}
  const navKey=owner=>'weekwise-nav-groups-v1:'+encodeURIComponent(owner);
  function readGroups(owner){try{const value=JSON.parse(localStorage.getItem(navKey(owner))||'{}');if(!value||typeof value!=='object'||Array.isArray(value))return {};return Object.fromEntries(groups.filter(id=>typeof value[id]==='boolean').map(id=>[id,value[id]]));}catch(_){return {};}}
  function checkpointGroups(){if(!app)return;try{localStorage.setItem(navKey(app.account()),JSON.stringify(Object.fromEntries(groups.map(id=>[id,$(id).open]))));}catch(_){}}
  function pins(){const value=app?.snapshot().store.settings.pinnedLists;return Array.isArray(value)?value.filter(id=>typeof id==='string').slice(0,50):[];}
  function renderPins(){
    if(!app)return;const list=app.lists(),saved=pins(),items=list.filter(item=>saved.includes(item.id));
    $('workspacePinnedLists').hidden=!items.length;
    $('workspacePinnedListsNav').innerHTML=items.map(item=>'<button class="workspace-nav-btn '+(app.view()==='list-'+item.id?'active':'')+'" type="button" data-workspace-view="list-'+esc(item.id)+'" aria-current="'+(app.view()==='list-'+item.id?'page':'false')+'"><span class="workspace-nav-icon">'+icon('pin')+'</span><span>'+esc(item.label)+'</span></button>').join('');
    document.querySelectorAll('[data-pin-list]').forEach(button=>{const label=list.find(item=>item.id===button.dataset.pinList)?.label||'list',on=saved.includes(button.dataset.pinList);button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',(on?'Unpin ':'Pin ')+label);button.title=(on?'Unpin ':'Pin ')+label;button.innerHTML=icon('pin');});
  }
  function init(bridge){
    app=bridge;navigation(app.view());renderPins();
    window.addEventListener('beforeunload',checkpointGroups);
    window.addEventListener('pagehide',checkpointGroups);
    document.addEventListener('click',event=>{
      const summary=event.target.closest('#workspaceSidebar .nav-group > summary');
      if(summary){const owner=app.account(),group=summary.parentElement;setTimeout(()=>{if(app.account()!==owner)return;try{const saved=readGroups(owner);saved[group.id]=group.open;localStorage.setItem(navKey(owner),JSON.stringify(saved));}catch(_){app.announce('Navigation opened, but its preference could not be saved.');}},0);}
      const button=event.target.closest('[data-pin-list]');if(!button)return;
      try{
        if(root.WeekwiseProductivity?.hasPending())throw new Error('Save your quick edit before changing pinned lists.');
        const snapshot=app.snapshot(),next=JSON.parse(JSON.stringify(snapshot.store)),id=button.dataset.pinList,saved=pins();
        if(snapshot.store.settings.pinnedLists!==undefined&&(!Array.isArray(snapshot.store.settings.pinnedLists)||snapshot.store.settings.pinnedLists.some(value=>typeof value!=='string')))throw new Error('Saved pinned-list preferences need review.');
        if(!saved.includes(id)&&saved.length>=50)throw new Error('Pin up to 50 lists.');
        if(!app.lists().some(item=>item.id===id))throw new Error('This list is no longer available.');
        next.settings.pinnedLists=saved.includes(id)?saved.filter(value=>value!==id):[...saved,id];
        app.commit(JSON.stringify(snapshot),app.account(),next);renderPins();app.announce(saved.includes(id)?'List unpinned.':'List pinned.');
      }catch(error){app.announce(error.message);}
    });
  }
  function reveal(control){
    for(let parent=control?.parentElement;parent;parent=parent.parentElement){
      if(parent.tagName==='DETAILS')parent.open=true;
    }
  }
  function prepareEditor(){
    const groups={
      taskAppearanceOptions:['modalTaskColor'],taskPriorityOptions:['modalTodayPriority','modalPriority','modalStatus','modalSchedulingMode','modalFocusEstimate','modalDurationEstimate','modalImportance','modalUrgency'],
      taskRepeatOptions:['modalRecurrence','modalReminderAt','modalReminderAt2','modalReminderAt3','modalReminderAt4','modalReminderAt5','modalDueDate'],
      taskOrganizeOptions:['modalSection','modalTags'],
      taskNotesOptions:['modalSubtasks','modalAttachments']
    };
    const defaults={modalPriority:'none',modalStatus:'todo',modalSchedulingMode:'flexible',modalRecurrence:'none',modalTaskColor:'auto',modalImportance:'unclassified',modalUrgency:'unclassified'};
    for(const [id,fields] of Object.entries(groups)){
      $(id).open=fields.some(name=>{const el=$(name);return el.type==='checkbox'?el.checked:!!el.value&&el.value!==(defaults[name]||'');});
    }
    if(!$('modalRequiresCompletion').checked)$('taskPriorityOptions').open=true;
    if($('editTaskId').value&&$('modalFolder').value)$('taskOrganizeOptions').open=true;
    document.querySelector('.task-template-tools').open=false;
  }
  function navigation(view){
    document.body.dataset.activeView=view;
    const owner=app?.account();
    if(app&&owner!==lastOwner){const saved=readGroups(owner);for(const id of groups)$(id).open=saved[id]??id==='workspaceLists';lastOwner=owner;lastView=null;}
    if(view!==lastView){
      document.querySelectorAll('#workspaceSidebar [data-workspace-view]').forEach(button=>{if(button.dataset.workspaceView===view)reveal(button);});
      if(view.startsWith('list-'))$('workspaceLists').open=true;
      if(view.startsWith('folder:'))$('workspaceFolders').open=true;
      if(view.startsWith('tag:'))$('workspaceTags').open=true;
      lastView=view;
    }
  }
  // Browsers cannot focus invalid fields inside closed details without revealing them.
  document.addEventListener('invalid',event=>reveal(event.target),true);
  root.WeekwiseInterface=Object.freeze({init,prepareEditor,navigation,renderPins,icon});
})(window);

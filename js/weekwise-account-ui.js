(function(root){
 'use strict';let app=null,owner=null,configured=false,busy=false,checking=0;
 const $=id=>document.getElementById(id),phrase='DELETE MY WEEKWISE ACCOUNT';
 function status(message){$('accountEraseStatus').textContent=message;}
 function controls(){$('accountEraseSubmit').disabled=busy||!configured;$('accountEraseClose').disabled=busy;}
 async function open(){
  if(busy)return;owner=app.owner();configured=false;$('accountEraseForm').reset();controls();$('accountEraseDialog').showModal();
  if(!owner||owner==='local'){status('Sign in to the password account you want to delete. Device-only planners have no cloud account to erase.');return;}
  const request=++checking;status('Checking whether account erasure is configured…');
  try{const response=await fetch(app.url,{headers:{apikey:app.key},cache:'no-store'}),value=await response.json();
   if(request!==checking)return;
   configured=response.ok&&value.configured===true&&value.operation==='delete-own-account'&&owner===app.owner();
   status(configured?'Erasure is available. Review the consequences and confirm below.':'Account erasure is not activated. Your account and local copies remain saved.');
  }catch(_){if(request===checking)status('Account erasure could not be checked. Your account and local copies remain saved.');}
  controls();
 }
 async function submit(event){
  event.preventDefault();if(busy||!configured)return;
  if(owner!==app.owner()){configured=false;controls();status('Your account changed. Close this dialog and review the current account.');return;}
  if($('accountErasePhrase').value!==phrase||!$('accountEraseBackup').checked){status('Type the exact confirmation phrase and acknowledge the backup requirement.');return;}
  if(!confirm('Permanently delete this Weekwise account and its cloud planner? This cannot be undone.'))return;
  const captured=owner,password=$('accountErasePassword').value;let deleted=false;busy=true;controls();status('Reauthenticating and requesting account erasure…');
  try{
   const session=await app.session(captured);
   const response=await fetch(app.url,{method:'POST',headers:{apikey:app.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({confirmation:phrase,password,backedUp:true}),cache:'no-store'});
   const value=await response.json();
   if(!response.ok||value.deleted!==true||value.owner!==captured||value.revokedRefreshSessions!==true)throw new Error(value.error||'The server did not confirm erasure for this account. Local copies remain saved.');
   deleted=true;
   // First move the shared active planner back to its independent local owner.
   // Snapshot scoped keys afterwards: isolation may write the last account cache.
   await app.detach(captured);
   const entries=root.WeekwiseAccountPrivacy.ownedEntries(localStorage,captured);
   root.WeekwiseAccountPrivacy.removeOwned(localStorage,entries);
   configured=false;status('The account and its cloud planner were deleted. Its named device cache, focus state and editor drafts were removed. Exported backups, shared recovery checkpoints and copies on other devices remain.');
   app.announce('Weekwise account deleted. Other planners and exported backups remain.');
  }catch(error){status((deleted?'The cloud account was deleted, but device cleanup needs attention. ':'')+(error.message||'Erasure was not confirmed. Local copies remain saved.'));if(deleted)configured=false;}
  finally{$('accountErasePassword').value='';busy=false;controls();}
 }
 function init(bridge){app=bridge;document.querySelectorAll('[data-account-erase]').forEach(button=>button.addEventListener('click',open));$('accountEraseForm').addEventListener('submit',submit);$('accountEraseClose').onclick=()=>{checking++;$('accountErasePassword').value='';$('accountEraseDialog').close();};$('accountEraseDialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();else{checking++;$('accountErasePassword').value='';}});}
 root.WeekwiseAccountUI=Object.freeze({init});
})(window);

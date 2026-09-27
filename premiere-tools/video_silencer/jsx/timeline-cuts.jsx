// Paste retained source ranges into the active sequence without creating sequences.
// A precise restore record powers Undo Last Cut; native undo may contain several steps.
(function () {
 function fail(message) {return JSON.stringify({success:false,error:message});}
 function norm(value){return String(value).replace(/\\/g,'/').toLowerCase();}
 function tracks(seq){var result=[];for(var v=0;v<seq.videoTracks.numTracks;v++)result.push(seq.videoTracks[v]);for(var a=0;a<seq.audioTracks.numTracks;a++)result.push(seq.audioTracks[a]);return result;}
 function snapshot(seq){var map={},all=tracks(seq);for(var t=0;t<all.length;t++)for(var c=0;c<all[t].clips.numItems;c++){var clip=all[t].clips[c];map[clip.nodeId]=clip;}return map;}
 function fingerprint(clip){return [clip.start.ticks,clip.end.ticks,clip.inPoint.ticks,clip.outPoint.ticks,clip.projectItem.nodeId].join('|');}
 function findItem(parent,media){if(parent&&parent.getMediaPath){try{if(norm(parent.getMediaPath())===norm(media))return parent;}catch(e){}}if(parent&&parent.children)for(var i=0;i<parent.children.numItems;i++){var found=findItem(parent.children[i],media);if(found)return found;}return null;}
 function clear(track,start,end){if(track.isLocked&&track.isLocked())return false;for(var i=0;i<track.clips.numItems;i++){var c=track.clips[i];if(c.start.seconds<end&&c.end.seconds>start)return false;}return true;}
 VideoSilencer.getCutTarget=function(){var seq=app.project&&app.project.activeSequence;if(!seq)return fail('Open the destination sequence first.');return JSON.stringify({success:true,sequenceID:seq.sequenceID,time:seq.getPlayerPosition().seconds,sequenceName:seq.name});};
 VideoSilencer.applyTimelineCuts=function(plan){
  var seq=app.project&&app.project.activeSequence;
  if(!seq||seq.sequenceID!==plan.sequenceID)return fail('The active sequence changed during analysis. Select the original sequence and analyze again.');
  if(!plan.segments||!plan.segments.length)return fail('No retained source ranges.');
  var item=findItem(app.project.rootItem,plan.mediaPath);if(!item)return fail('Import the source media into the current project first.');
  var duration=0;for(var i=0;i<plan.segments.length;i++){var s=plan.segments[i];if(!isFinite(s['in'])||!isFinite(s.out)||s['in']<0||s.out<=s['in'])return fail('Invalid source range');duration+=s.out-s['in'];}
  var at=Number(plan.time);if(!isFinite(at)||at<0)return fail('Invalid destination time');
  var requestedAt=at,all=tracks(seq),tail=at,occupied=false;
  // Audio mapping may span multiple tracks. Append in this SAME sequence if
  // the requested range is occupied; never overwrite the user's source clips.
  for(var t=0;t<all.length;t++)for(var c=0;c<all[t].clips.numItems;c++){
   var existing=all[t].clips[c];tail=Math.max(tail,existing.end.seconds);
   if(existing.start.seconds<at+duration&&existing.end.seconds>at)occupied=true;
  }
  if(occupied)at=tail+0.1; // Small gap also protects against frame rounding.
  var placementTime=at,vi=-1,ai=-1;
  for(var v=0;v<seq.videoTracks.numTracks;v++)if(clear(seq.videoTracks[v],at,at+duration)){vi=v;break;}
  // Protect every audio track because multichannel sources may occupy more than one.
  for(var a=0;a<seq.audioTracks.numTracks;a++)if(!clear(seq.audioTracks[a],at,at+duration))return fail('Unlock the audio tracks before pasting cuts. No clips were changed.');
  if(seq.audioTracks.numTracks)ai=0;
  if(vi<0||ai<0)return fail('Add an unlocked empty video and audio track, or choose a clear destination range.');
  var before=snapshot(seq),created=[],originalIn=item.getInPoint(4),originalOut=item.getOutPoint(4),error=null;
  try{
   for(var k=0;k<plan.segments.length;k++){var range=plan.segments[k];item.setInPoint(range['in'],4);item.setOutPoint(range.out,4);var ok=seq.overwriteClip(item,String(at),vi,ai);if(ok===false)throw new Error('Premiere rejected a cut insertion');at+=range.out-range['in'];}
  }catch(e){error=e.toString();}
  finally{item.setInPoint(originalIn.seconds,4);item.setOutPoint(originalOut.seconds,4);}
  var after=snapshot(seq);for(var id in after)if(after.hasOwnProperty(id)&&!before[id])created.push({id:id,signature:fingerprint(after[id])});
  if(error){for(var r=created.length-1;r>=0;r--)try{after[created[r].id].remove(false,false);}catch(e){}return fail(error+'; inserted clips were rolled back.');}
  if(!created.length)return fail('Premiere returned no inserted clips.');
  $.global.__unipraeCutUndo={sequenceID:seq.sequenceID,clips:created};
  return JSON.stringify({success:true,sequenceID:seq.sequenceID,sequenceName:seq.name,segments:plan.segments.length,insertedClips:created.length,startTime:placementTime,requestedTime:requestedAt,placement:occupied?'after-existing-clips':'playhead',undo:'VideoSilencer.undoLastCut',message:'Cuts pasted at '+placementTime.toFixed(2)+'s in the current timeline'+(occupied?' after existing clips because the playhead range was occupied':'')+'. Original clips remain unchanged.'});
 };
 VideoSilencer.undoLastCut=function(){
  var record=$.global.__unipraeCutUndo,seq=app.project&&app.project.activeSequence;
  if(!record)return fail('No silence cut operation to undo in this session.');
  if(!seq||seq.sequenceID!==record.sequenceID)return fail('Activate the sequence containing the last silence cut.');
  var current=snapshot(seq);
  for(var i=0;i<record.clips.length;i++){var c=record.clips[i];if(!current[c.id]||fingerprint(current[c.id])!==c.signature)return fail('The inserted cuts were changed or already undone. Use Premiere History to restore them.');}
  for(var j=record.clips.length-1;j>=0;j--)current[record.clips[j].id].remove(false,false);
  delete $.global.__unipraeCutUndo;
  return JSON.stringify({success:true,message:'Last silence cut removed from this timeline.'});
 };
}());

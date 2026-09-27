import { z } from 'zod';
import { runAdobeScript } from './adobe-universal.js';
// Self-contained ES3 scripts work with existing installed CEP bridges.
const index = z.number().int().min(0);
const seconds = z.number().finite().min(0);
const target = { sequenceId: z.string().min(1), trackType: z.enum(['video', 'audio']), trackIndex: index, clipIndex: index, clipNodeId: z.string().min(1) };
const parameter = { ...target, componentIndex: index, propertyIndex: index };
const registry = {};
function tool(name, description, shape, body) {
    registry['ppro_' + name] = { description, schema: z.object(shape).strict(), body };
}
const helpers = `var project=app.project,seq=project&&project.activeSequence;
function needSeq(){if(!seq)throw Error('No active sequence');if(a.sequenceId&&String(seq.sequenceID)!==a.sequenceId)throw Error('Active sequence changed; inspect again');return seq;}
function time(s){var t=new Time();t.seconds=s;return t;}
function clip(){needSeq();var tracks=a.trackType==='audio'?seq.audioTracks:seq.videoTracks;if(a.trackIndex>=tracks.numTracks)throw Error('Track missing');var tr=tracks[a.trackIndex];if(a.clipIndex>=tr.clips.numItems)throw Error('Clip missing');var c=tr.clips[a.clipIndex];if(String(c.nodeId)!==a.clipNodeId)throw Error('Clip changed; inspect again');return c;}
function prop(){var c=clip();if(a.componentIndex>=c.components.numItems)throw Error('Component missing');var co=c.components[a.componentIndex];if(a.propertyIndex>=co.properties.numItems)throw Error('Property missing');return co.properties[a.propertyIndex];}
function item(id){var found=null;function walk(x){if(String(x.nodeId)===id){found=x;return;}if(x.children)for(var i=0;i<x.children.numItems&&!found;i++)walk(x.children[i]);}if(!project)throw Error('No project');walk(project.rootItem);if(!found)throw Error('Project item missing');return found;}
function method(o,n){if(!o||typeof o[n]!=='function')throw Error('Unsupported by this Premiere version: '+n);}
`;
tool('editor_capabilities', 'Report editor extension version and available active-sequence APIs.', {}, `var names=['importMGT','createCaptionTrack','clone','insertClip','overwriteClip','exportAsMediaDirect','exportAsFinalCutProXML'];var api={};for(var i=0;i<names.length;i++)api[names[i]]=!!seq&&typeof seq[names[i]]==='function';return {version:1,sequenceId:seq?String(seq.sequenceID):null,api:api,limitations:['No universal UI/menu control','No guaranteed caption-to-graphic conversion','No automatic transaction rollback']};`);
tool('inspect_timeline', 'Inspect all audio/video clips with stable IDs, timing, selection and sequence settings. Indices are zero-based.', {}, `needSeq();var out=[];for(var k=0;k<2;k++){var ts=k?seq.audioTracks:seq.videoTracks;for(var t=0;t<ts.numTracks;t++)for(var i=0;i<ts[t].clips.numItems;i++){var c=ts[t].clips[i];out.push({trackType:k?'audio':'video',trackIndex:t,clipIndex:i,clipNodeId:String(c.nodeId),name:c.name,start:c.start.seconds,end:c.end.seconds,inPoint:c.inPoint.seconds,outPoint:c.outPoint.seconds,projectItemId:c.projectItem?String(c.projectItem.nodeId):null});}}return {sequenceId:String(seq.sequenceID),name:seq.name,settings:seq.getSettings(),clips:out};`);
tool('list_project_items', 'List project bins and media with stable item IDs.', {}, `if(!project)throw Error('No project');var out=[];function walk(x,depth){var p='';try{p=x.getMediaPath();}catch(e){}out.push({id:String(x.nodeId),name:x.name,type:x.type,depth:depth,path:p});if(x.children)for(var i=0;i<x.children.numItems;i++)walk(x.children[i],depth+1);}walk(project.rootItem,0);return out;`);
tool('import_media', 'Import existing media files into the project root without editing a timeline.', { paths: z.array(z.string().min(1)).min(1).max(100) }, `if(!project)throw Error('No project');for(var i=0;i<a.paths.length;i++)if(!(new File(a.paths[i])).exists)throw Error('File missing: '+a.paths[i]);var ok=project.importFiles(a.paths,true,project.rootItem,false);if(!ok)throw Error('Premiere rejected import');return {imported:a.paths};`);
tool('create_bin', 'Create a project bin.', { name: z.string().min(1) }, `if(!project)throw Error('No project');var b=project.rootItem.createBin(a.name);if(!b)throw Error('Bin creation failed');return {id:String(b.nodeId),name:b.name};`);
tool('move_project_item', 'Move an existing project item into an existing bin.', { itemId: z.string(), binId: z.string() }, `var x=item(a.itemId),b=item(a.binId);if(b.type!==2)throw Error('Destination is not a bin');if(x===b)throw Error('Cannot move bin into itself');x.moveBin(b);return {itemId:a.itemId,binId:a.binId};`);
tool('clone_sequence', 'Duplicate the active sequence before an editing session.', { sequenceId: z.string().min(1) }, `needSeq();method(seq,'clone');var ok=seq.clone();if(!ok)throw Error('Clone failed');return {cloned:true,sourceId:a.sequenceId};`);
tool('set_playhead', 'Move the active sequence playhead in seconds.', { sequenceId: z.string().min(1), seconds }, `needSeq();seq.setPlayerPosition(time(a.seconds).ticks);return {seconds:seq.getPlayerPosition().seconds};`);
tool('set_sequence_range', 'Set sequence In/Out range in seconds.', { sequenceId: z.string().min(1), start: seconds, end: seconds }, `needSeq();if(a.end<=a.start)throw Error('End must follow start');seq.setInPoint(a.start);seq.setOutPoint(a.end);return {start:seq.getInPoint(),end:seq.getOutPoint()};`);
tool('place_media', 'Insert (ripple) or overwrite a project item on explicitly chosen tracks. May change existing edits.', { sequenceId: z.string().min(1), itemId: z.string(), seconds, videoTrack: index, audioTrack: index, mode: z.enum(['insert', 'overwrite']) }, `needSeq();if(a.videoTrack>=seq.videoTracks.numTracks||a.audioTrack>=seq.audioTracks.numTracks)throw Error('Track missing');var x=item(a.itemId);var n=a.mode==='insert'?'insertClip':'overwriteClip';method(seq,n);seq[n](x,time(a.seconds),a.videoTrack,a.audioTrack);return {submitted:true,mode:a.mode,inspectTimeline:true};`);
tool('remove_clip', 'Remove exactly one identified clip. Ripple is explicit and defaults to false; linked partner is not automatically removed.', { ...target, ripple: z.boolean().default(false) }, `var c=clip();c.remove(a.ripple,false);return {removed:a.clipNodeId,ripple:a.ripple};`);
tool('set_clip_enabled', 'Enable or disable an identified clip.', { ...target, enabled: z.boolean() }, `var c=clip();c.disabled=!a.enabled;return {enabled:!c.disabled};`);
tool('select_clip', 'Select or deselect one identified clip.', { ...target, selected: z.boolean() }, `var c=clip();c.setSelected(a.selected,true);return {selected:c.isSelected()};`);
tool('set_track_mute', 'Mute or unmute one track.', { sequenceId: z.string().min(1), trackType: z.enum(['audio', 'video']), trackIndex: index, muted: z.boolean() }, `needSeq();var ts=a.trackType==='audio'?seq.audioTracks:seq.videoTracks;if(a.trackIndex>=ts.numTracks)throw Error('Track missing');ts[a.trackIndex].setMute(a.muted?1:0);return {muted:ts[a.trackIndex].isMuted()};`);
tool('inspect_components', 'Inspect effect/Motion/Opacity/audio properties and their values; use returned indices for edits.', target, `var c=clip(),out=[];for(var i=0;i<c.components.numItems;i++){var co=c.components[i],ps=[];for(var j=0;j<co.properties.numItems;j++){var p=co.properties[j],v=null;try{v=p.getValue();}catch(e){}ps.push({propertyIndex:j,name:p.displayName,value:v,keyframesSupported:p.areKeyframesSupported(),timeVarying:p.isTimeVarying()});}out.push({componentIndex:i,name:co.displayName,matchName:co.matchName,properties:ps});}return out;`);
tool('set_component_value', 'Set a non-animated effect property, including Motion/Opacity/audio controls. Inspect values first; animated properties are refused.', { ...parameter, value: z.union([z.number().finite(), z.string(), z.boolean(), z.array(z.number().finite())]) }, `var p=prop();if(p.isTimeVarying())throw Error('Property is animated; use keyframes');var r=p.setValue(a.value,true);if(r!==0&&r!==undefined)throw Error('Property rejected value: '+r);return {value:p.getValue()};`);
tool('set_keyframes', 'Add or update keyframes in clip source-time seconds (clip.inPoint + timeline offset). Existing keys are retained. Values use the native property units.', { ...parameter, keys: z.array(z.object({ seconds, value: z.union([z.number().finite(), z.array(z.number().finite())]) }).strict()).min(1).max(500) }, `var c=clip(),p=prop();if(!p.areKeyframesSupported())throw Error('Keyframes unsupported');for(var i=0;i<a.keys.length;i++)if(a.keys[i].seconds<c.inPoint.seconds||a.keys[i].seconds>c.outPoint.seconds)throw Error('Key outside clip source range');p.setTimeVarying(true);for(var j=0;j<a.keys.length;j++){var t=time(a.keys[j].seconds);p.addKey(t);var r=p.setValueAtKey(t,a.keys[j].value,true);if(r!==0&&r!==undefined)throw Error('Key value rejected; earlier keys may have been applied');}return {keys:p.getKeys()};`);
tool('import_mogrt', 'Create an editable motion graphic from a local .mogrt template. Target an empty video track/range; overlap is refused.', { sequenceId: z.string().min(1), path: z.string().min(1), seconds, videoTrack: index, audioTrack: index }, `needSeq();if(!/\\.mogrt$/i.test(a.path)||!(new File(a.path)).exists)throw Error('Existing .mogrt required');if(a.videoTrack>=seq.videoTracks.numTracks||a.audioTrack>=seq.audioTracks.numTracks)throw Error('Track missing');var tr=seq.videoTracks[a.videoTrack];if(tr.clips.numItems)throw Error('Use an empty video track for safe MOGRT import');method(seq,'importMGT');var c=seq.importMGT(a.path,time(a.seconds).ticks,a.videoTrack,a.audioTrack);if(!c)throw Error('MOGRT import failed');return {clipNodeId:String(c.nodeId),name:c.name,start:c.start.seconds,end:c.end.seconds};`);
tool('inspect_mogrt', 'Inspect editable template controls (text, colors and other author-exposed fields).', target, `var c=clip();method(c,'getMGTComponent');var co=c.getMGTComponent();if(!co)throw Error('No exposed MOGRT component');var out=[];for(var i=0;i<co.properties.numItems;i++){var p=co.properties[i];out.push({propertyIndex:i,name:p.displayName,value:p.getValue()});}return out;`);
tool('set_mogrt_value', 'Set an author-exposed template control. For text use the exact value format returned by inspect_mogrt; templates differ.', { ...target, propertyIndex: index, value: z.union([z.string(), z.number().finite(), z.boolean(), z.array(z.number().finite())]) }, `var c=clip();method(c,'getMGTComponent');var co=c.getMGTComponent();if(!co||a.propertyIndex>=co.properties.numItems)throw Error('MOGRT control missing');var p=co.properties[a.propertyIndex];var r=p.setValue(a.value,true);if(r!==0&&r!==undefined)throw Error('Template rejected value');return {value:p.getValue()};`);
tool('add_marker', 'Add a named sequence marker with optional duration and comments.', { sequenceId: z.string().min(1), seconds, name: z.string(), comments: z.string().default(''), duration: seconds.default(0) }, `needSeq();var m=seq.markers.createMarker(a.seconds);m.name=a.name;m.comments=a.comments;if(a.duration)m.end=a.seconds+a.duration;return {guid:m.guid,name:m.name,start:m.start.seconds};`);
tool('list_markers', 'Read all sequence markers.', { sequenceId: z.string().min(1) }, `needSeq();var out=[],m=seq.markers.getFirstMarker();while(m){out.push({guid:m.guid,name:m.name,comments:m.comments,start:m.start.seconds,end:m.end.seconds});m=seq.markers.getNextMarker(m);}return out;`);
tool('export_sequence', 'Export active sequence with an existing Adobe .epr preset. Existing output files are refused; export may exceed bridge timeout.', { sequenceId: z.string().min(1), outputPath: z.string().min(1), presetPath: z.string().min(1), range: z.enum(['entire', 'in_out', 'work_area']).default('entire') }, `needSeq();if(!(new File(a.presetPath)).exists)throw Error('Preset missing');if((new File(a.outputPath)).exists)throw Error('Output already exists');method(seq,'exportAsMediaDirect');var r=seq.exportAsMediaDirect(a.outputPath,a.presetPath,a.range==='entire'?0:a.range==='in_out'?1:2);return {hostResult:r,outputExists:(new File(a.outputPath)).exists,path:a.outputPath};`);
export const premiereEditorTools = Object.entries(registry).map(([name, t]) => ({ name, description: t.description, inputSchema: jsonSchema(t.schema) }));
function jsonSchema(s) {
    if (s instanceof z.ZodDefault)
        return { ...jsonSchema(s._def.innerType), default: s._def.defaultValue() };
    if (s instanceof z.ZodObject) {
        const properties = {}, required = [];
        for (const [k, v] of Object.entries(s.shape)) {
            properties[k] = jsonSchema(v);
            if (!v.isOptional())
                required.push(k);
        }
        return { type: 'object', properties, required, additionalProperties: false };
    }
    if (s instanceof z.ZodEnum)
        return { type: 'string', enum: s.options };
    if (s instanceof z.ZodArray)
        return { type: 'array', items: jsonSchema(s.element), ...(s._def.minLength ? { minItems: s._def.minLength.value } : {}), ...(s._def.maxLength ? { maxItems: s._def.maxLength.value } : {}) };
    if (s instanceof z.ZodUnion)
        return { anyOf: s.options.map(jsonSchema) };
    if (s instanceof z.ZodNumber)
        return { type: s.isInt ? 'integer' : 'number', ...(s.minValue !== null ? { minimum: s.minValue } : {}) };
    if (s instanceof z.ZodBoolean)
        return { type: 'boolean' };
    return { type: 'string', ...(s instanceof z.ZodString && s.minLength ? { minLength: s.minLength } : {}) };
}
export function buildPremiereEditorScript(name, args) {
    const t = registry[name];
    if (!t)
        throw Error('Unknown editor tool');
    const parsed = t.schema.parse(args ?? {});
    return `(function(){try{var a=${JSON.stringify(parsed)};${helpers}var data=(function(){${t.body}}());return JSON.stringify({success:true,data:data});}catch(e){return JSON.stringify({success:false,error:String(e)});}}())`;
}
export async function callPremiereEditor(name, args) { return runAdobeScript('premiere-pro', buildPremiereEditorScript(name, args)); }

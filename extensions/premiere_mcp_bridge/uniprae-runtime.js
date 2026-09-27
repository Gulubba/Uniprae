/* Shared CEP host runtime. No session expiry; explicit Start/Stop and bounded recovery. */
(function () {
 'use strict';
 var cs=new CSInterface(),http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
 var ae=cs.getApplicationID()==='AEFT',port=ae?3006:3005,namespace=ae?'AeMCP':'PremiereMCP';
 var server=null,desired=false,starting=false,retry=null,busy=false,queue=[],completed=0,fileBusy=false;
 function el(id){return document.getElementById(id);}
 function log(message,error){var row=document.createElement('div');row.className=error?'err':'ok';row.textContent=new Date().toLocaleTimeString()+' '+message;el('console').appendChild(row);while(el('console').children.length>150)el('console').removeChild(el('console').firstChild);el('console').scrollTop=el('console').scrollHeight;}
 function state(text){el('state').textContent=text;}
 function evaluate(code,done){queue.push({code:code,done:done});pump();}
 function pump(){if(busy||!queue.length)return;busy=true;var item=queue.shift();var wrapped='(function(){try{var result=eval('+JSON.stringify(item.code)+');return typeof result==="string"?result:JSON.stringify(typeof result==="undefined"?{success:true}:result);}catch(e){return JSON.stringify({success:false,error:e.toString()});}})()';cs.evalScript(wrapped,function(raw){busy=false;try{item.done(raw);}catch(e){log(e.message,true);}pump();});}
 function parsed(raw){try{return JSON.parse(raw);}catch(e){return raw==='EvalScript error.'?{success:false,error:raw}:{success:true,data:raw};}}
 function update(){if(busy||queue.length)return;evaluate(namespace+'.'+(ae?'ping':'getProjectInfo')+'()',function(raw){var data=parsed(raw);el('project').textContent=data.projectName||'No project';var target=ae?data.activeComp:data.activeSequence;el('target').textContent=target?target.name:'None';});}
 function respond(res,status,data){if(!res.writableEnded&&!res.destroyed){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}}
 function schedule(){if(desired&&!retry)retry=setTimeout(function(){retry=null;start();},3000);}
 function start(){
  desired=true;localStorage.setItem('uniprae.serverWanted','true');
  if(starting||(server&&server.listening))return;starting=true;state('Starting…');
  var instance=http.createServer(function(req,res){
   // Local CEP and MCP calls do not need permissive cross-origin access.
   if(req.headers.origin&&req.headers.origin!=='null'){respond(res,403,{success:false,error:'Browser origins are not allowed'});return;}
   if(req.method==='GET'&&(req.url==='/health'||req.url==='/')){
    if(busy||queue.length){respond(res,200,{status:'busy',host:ae?'after-effects':'premiere-pro',pending:queue.length+1});return;}
    evaluate(namespace+'.ping()',function(raw){respond(res,200,parsed(raw));});return;
   }
   if(req.method!=='POST'||['/execute','/eval','/'].indexOf(req.url)<0){respond(res,404,{error:'Unknown endpoint'});return;}
   var chunks=[],size=0;req.on('data',function(chunk){size+=chunk.length;if(size>4*1024*1024){respond(res,413,{error:'Script too large'});req.destroy();return;}chunks.push(chunk);});
   req.on('end',function(){try{
    var data=JSON.parse(Buffer.concat(chunks).toString()),code=data.code||data.to_eval;
    if(typeof code!=='string')throw new Error('Expected code or to_eval string');
    if(queue.length>=50){respond(res,503,{success:false,error:'Adobe queue full; request was not accepted'});return;}
    evaluate(code,function(raw){var result=parsed(raw);completed++;el('count').textContent=completed;
     if(ae&&data.autoPreview){var preview=path.join(os.tmpdir(),'uniprae-preview-'+Date.now()+'.png').replace(/\\/g,'/');evaluate('AeMCP.capturePreview('+JSON.stringify(preview)+')',function(){result.previewPath=preview;respond(res,200,result);});}
     else respond(res,200,result);log('Command '+completed+' completed');});
   }catch(e){respond(res,400,{success:false,error:e.message});}});
  });
  server=instance;instance.timeout=0;
  instance.on('error',function(error){starting=false;if(server===instance)server=null;state('Retrying — '+error.code);log(error.message,true);schedule();});
  instance.on('close',function(){starting=false;if(server===instance)server=null;if(desired)schedule();});
  instance.listen(port,'127.0.0.1',function(){starting=false;state('Listening on port '+port);log('Server started');});
 }
 function stop(){desired=false;localStorage.setItem('uniprae.serverWanted','false');clearTimeout(retry);retry=null;if(server){server.close();server=null;}starting=false;state('Stopped');log('Server stopped; accepted commands may finish');}
 el('host').textContent=ae?'After Effects':'Premiere Pro';el('endpoint').textContent='Adobe bridge: http://127.0.0.1:'+port;
 if(el('configStatus')){try{var cfgObj=(typeof UnipraeConfig!=='undefined'&&UnipraeConfig.readConfig)?UnipraeConfig.readConfig():null;if(cfgObj){var mKey=UnipraeConfig.maskApiKey(cfgObj.groqApiKey);el('configStatus').textContent='Shared settings: '+UnipraeConfig.getConfigPath()+' · Groq: '+mKey;}else{el('configStatus').textContent='Shared settings: %LOCALAPPDATA%\\Uniprae\\settings.json';}}catch(e){}}
 el('undoCut').style.display=ae?'none':'inline-block';el('undoCut').onclick=function(){evaluate('VideoSilencer.undoLastCut()',function(raw){log(raw,!!parsed(raw).error);});};
 el('start').onclick=start;el('stop').onclick=stop;el('clear').onclick=function(){el('console').textContent='';};
 el('health').onclick=function(){evaluate(namespace+'.ping()',function(raw){log(raw,!!parsed(raw).error);});};
 Array.prototype.forEach.call(document.querySelectorAll('nav button'),function(button){button.onclick=function(){var id=button.getAttribute('data-view');Array.prototype.forEach.call(document.querySelectorAll('.view'),function(view){view.classList.toggle('active',view.id===id);});Array.prototype.forEach.call(document.querySelectorAll('nav button'),function(tab){tab.classList.toggle('active',tab===button);});var frame=el(id).querySelector('iframe');if(frame&&!frame.src){if(ae){el(id).innerHTML='<p style="padding:18px">Open this workflow in the Premiere Pro Uniprae panel.</p>';}else frame.src=frame.getAttribute('data-src');}};});
 // Preserve the legacy After Effects file transport and serialize it with HTTP edits.
 setInterval(function(){if(!ae||!desired||!server||!server.listening)return;try{
  fs.writeFileSync(path.join(os.tmpdir(),'ae-mcp-ready.txt'),'READY:'+Date.now()+'\nPROCESSOR:CEP_EXTENSION\nGENERATION:3\n');
  if(fileBusy||busy)return;var dir=path.join(os.tmpdir(),'ae-mcp-commands');if(!fs.existsSync(dir))return;
  var files=fs.readdirSync(dir).filter(function(name){return /\.jsx$/.test(name);});if(!files.length)return;
  var source=path.join(dir,files[0]),claimed=source+'.running-'+process.pid;try{fs.renameSync(source,claimed);}catch(e){return;}
  var code=fs.readFileSync(claimed,'utf8');fileBusy=true;evaluate(code,function(){fileBusy=false;try{fs.unlinkSync(claimed);}catch(e){}});
 }catch(e){log(e.message,true);}},1000);
 setInterval(update,4000);update();
 if(localStorage.getItem('uniprae.serverWanted')==='true')start();else log('Press Start Server to accept AI commands.');
 window.addEventListener('beforeunload',function(){desired=false;clearTimeout(retry);if(server)server.close();});
}());

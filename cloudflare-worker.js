/**
 * Crypto 10 Fusion V5.5 - OPTIONAL Cloudflare Worker for Google Gemini FREE tier.
 * GitHub frontend must NEVER contain the Gemini key. Use Worker SECRET bindings:
 *   GEMINI_API_KEY = Google AI Studio FREE TIER key (no paid billing plan)
 *   AI_ACCESS_TOKEN = long, private passcode; type only into Dashboard per session
 *   DASHBOARD_ORIGIN = https://manikanta0k-sys.github.io (optional plain variable)
 * Worker runs only POST /analyze; no automatic polling or credential exposure.
 * Exceeding free-tier quota should return an error, not fall back to paid.
 */
const DEFAULT_ORIGIN='https://manikanta0k-sys.github.io';
const headers=origin=>({
 'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Access-Control-Allow-Headers':'content-type,x-worker-passcode','Vary':'Origin',
 'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'
});
function respond(origin,code,data){return new Response(JSON.stringify(data),{status:code,headers:headers(origin)});}
const clean=(v,max=120)=>typeof v==='string'?v.slice(0,max).replace(/[\x00-\x1f]/g,' '):'';
export default {
 async fetch(request,env){
  const allowed=env.DASHBOARD_ORIGIN||DEFAULT_ORIGIN;
  const origin=request.headers.get('Origin')||'';
  // Browser origin restriction is one layer; access token is mandatory even if Origin is spoofed.
  if(origin!==allowed)return respond(allowed,403,{error:'Origin not allowed. Open your GitHub Pages dashboard.'});
  const url=new URL(request.url);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(allowed)});
  if(url.pathname!=='/analyze'||request.method!=='POST')return respond(allowed,404,{error:'Only POST /analyze is available.'});
  if(!env.GEMINI_API_KEY||!env.AI_ACCESS_TOKEN)return respond(allowed,503,{error:'Worker secrets are not configured.'});
  if((request.headers.get('X-Worker-Passcode')||'')!==env.AI_ACCESS_TOKEN)return respond(allowed,401,{error:'Incorrect Worker passcode.'});
  if(!(request.headers.get('Content-Type')||'').includes('application/json'))return respond(allowed,415,{error:'JSON body required.'});
  if(Number(request.headers.get('Content-Length')||0)>1800000)return respond(allowed,413,{error:'Screenshot exceeds size limit.'});
  let raw='';try{raw=await request.text();if(raw.length>1800000)return respond(allowed,413,{error:'Screenshot exceeds size limit.'});}catch{return respond(allowed,400,{error:'Could not read request.'});}
  let data;try{data=JSON.parse(raw);}catch{return respond(allowed,400,{error:'Invalid JSON.'});}
  const b64=data?.imageBase64;
  if(data?.mimeType!=='image/jpeg'||typeof b64!=='string'||b64.length<200||b64.length>1700000||!/^[A-Za-z0-9+/=]+$/.test(b64))return respond(allowed,400,{error:'A valid JPEG screenshot is required.'});
  const s=data.summary||{};
  const indicators=s.indicatorVotes||{};
  const hint=`Local screenshot-only estimate: ${clean(s.decision,10)}. Quality: ${clean(s.quality,30)}. Detected pattern: ${clean(s.pattern,70)}. Votes UP ${Number(indicators.up)||0}, DOWN ${Number(indicators.down)||0}, WAIT ${Number(indicators.wait)||0}. Claimed target: ${clean(s.target,60)}. These values are approximate and unverified.`;
  const prompt=`Review this STATIC screenshot of a purported Binomo Crypto IDX 1-minute candle chart for EDUCATIONAL DEMO research. You DO NOT have a live feed, verified OHLC data or accurate next-candle forecast. Do not claim you can see the present market or a future candle. Do not give betting instructions (no 'enter UP/DOWN now'), percent win-probabilities, false market prices or specific technical indicator values not clearly visible. Be skeptical of screenshot quality and overlays. This is a screenshot second opinion only. ${hint} Return only a valid JSON object with exactly five short string fields: {"summary":"What is visible, in 1-2 sentences; say uncertain if needed","bullish_clues":"Visible bullish cues or not verifiable","bearish_clues":"Visible bearish cues or not verifiable","caution":"Conflicts, uncertain pixels, stale data and reasons to WAIT","next_screenshot":"Recommend fresh screenshot AFTER the intermediate candle closes, to check the next+2 minute target; never promise its direction"}. Keep all text simple English and brief.`;
  const input={contents:[{role:'user',parts:[{text:prompt},{inline_data:{mime_type:'image/jpeg',data:b64}}]}],generationConfig:{temperature:0.2,maxOutputTokens:350,responseMimeType:'application/json'}};
  let upstream;
  try{upstream=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify(input),signal:AbortSignal.timeout(25000)});}
  catch{return respond(allowed,503,{error:'Gemini could not be reached. No online analysis was generated.'});}
  if(!upstream.ok){
   if(upstream.status===429)return respond(allowed,429,{error:'Gemini free tier rate limit reached. Try later; do not upgrade to paid.'});
   return respond(allowed,502,{error:'Gemini request failed (status '+upstream.status+'). Check free-tier access and model availability.'});
  }
  let payload;try{payload=await upstream.json();}catch{return respond(allowed,502,{error:'Invalid response from Gemini.'});}
  const answer=payload?.candidates?.[0]?.content?.parts?.filter(p=>typeof p.text==='string').map(p=>p.text).join('')||'';
  let parsed;try{parsed=JSON.parse(answer.replace(/^```(?:json)?\s*|\s*```$/g,'').trim());}catch{return respond(allowed,502,{error:'Online model did not return parseable analysis.'});}
  if(!parsed||typeof parsed!=='object')return respond(allowed,502,{error:'Invalid model analysis.'});
  const fields=['summary','bullish_clues','bearish_clues','caution','next_screenshot'];
  const safe={};for(const key of fields)safe[key]=clean(parsed[key],460)||'Not verifiable from this screenshot.';
  return respond(allowed,200,{analysis:safe,provider:'Gemini 2.5 Flash-Lite (free tier)',live:false});
 }
};

const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
function compile(path, mocks={}) {const out=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const module={exports:{}};vm.runInNewContext(out,{module,exports:module.exports,require:n=>mocks[n]||require(n),console,Buffer,Date,BigInt,fetch,setTimeout});return module.exports;}
(async()=>{
 const {PumpFunSDK,PUMP_PROGRAM_ID}=compile('lib/pump.ts');
 const data=Buffer.alloc(49);[1073000000000000n,30000000000n,793100000000000n,0n,1000000000000000n].forEach((v,i)=>data.writeBigUInt64LE(v,8+i*8));
 const sdk=new PumpFunSDK({getAccountInfo:async()=>({owner:PUMP_PROGRAM_ID,data})});
 const state=await sdk.getBondingCurveState('3HPpMLK7LjKFqSnCsBYNiijhNTo7dkkx3FCSAHKSpump');assert(Math.abs(sdk.calculatePrice(state)-30/1073000000)<1e-16);assert.equal(sdk.calculateProgress(state),0);assert.equal(sdk.calculateProgress({...state,realTokenReserves:396550000000000n}),50);
 sdk.connection.getAccountInfo=async()=>null;assert.equal(await sdk.getBondingCurveState('3HPpMLK7LjKFqSnCsBYNiijhNTo7dkkx3FCSAHKSpump'),null);
 sdk.connection.getAccountInfo=async()=>{throw Error('offline')};await assert.rejects(()=>sdk.getBondingCurveState('3HPpMLK7LjKFqSnCsBYNiijhNTo7dkkx3FCSAHKSpump'));
 let reads=0; const cache={mode:'pre-launch'}; const fakeRedis={get:async()=>cache.mode,set:async(k,v)=>cache.mode=v,hgetall:async()=>({}),hset:async()=>{},hmset:async(k,v)=>{cache.summary={...cache.summary,...v}},zadd:async()=>{}};
 class FakePump {async getBondingCurveState(){reads++;return state} calculatePrice(){return 30/1073000000} calculateProgress(){return 50}}
 const mod=compile('functions/amm-poller.ts',{'../lib/redis':{redis:fakeRedis},'../lib/tokenConfig':{redisKeys:{},TOKEN_CONFIG:{}},'../lib/pump':{PumpFunSDK:FakePump},'../lib/helius':{connection:{},getTokenSupply:async()=>1e9,getTokenBalance:async()=>0}});
 const response=await mod.handler();assert.equal(response.statusCode,200);assert.equal(cache.mode,'bonding-curve');assert.equal(cache.summary.curve_progress,'50');assert(reads>0);
 const metrics=compile('functions/metrics.ts',{'@lib/redis':{redis:{zrange:async()=>[{t:1,price_sol:2},JSON.stringify({t:2,price_sol:3})]}},'@lib/tokenConfig':{redisKeys:{}}});const m=JSON.parse((await metrics.handler({queryStringParameters:{}})).body);assert.equal(m.price.length,2);assert.equal(m.price[1].price_sol,3);
 console.log('PASS: pre-launch rechecks and activates, price/progress math, missing account vs RPC failure, Redis object/string history.');
})().catch(e=>{console.error(e);process.exit(1)});

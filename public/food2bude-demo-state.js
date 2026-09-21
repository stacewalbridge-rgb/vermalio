(function(){
const KEY='food2bude_demo_order_v2';
function seed(){
  return {
    id:'F2B-1042',
    customer:{name:'Demo Customer',address:'Bude, EX23'},
    status:'DRAFT',
    paymentStatus:'NOT_CHARGED',
    total:22.45,
    deliveryFee:2.99,
    merchants:[
      {id:'mermaid',name:'The Mermaid',status:'REQUESTED',readyMins:null,items:[{name:'Cod & Chips',qty:1,price:12.95}]},
      {id:'crooklets',name:'Crooklets Beach Cafe',status:'REQUESTED',readyMins:null,items:[{name:'Dirty Fries',qty:1,price:6.51}]}
    ],
    dispatch:{status:'WAITING_FOR_PAYMENT',driver:null,stops:[]},
    updatedAt:Date.now()
  };
}
function get(){try{return JSON.parse(localStorage.getItem(KEY))||seed()}catch(e){return seed()}}
function set(o){o.updatedAt=Date.now();localStorage.setItem(KEY,JSON.stringify(o));window.dispatchEvent(new CustomEvent('food2bude:state',{detail:o}));return o}
function reset(){return set(seed())}
function request(){const o=get();o.status='REQUESTED';o.paymentStatus='NOT_CHARGED';o.merchants.forEach(m=>m.status='REQUESTED');o.dispatch={status:'WAITING_FOR_MERCHANTS',driver:null,stops:[]};return set(o)}
function merchantDecision(id,accepted,mins){
 const o=get(),m=o.merchants.find(x=>x.id===id); if(!m)return o;
 m.status=accepted?'ACCEPTED':'DECLINED';m.readyMins=accepted?(Number(mins)||15):null;
 if(!accepted){o.status='CUSTOMER_ACTION_REQUIRED';o.paymentStatus='NOT_CHARGED';o.dispatch.status='ON_HOLD';return set(o)}
 const all=o.merchants.every(x=>x.status==='ACCEPTED');
 if(all){o.status='MERCHANTS_ACCEPTED';o.paymentStatus='AWAITING_PAYMENT';o.dispatch.status='WAITING_FOR_PAYMENT'}
 return set(o);
}
function pay(success=true){
 const o=get(); if(o.status!=='MERCHANTS_ACCEPTED')return o;
 o.paymentStatus='PROCESSING';set(o);
 if(success){
  o.paymentStatus='PAID';o.status='PREPARING';o.merchants.forEach(m=>m.status='PAID');
  const stops=[...o.merchants].sort((a,b)=>(a.readyMins||99)-(b.readyMins||99)).map((m,i)=>({sequence:i+1,merchant:m.name,readyMins:m.readyMins}));
  o.dispatch={status:'ROUTE_READY',driver:'WhyDrive driver',stops};
 } else {
  o.paymentStatus='FAILED';o.status='PAYMENT_FAILED';o.dispatch.status='ON_HOLD';
 }
 return set(o);
}
function markReady(id){
 const o=get(),m=o.merchants.find(x=>x.id===id);if(m&&o.paymentStatus==='PAID'){m.status='READY';}
 if(o.merchants.every(x=>x.status==='READY'))o.dispatch.status='READY_TO_COLLECT';
 return set(o);
}
window.Food2BudeDemo={get,set,reset,request,merchantDecision,pay,markReady};
})();
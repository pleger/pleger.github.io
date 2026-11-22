export const statuses = ['iniciando', 'en desarrollo', 'enviado', 'en revisión', 'aceptado', 'rechazado'];
export const initialResearchers = [
 {id:'00000000-0000-4000-8000-000000000001',first_name:'Paul',last_name:'Leger',emails:[],orcid:'0000-0003-0969-5139'},
 {id:'00000000-0000-4000-8000-000000000002',first_name:'Agustín',last_name:'Olivares',emails:[],orcid:'0009-0002-6428-6805'}
];
export function validOrcid(value) {
 const s=value.replace(/^https:\/\/orcid.org\//,'').toUpperCase();
 if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s))return false;
 const raw=s.replaceAll('-',''); let total=0;
 for(const digit of raw.slice(0,15))total=(total+Number(digit))*2;
 const result=(12-total%11)%11;
 return raw[15]===(result===10?'X':String(result));
}
export function daysUntil(date,today=new Date()) {
 if(!date)return null;
 const now=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
 return Math.round((Date.parse(date+'T00:00:00Z')-now)/86400000);
}
export function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}

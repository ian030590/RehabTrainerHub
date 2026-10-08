var Xh=Object.defineProperty;var qh=(s,e,t)=>e in s?Xh(s,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):s[e]=t;var X=(s,e,t)=>qh(s,typeof e!="symbol"?e+"":e,t);import{P as Ze,R as Yh,t as cs,F as ws,a as jh,I as Kh,b as Zo}from"./index-DGuYbwJ6.js";function Zh(s,e,t){const n=$h(),i=String(e).trim().replace(/^\/+/,""),r=String(t||"").trim();return!i||!r?[]:n?[`${n}/${i}`,r]:[r]}function $h(s){const e="".trim().replace(/\/+$/,"");if(!e)return"";try{const t=new URL(e);return t.protocol==="https:"?t.href.replace(/\/+$/,""):""}catch{return""}}const wr=1e3/60,Jh=72,Qh=1,eu=80,tu=3500,nu=8;async function iu(s={}){const e=s.signal;if(typeof window>"u"||typeof window.requestAnimationFrame!="function")return Rr(wr,[],Ar());if(e!=null&&e.aborted)return Rr(wr,[],Ar());const t=Math.max(1,Math.floor(s.sampleCount??Jh)),n=Math.min(t,Math.max(1,Math.floor(s.minimumSampleCount??nu))),i=s.minSampleMs??Qh,r=s.maxSampleMs??eu,a=s.timeoutMs??tu,o=[];let l=0;await new Promise(u=>{let f=!1,g=0,x=0,m=0;const p=()=>{f||g||typeof document<"u"&&document.visibilityState==="hidden"||(g=window.requestAnimationFrame(b))},v=()=>{if(document.visibilityState==="hidden"){g&&window.cancelAnimationFrame(g),x&&window.clearTimeout(x),g=0,x=0,l=0;return}p()},S=()=>{f||(f=!0,g&&window.cancelAnimationFrame(g),x&&window.clearTimeout(x),m&&window.clearTimeout(m),typeof document<"u"&&document.removeEventListener("visibilitychange",v),e==null||e.removeEventListener("abort",S),u())},b=A=>{if(!f){if(g=0,x||(x=window.setTimeout(S,Math.max(250,a))),l>0){const T=A-l;T>=i&&T<=r&&o.push(T)}if(l=A,o.length>=t){S();return}p()}};if(typeof document<"u"&&document.addEventListener("visibilitychange",v),e==null||e.addEventListener("abort",S,{once:!0}),e!=null&&e.aborted){S();return}p(),m=window.setTimeout(S,Math.max(3e4,a*10))});const c=ru(o),h=c.length>=n?c:[],d=au(h)||wr;return Rr(d,h,Ar())}function Ar(){if(typeof navigator>"u")return"unknown";const s=navigator.userAgent||"",e=navigator.platform||"",t=navigator.maxTouchPoints>1,n=e==="MacIntel"&&t,i=typeof window<"u"&&typeof window.matchMedia=="function"&&window.matchMedia("(pointer: coarse)").matches,r=typeof window<"u"&&window.screen?Math.min(window.screen.width,window.screen.height):0,a=typeof window<"u"&&window.screen?Math.max(window.screen.width,window.screen.height):0;return/iPad|Tablet|PlayBook|Silk/i.test(s)||n?"tablet":/Mobi|Android|iPhone|iPod|Windows Phone/i.test(s)?"phone":t&&i&&r>0&&r<=1024&&a<=1400?"tablet":"desktop"}function su(s){if(!Number.isFinite(s)||s<=0)return!1;const e=Math.max(1,Math.round(s/60))*60,t=Math.max(1,e*.015);return Math.abs(s-e)<=t}function Rr(s,e,t){const n=1e3/s,i=Math.max(1,Math.round(n/60))*60;return{refreshMs:s,refreshHz:n,sampleCount:e.length,measured:e.length>0,isFallback:e.length===0,standardDeviationMs:ou(e,s),nearest60HzMultiple:i,is60HzFamily:su(n),deviceKind:t,isMobileOrTablet:t==="phone"||t==="tablet"}}function ru(s){if(s.length<8)return s;const e=[...s].sort((n,i)=>n-i),t=Math.floor(e.length*.1);return e.slice(t,e.length-t)}function au(s){if(s.length===0)return 0;const e=[...s].sort((n,i)=>n-i),t=Math.floor(e.length/2);return e.length%2===0?(e[t-1]+e[t])/2:e[t]}function ou(s,e){if(s.length===0)return 0;const t=s.reduce((n,i)=>n+(i-e)**2,0)/s.length;return Math.sqrt(t)}/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const fo="184",lu=0,$o=1,cu=2,tr=1,hu=2,hs=3,In=0,Bt=1,en=2,Pn=0,Ii=1,Jo=2,Qo=3,el=4,uu=5,oi=100,du=101,fu=102,pu=103,mu=104,gu=200,xu=201,_u=202,vu=203,ma=204,ga=205,Mu=206,Su=207,yu=208,bu=209,Tu=210,Eu=211,wu=212,Au=213,Ru=214,xa=0,_a=1,va=2,Oi=3,Ma=4,Sa=5,ya=6,ba=7,Uc=0,Cu=1,Lu=2,mn=0,Fc=1,Oc=2,Bc=3,kc=4,zc=5,Vc=6,Hc=7,tl="attached",Pu="detached",Gc=300,hi=301,Bi=302,Cr=303,Lr=304,xr=306,ui=1e3,fn=1001,lr=1002,bt=1003,Wc=1004,us=1005,Tt=1006,nr=1007,Cn=1008,Wt=1009,Xc=1010,qc=1011,gs=1012,po=1013,xn=1014,Kt=1015,Nn=1016,mo=1017,go=1018,xs=1020,Yc=35902,jc=35899,Kc=1021,Zc=1022,Zt=1023,Un=1026,ci=1027,xo=1028,_o=1029,di=1030,vo=1031,Mo=1033,ir=33776,sr=33777,rr=33778,ar=33779,Ta=35840,Ea=35841,wa=35842,Aa=35843,Ra=36196,Ca=37492,La=37496,Pa=37488,Da=37489,cr=37490,Ia=37491,Na=37808,Ua=37809,Fa=37810,Oa=37811,Ba=37812,ka=37813,za=37814,Va=37815,Ha=37816,Ga=37817,Wa=37818,Xa=37819,qa=37820,Ya=37821,ja=36492,Ka=36494,Za=36495,$a=36283,Ja=36284,hr=36285,Qa=36286,_s=2300,vs=2301,Pr=2302,nl=2303,il=2400,sl=2401,rl=2402,Du=2500,Iu=0,$c=1,eo=2,Nu=3200,to=0,Uu=1,Yn="",Ct="srgb",Xt="srgb-linear",ur="linear",$e="srgb",gi=7680,al=519,Fu=512,Ou=513,Bu=514,So=515,ku=516,zu=517,yo=518,Vu=519,no=35044,ol="300 es",pn=2e3,Ms=2001;function Hu(s){for(let e=s.length-1;e>=0;--e)if(s[e]>=65535)return!0;return!1}function Gu(s){return ArrayBuffer.isView(s)&&!(s instanceof DataView)}function Ss(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function Wu(){const s=Ss("canvas");return s.style.display="block",s}const ll={};function dr(...s){const e="THREE."+s.shift();console.log(e,...s)}function Jc(s){const e=s[0];if(typeof e=="string"&&e.startsWith("TSL:")){const t=s[1];t&&t.isStackTrace?s[0]+=" "+t.getLocation():s[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return s}function Se(...s){s=Jc(s);const e="THREE."+s.shift();{const t=s[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...s)}}function Ae(...s){s=Jc(s);const e="THREE."+s.shift();{const t=s[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...s)}}function io(...s){const e=s.join(" ");e in ll||(ll[e]=!0,Se(...s))}function Xu(s,e,t){return new Promise(function(n,i){function r(){switch(s.clientWaitSync(e,s.SYNC_FLUSH_COMMANDS_BIT,0)){case s.WAIT_FAILED:i();break;case s.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}const qu={[xa]:_a,[va]:ya,[Ma]:ba,[Oi]:Sa,[_a]:xa,[ya]:va,[ba]:Ma,[Sa]:Oi};class fi{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const i=n[e];if(i!==void 0){const r=i.indexOf(t);r!==-1&&i.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const i=n.slice(0);for(let r=0,a=i.length;r<a;r++)i[r].call(this,e);e.target=null}}}const Pt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let cl=1234567;const fs=Math.PI/180,ki=180/Math.PI;function sn(){const s=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Pt[s&255]+Pt[s>>8&255]+Pt[s>>16&255]+Pt[s>>24&255]+"-"+Pt[e&255]+Pt[e>>8&255]+"-"+Pt[e>>16&15|64]+Pt[e>>24&255]+"-"+Pt[t&63|128]+Pt[t>>8&255]+"-"+Pt[t>>16&255]+Pt[t>>24&255]+Pt[n&255]+Pt[n>>8&255]+Pt[n>>16&255]+Pt[n>>24&255]).toLowerCase()}function Ge(s,e,t){return Math.max(e,Math.min(t,s))}function bo(s,e){return(s%e+e)%e}function Yu(s,e,t,n,i){return n+(s-e)*(i-n)/(t-e)}function ju(s,e,t){return s!==e?(t-s)/(e-s):0}function ps(s,e,t){return(1-t)*s+t*e}function Ku(s,e,t,n){return ps(s,e,1-Math.exp(-t*n))}function Zu(s,e=1){return e-Math.abs(bo(s,e*2)-e)}function $u(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*(3-2*s))}function Ju(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*s*(s*(s*6-15)+10))}function Qu(s,e){return s+Math.floor(Math.random()*(e-s+1))}function ed(s,e){return s+Math.random()*(e-s)}function td(s){return s*(.5-Math.random())}function nd(s){s!==void 0&&(cl=s);let e=cl+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function id(s){return s*fs}function sd(s){return s*ki}function rd(s){return(s&s-1)===0&&s!==0}function ad(s){return Math.pow(2,Math.ceil(Math.log(s)/Math.LN2))}function od(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function ld(s,e,t,n,i){const r=Math.cos,a=Math.sin,o=r(t/2),l=a(t/2),c=r((e+n)/2),h=a((e+n)/2),d=r((e-n)/2),u=a((e-n)/2),f=r((n-e)/2),g=a((n-e)/2);switch(i){case"XYX":s.set(o*h,l*d,l*u,o*c);break;case"YZY":s.set(l*u,o*h,l*d,o*c);break;case"ZXZ":s.set(l*d,l*u,o*h,o*c);break;case"XZX":s.set(o*h,l*g,l*f,o*c);break;case"YXY":s.set(l*f,o*h,l*g,o*c);break;case"ZYZ":s.set(l*g,l*f,o*h,o*c);break;default:Se("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function tn(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function Je(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}const cd={DEG2RAD:fs,RAD2DEG:ki,generateUUID:sn,clamp:Ge,euclideanModulo:bo,mapLinear:Yu,inverseLerp:ju,lerp:ps,damp:Ku,pingpong:Zu,smoothstep:$u,smootherstep:Ju,randInt:Qu,randFloat:ed,randFloatSpread:td,seededRandom:nd,degToRad:id,radToDeg:sd,isPowerOfTwo:rd,ceilPowerOfTwo:ad,floorPowerOfTwo:od,setQuaternionFromProperEuler:ld,normalize:Je,denormalize:tn},Oo=class Oo{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Ge(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),i=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*i+e.x,this.y=r*i+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};Oo.prototype.isVector2=!0;let qe=Oo;class Fn{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,r,a,o){let l=n[i+0],c=n[i+1],h=n[i+2],d=n[i+3],u=r[a+0],f=r[a+1],g=r[a+2],x=r[a+3];if(d!==x||l!==u||c!==f||h!==g){let m=l*u+c*f+h*g+d*x;m<0&&(u=-u,f=-f,g=-g,x=-x,m=-m);let p=1-o;if(m<.9995){const v=Math.acos(m),S=Math.sin(v);p=Math.sin(p*v)/S,o=Math.sin(o*v)/S,l=l*p+u*o,c=c*p+f*o,h=h*p+g*o,d=d*p+x*o}else{l=l*p+u*o,c=c*p+f*o,h=h*p+g*o,d=d*p+x*o;const v=1/Math.sqrt(l*l+c*c+h*h+d*d);l*=v,c*=v,h*=v,d*=v}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=d}static multiplyQuaternionsFlat(e,t,n,i,r,a){const o=n[i],l=n[i+1],c=n[i+2],h=n[i+3],d=r[a],u=r[a+1],f=r[a+2],g=r[a+3];return e[t]=o*g+h*d+l*f-c*u,e[t+1]=l*g+h*u+c*d-o*f,e[t+2]=c*g+h*f+o*u-l*d,e[t+3]=h*g-o*d-l*u-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,i=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(i/2),d=o(r/2),u=l(n/2),f=l(i/2),g=l(r/2);switch(a){case"XYZ":this._x=u*h*d+c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d-u*f*g;break;case"YXZ":this._x=u*h*d+c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d+u*f*g;break;case"ZXY":this._x=u*h*d-c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d-u*f*g;break;case"ZYX":this._x=u*h*d-c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d+u*f*g;break;case"YZX":this._x=u*h*d+c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d-u*f*g;break;case"XZY":this._x=u*h*d-c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d+u*f*g;break;default:Se("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],i=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],h=t[6],d=t[10],u=n+o+d;if(u>0){const f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(a-i)*f}else if(n>o&&n>d){const f=2*Math.sqrt(1+n-o-d);this._w=(h-l)/f,this._x=.25*f,this._y=(i+a)/f,this._z=(r+c)/f}else if(o>d){const f=2*Math.sqrt(1+o-n-d);this._w=(r-c)/f,this._x=(i+a)/f,this._y=.25*f,this._z=(l+h)/f}else{const f=2*Math.sqrt(1+d-n-o);this._w=(a-i)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ge(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,i=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+a*o+i*c-r*l,this._y=i*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-i*o,this._w=a*h-n*o-i*l-r*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,i=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,i=-i,r=-r,a=-a,o=-o);let l=1-t;if(o<.9995){const c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+n*t,this._y=this._y*l+i*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+i*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}const Bo=class Bo{constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(hl.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(hl.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*i,this.y=r[1]*t+r[4]*n+r[7]*i,this.z=r[2]*t+r[5]*n+r[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,i=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*i+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*i+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*i+r[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,i=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*i-o*n),h=2*(o*t-r*i),d=2*(r*n-a*t);return this.x=t+l*c+a*d-o*h,this.y=n+l*h+o*c-r*d,this.z=i+l*d+r*h-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i,this.y=r[1]*t+r[5]*n+r[9]*i,this.z=r[2]*t+r[6]*n+r[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,i=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=i*l-r*o,this.y=r*a-n*l,this.z=n*o-i*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Dr.copy(this).projectOnVector(e),this.sub(Dr)}reflect(e){return this.sub(Dr.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Ge(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};Bo.prototype.isVector3=!0;let U=Bo;const Dr=new U,hl=new Fn,ko=class ko{constructor(e,t,n,i,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,a,o,l,c)}set(e,t,n,i,r,a,o,l,c){const h=this.elements;return h[0]=e,h[1]=i,h[2]=o,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,i=t.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],d=n[7],u=n[2],f=n[5],g=n[8],x=i[0],m=i[3],p=i[6],v=i[1],S=i[4],b=i[7],A=i[2],T=i[5],R=i[8];return r[0]=a*x+o*v+l*A,r[3]=a*m+o*S+l*T,r[6]=a*p+o*b+l*R,r[1]=c*x+h*v+d*A,r[4]=c*m+h*S+d*T,r[7]=c*p+h*b+d*R,r[2]=u*x+f*v+g*A,r[5]=u*m+f*S+g*T,r[8]=u*p+f*b+g*R,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*a*h-t*o*c-n*r*h+n*o*l+i*r*c-i*a*l}invert(){const e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],d=h*a-o*c,u=o*l-h*r,f=c*r-a*l,g=t*d+n*u+i*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const x=1/g;return e[0]=d*x,e[1]=(i*c-h*n)*x,e[2]=(o*n-i*a)*x,e[3]=u*x,e[4]=(h*t-i*l)*x,e[5]=(i*r-o*t)*x,e[6]=f*x,e[7]=(n*l-c*t)*x,e[8]=(a*t-n*r)*x,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-i*c,i*l,-i*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(Ir.makeScale(e,t)),this}rotate(e){return this.premultiply(Ir.makeRotation(-e)),this}translate(e,t){return this.premultiply(Ir.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}};ko.prototype.isMatrix3=!0;let De=ko;const Ir=new De,ul=new De().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),dl=new De().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function hd(){const s={enabled:!0,workingColorSpace:Xt,spaces:{},convert:function(i,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===$e&&(i.r=Dn(i.r),i.g=Dn(i.g),i.b=Dn(i.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(i.applyMatrix3(this.spaces[r].toXYZ),i.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===$e&&(i.r=Ni(i.r),i.g=Ni(i.g),i.b=Ni(i.b))),i},workingToColorSpace:function(i,r){return this.convert(i,this.workingColorSpace,r)},colorSpaceToWorking:function(i,r){return this.convert(i,r,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Yn?ur:this.spaces[i].transfer},getToneMappingMode:function(i){return this.spaces[i].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(i,r=this.workingColorSpace){return i.fromArray(this.spaces[r].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,r,a){return i.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(i,r){return io("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),s.workingToColorSpace(i,r)},toWorkingColorSpace:function(i,r){return io("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),s.colorSpaceToWorking(i,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return s.define({[Xt]:{primaries:e,whitePoint:n,transfer:ur,toXYZ:ul,fromXYZ:dl,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Ct},outputColorSpaceConfig:{drawingBufferColorSpace:Ct}},[Ct]:{primaries:e,whitePoint:n,transfer:$e,toXYZ:ul,fromXYZ:dl,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Ct}}}),s}const He=hd();function Dn(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function Ni(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}let xi;class ud{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{xi===void 0&&(xi=Ss("canvas")),xi.width=e.width,xi.height=e.height;const i=xi.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height),n=xi}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Ss("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const i=n.getImageData(0,0,e.width,e.height),r=i.data;for(let a=0;a<r.length;a++)r[a]=Dn(r[a]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Dn(t[n]/255)*255):t[n]=Dn(t[n]);return{data:t,width:e.width,height:e.height}}else return Se("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let dd=0;class To{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:dd++}),this.uuid=sn(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?r.push(Nr(i[a].image)):r.push(Nr(i[a]))}else r=Nr(i);n.url=r}return t||(e.images[this.uuid]=n),n}}function Nr(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?ud.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(Se("Texture: Unable to serialize Texture."),{})}let fd=0;const Ur=new U;class Et extends fi{constructor(e=Et.DEFAULT_IMAGE,t=Et.DEFAULT_MAPPING,n=fn,i=fn,r=Tt,a=Cn,o=Zt,l=Wt,c=Et.DEFAULT_ANISOTROPY,h=Yn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:fd++}),this.uuid=sn(),this.name="",this.source=new To(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new qe(0,0),this.repeat=new qe(1,1),this.center=new qe(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new De,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Ur).x}get height(){return this.source.getSize(Ur).y}get depth(){return this.source.getSize(Ur).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){Se(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const i=this[t];if(i===void 0){Se(`Texture.setValues(): property '${t}' does not exist.`);continue}i&&n&&i.isVector2&&n.isVector2||i&&n&&i.isVector3&&n.isVector3||i&&n&&i.isMatrix3&&n.isMatrix3?i.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Gc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case ui:e.x=e.x-Math.floor(e.x);break;case fn:e.x=e.x<0?0:1;break;case lr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case ui:e.y=e.y-Math.floor(e.y);break;case fn:e.y=e.y<0?0:1;break;case lr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Et.DEFAULT_IMAGE=null;Et.DEFAULT_MAPPING=Gc;Et.DEFAULT_ANISOTROPY=1;const zo=class zo{constructor(e=0,t=0,n=0,i=1){this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,i=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*i+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*i+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*i+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*i+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,r;const l=e.elements,c=l[0],h=l[4],d=l[8],u=l[1],f=l[5],g=l[9],x=l[2],m=l[6],p=l[10];if(Math.abs(h-u)<.01&&Math.abs(d-x)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+u)<.1&&Math.abs(d+x)<.1&&Math.abs(g+m)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const S=(c+1)/2,b=(f+1)/2,A=(p+1)/2,T=(h+u)/4,R=(d+x)/4,M=(g+m)/4;return S>b&&S>A?S<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(S),i=T/n,r=R/n):b>A?b<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(b),n=T/i,r=M/i):A<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(A),n=R/r,i=M/r),this.set(n,i,r,t),this}let v=Math.sqrt((m-g)*(m-g)+(d-x)*(d-x)+(u-h)*(u-h));return Math.abs(v)<.001&&(v=1),this.x=(m-g)/v,this.y=(d-x)/v,this.z=(u-h)/v,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this.w=Ge(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this.w=Ge(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};zo.prototype.isVector4=!0;let st=zo;class pd extends fi{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Tt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new st(0,0,e,t),this.scissorTest=!1,this.viewport=new st(0,0,e,t),this.textures=[];const i={width:e,height:t,depth:n.depth},r=new Et(i),a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(e={}){const t={minFilter:Tt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n,this.textures[i].isData3DTexture!==!0&&(this.textures[i].isArrayTexture=this.textures[i].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const i=Object.assign({},e.textures[t].image);this.textures[t].source=new To(i)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this}dispose(){this.dispatchEvent({type:"dispose"})}}class rn extends pd{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class Qc extends Et{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=bt,this.minFilter=bt,this.wrapR=fn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class md extends Et{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=bt,this.minFilter=bt,this.wrapR=fn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const gr=class gr{constructor(e,t,n,i,r,a,o,l,c,h,d,u,f,g,x,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,a,o,l,c,h,d,u,f,g,x,m)}set(e,t,n,i,r,a,o,l,c,h,d,u,f,g,x,m){const p=this.elements;return p[0]=e,p[4]=t,p[8]=n,p[12]=i,p[1]=r,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=h,p[10]=d,p[14]=u,p[3]=f,p[7]=g,p[11]=x,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new gr().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinant()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinant()===0)return this.identity();const t=this.elements,n=e.elements,i=1/_i.setFromMatrixColumn(e,0).length(),r=1/_i.setFromMatrixColumn(e,1).length(),a=1/_i.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,i=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(r),d=Math.sin(r);if(e.order==="XYZ"){const u=a*h,f=a*d,g=o*h,x=o*d;t[0]=l*h,t[4]=-l*d,t[8]=c,t[1]=f+g*c,t[5]=u-x*c,t[9]=-o*l,t[2]=x-u*c,t[6]=g+f*c,t[10]=a*l}else if(e.order==="YXZ"){const u=l*h,f=l*d,g=c*h,x=c*d;t[0]=u+x*o,t[4]=g*o-f,t[8]=a*c,t[1]=a*d,t[5]=a*h,t[9]=-o,t[2]=f*o-g,t[6]=x+u*o,t[10]=a*l}else if(e.order==="ZXY"){const u=l*h,f=l*d,g=c*h,x=c*d;t[0]=u-x*o,t[4]=-a*d,t[8]=g+f*o,t[1]=f+g*o,t[5]=a*h,t[9]=x-u*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const u=a*h,f=a*d,g=o*h,x=o*d;t[0]=l*h,t[4]=g*c-f,t[8]=u*c+x,t[1]=l*d,t[5]=x*c+u,t[9]=f*c-g,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const u=a*l,f=a*c,g=o*l,x=o*c;t[0]=l*h,t[4]=x-u*d,t[8]=g*d+f,t[1]=d,t[5]=a*h,t[9]=-o*h,t[2]=-c*h,t[6]=f*d+g,t[10]=u-x*d}else if(e.order==="XZY"){const u=a*l,f=a*c,g=o*l,x=o*c;t[0]=l*h,t[4]=-d,t[8]=c*h,t[1]=u*d+x,t[5]=a*h,t[9]=f*d-g,t[2]=g*d-f,t[6]=o*h,t[10]=x*d+u}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(gd,e,xd)}lookAt(e,t,n){const i=this.elements;return Ht.subVectors(e,t),Ht.lengthSq()===0&&(Ht.z=1),Ht.normalize(),zn.crossVectors(n,Ht),zn.lengthSq()===0&&(Math.abs(n.z)===1?Ht.x+=1e-4:Ht.z+=1e-4,Ht.normalize(),zn.crossVectors(n,Ht)),zn.normalize(),As.crossVectors(Ht,zn),i[0]=zn.x,i[4]=As.x,i[8]=Ht.x,i[1]=zn.y,i[5]=As.y,i[9]=Ht.y,i[2]=zn.z,i[6]=As.z,i[10]=Ht.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,i=t.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],d=n[5],u=n[9],f=n[13],g=n[2],x=n[6],m=n[10],p=n[14],v=n[3],S=n[7],b=n[11],A=n[15],T=i[0],R=i[4],M=i[8],w=i[12],P=i[1],C=i[5],F=i[9],G=i[13],W=i[2],N=i[6],B=i[10],V=i[14],Q=i[3],ee=i[7],he=i[11],ve=i[15];return r[0]=a*T+o*P+l*W+c*Q,r[4]=a*R+o*C+l*N+c*ee,r[8]=a*M+o*F+l*B+c*he,r[12]=a*w+o*G+l*V+c*ve,r[1]=h*T+d*P+u*W+f*Q,r[5]=h*R+d*C+u*N+f*ee,r[9]=h*M+d*F+u*B+f*he,r[13]=h*w+d*G+u*V+f*ve,r[2]=g*T+x*P+m*W+p*Q,r[6]=g*R+x*C+m*N+p*ee,r[10]=g*M+x*F+m*B+p*he,r[14]=g*w+x*G+m*V+p*ve,r[3]=v*T+S*P+b*W+A*Q,r[7]=v*R+S*C+b*N+A*ee,r[11]=v*M+S*F+b*B+A*he,r[15]=v*w+S*G+b*V+A*ve,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],i=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],h=e[2],d=e[6],u=e[10],f=e[14],g=e[3],x=e[7],m=e[11],p=e[15],v=l*f-c*u,S=o*f-c*d,b=o*u-l*d,A=a*f-c*h,T=a*u-l*h,R=a*d-o*h;return t*(x*v-m*S+p*b)-n*(g*v-m*A+p*T)+i*(g*S-x*A+p*R)-r*(g*b-x*T+m*R)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],h=e[8],d=e[9],u=e[10],f=e[11],g=e[12],x=e[13],m=e[14],p=e[15],v=t*o-n*a,S=t*l-i*a,b=t*c-r*a,A=n*l-i*o,T=n*c-r*o,R=i*c-r*l,M=h*x-d*g,w=h*m-u*g,P=h*p-f*g,C=d*m-u*x,F=d*p-f*x,G=u*p-f*m,W=v*G-S*F+b*C+A*P-T*w+R*M;if(W===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const N=1/W;return e[0]=(o*G-l*F+c*C)*N,e[1]=(i*F-n*G-r*C)*N,e[2]=(x*R-m*T+p*A)*N,e[3]=(u*T-d*R-f*A)*N,e[4]=(l*P-a*G-c*w)*N,e[5]=(t*G-i*P+r*w)*N,e[6]=(m*b-g*R-p*S)*N,e[7]=(h*R-u*b+f*S)*N,e[8]=(a*F-o*P+c*M)*N,e[9]=(n*P-t*F-r*M)*N,e[10]=(g*T-x*b+p*v)*N,e[11]=(d*b-h*T-f*v)*N,e[12]=(o*w-a*C-l*M)*N,e[13]=(t*C-n*w+i*M)*N,e[14]=(x*S-g*A-m*v)*N,e[15]=(h*A-d*S+u*v)*N,this}scale(e){const t=this.elements,n=e.x,i=e.y,r=e.z;return t[0]*=n,t[4]*=i,t[8]*=r,t[1]*=n,t[5]*=i,t[9]*=r,t[2]*=n,t[6]*=i,t[10]*=r,t[3]*=n,t[7]*=i,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),i=Math.sin(t),r=1-n,a=e.x,o=e.y,l=e.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-i*l,c*l+i*o,0,c*o+i*l,h*o+n,h*l-i*a,0,c*l-i*o,h*l+i*a,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,r,a){return this.set(1,n,r,0,e,1,a,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){const i=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,h=a+a,d=o+o,u=r*c,f=r*h,g=r*d,x=a*h,m=a*d,p=o*d,v=l*c,S=l*h,b=l*d,A=n.x,T=n.y,R=n.z;return i[0]=(1-(x+p))*A,i[1]=(f+b)*A,i[2]=(g-S)*A,i[3]=0,i[4]=(f-b)*T,i[5]=(1-(u+p))*T,i[6]=(m+v)*T,i[7]=0,i[8]=(g+S)*R,i[9]=(m-v)*R,i[10]=(1-(u+x))*R,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){const i=this.elements;e.x=i[12],e.y=i[13],e.z=i[14];const r=this.determinant();if(r===0)return n.set(1,1,1),t.identity(),this;let a=_i.set(i[0],i[1],i[2]).length();const o=_i.set(i[4],i[5],i[6]).length(),l=_i.set(i[8],i[9],i[10]).length();r<0&&(a=-a),$t.copy(this);const c=1/a,h=1/o,d=1/l;return $t.elements[0]*=c,$t.elements[1]*=c,$t.elements[2]*=c,$t.elements[4]*=h,$t.elements[5]*=h,$t.elements[6]*=h,$t.elements[8]*=d,$t.elements[9]*=d,$t.elements[10]*=d,t.setFromRotationMatrix($t),n.x=a,n.y=o,n.z=l,this}makePerspective(e,t,n,i,r,a,o=pn,l=!1){const c=this.elements,h=2*r/(t-e),d=2*r/(n-i),u=(t+e)/(t-e),f=(n+i)/(n-i);let g,x;if(l)g=r/(a-r),x=a*r/(a-r);else if(o===pn)g=-(a+r)/(a-r),x=-2*a*r/(a-r);else if(o===Ms)g=-a/(a-r),x=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=d,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=x,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,i,r,a,o=pn,l=!1){const c=this.elements,h=2/(t-e),d=2/(n-i),u=-(t+e)/(t-e),f=-(n+i)/(n-i);let g,x;if(l)g=1/(a-r),x=a/(a-r);else if(o===pn)g=-2/(a-r),x=-(a+r)/(a-r);else if(o===Ms)g=-1/(a-r),x=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=d,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=g,c[14]=x,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}};gr.prototype.isMatrix4=!0;let ke=gr;const _i=new U,$t=new ke,gd=new U(0,0,0),xd=new U(1,1,1),zn=new U,As=new U,Ht=new U,fl=new ke,pl=new Fn;class $n{constructor(e=0,t=0,n=0,i=$n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const i=e.elements,r=i[0],a=i[4],o=i[8],l=i[1],c=i[5],h=i[9],d=i[2],u=i[6],f=i[10];switch(t){case"XYZ":this._y=Math.asin(Ge(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ge(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,r),this._z=0);break;case"ZXY":this._x=Math.asin(Ge(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Ge(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Ge(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-d,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-Ge(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:Se("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return fl.makeRotationFromQuaternion(e),this.setFromRotationMatrix(fl,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return pl.setFromEuler(this),this.setFromQuaternion(pl,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}$n.DEFAULT_ORDER="XYZ";class eh{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let _d=0;const ml=new U,vi=new Fn,bn=new ke,Rs=new U,Ji=new U,vd=new U,Md=new Fn,gl=new U(1,0,0),xl=new U(0,1,0),_l=new U(0,0,1),vl={type:"added"},Sd={type:"removed"},Mi={type:"childadded",child:null},Fr={type:"childremoved",child:null};class ht extends fi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:_d++}),this.uuid=sn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=ht.DEFAULT_UP.clone();const e=new U,t=new $n,n=new Fn,i=new U(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new ke},normalMatrix:{value:new De}}),this.matrix=new ke,this.matrixWorld=new ke,this.matrixAutoUpdate=ht.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=ht.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new eh,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return vi.setFromAxisAngle(e,t),this.quaternion.multiply(vi),this}rotateOnWorldAxis(e,t){return vi.setFromAxisAngle(e,t),this.quaternion.premultiply(vi),this}rotateX(e){return this.rotateOnAxis(gl,e)}rotateY(e){return this.rotateOnAxis(xl,e)}rotateZ(e){return this.rotateOnAxis(_l,e)}translateOnAxis(e,t){return ml.copy(e).applyQuaternion(this.quaternion),this.position.add(ml.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(gl,e)}translateY(e){return this.translateOnAxis(xl,e)}translateZ(e){return this.translateOnAxis(_l,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(bn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Rs.copy(e):Rs.set(e,t,n);const i=this.parent;this.updateWorldMatrix(!0,!1),Ji.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?bn.lookAt(Ji,Rs,this.up):bn.lookAt(Rs,Ji,this.up),this.quaternion.setFromRotationMatrix(bn),i&&(bn.extractRotation(i.matrixWorld),vi.setFromRotationMatrix(bn),this.quaternion.premultiply(vi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ae("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(vl),Mi.child=e,this.dispatchEvent(Mi),Mi.child=null):Ae("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Sd),Fr.child=e,this.dispatchEvent(Fr),Fr.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),bn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),bn.multiply(e.parent.matrixWorld)),e.applyMatrix4(bn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(vl),Mi.child=e,this.dispatchEvent(Mi),Mi.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const i=this.children;for(let r=0,a=i.length;r<a;r++)i[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ji,e,vd),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ji,Md,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;if(e!==null){const t=e.x,n=e.y,i=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*i,r[13]+=n-r[1]*t-r[5]*n-r[9]*i,r[14]+=i-r[2]*t-r[6]*n-r[10]*i}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const i=this.children;for(let r=0,a=i.length;r<a;r++)i[r].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),this.static!==!1&&(i.static=this.static),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.pivot!==null&&(i.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(i.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(i.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map(o=>({...o})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(e),i.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(i.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(i.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const d=l[c];r(e.shapes,d)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));i.material=o}else i.material=r(e.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];i.animations.push(r(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),h=a(e.images),d=a(e.shapes),u=a(e.skeletons),f=a(e.animations),g=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),u.length>0&&(n.skeletons=u),f.length>0&&(n.animations=f),g.length>0&&(n.nodes=g)}return n.object=i,n;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const i=e.children[n];this.add(i.clone())}return this}}ht.DEFAULT_UP=new U(0,1,0);ht.DEFAULT_MATRIX_AUTO_UPDATE=!0;ht.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class jn extends ht{constructor(){super(),this.isGroup=!0,this.type="Group"}}const yd={type:"move"};class Or{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new jn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new jn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new U,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new U),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new jn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new U,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new U,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const x of e.hand.values()){const m=t.getJointPose(x,n),p=this._getHandJoint(c,x);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}const h=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],u=h.position.distanceTo(d.position),f=.02,g=.005;c.inputState.pinching&&u>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&u<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(i=t.getPose(e.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(yd)))}return o!==null&&(o.visible=i!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new jn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}const th={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Vn={h:0,s:0,l:0},Cs={h:0,s:0,l:0};function Br(s,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?s+(e-s)*6*t:t<1/2?e:t<2/3?s+(e-s)*6*(2/3-t):s}class Ce{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const i=e;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Ct){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,He.colorSpaceToWorking(this,t),this}setRGB(e,t,n,i=He.workingColorSpace){return this.r=e,this.g=t,this.b=n,He.colorSpaceToWorking(this,i),this}setHSL(e,t,n,i=He.workingColorSpace){if(e=bo(e,1),t=Ge(t,0,1),n=Ge(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=Br(a,r,e+1/3),this.g=Br(a,r,e),this.b=Br(a,r,e-1/3)}return He.colorSpaceToWorking(this,i),this}setStyle(e,t=Ct){function n(r){r!==void 0&&parseFloat(r)<1&&Se("Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Se("Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=i[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);Se("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Ct){const n=th[e.toLowerCase()];return n!==void 0?this.setHex(n,t):Se("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Dn(e.r),this.g=Dn(e.g),this.b=Dn(e.b),this}copyLinearToSRGB(e){return this.r=Ni(e.r),this.g=Ni(e.g),this.b=Ni(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Ct){return He.workingToColorSpace(Dt.copy(this),e),Math.round(Ge(Dt.r*255,0,255))*65536+Math.round(Ge(Dt.g*255,0,255))*256+Math.round(Ge(Dt.b*255,0,255))}getHexString(e=Ct){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=He.workingColorSpace){He.workingToColorSpace(Dt.copy(this),t);const n=Dt.r,i=Dt.g,r=Dt.b,a=Math.max(n,i,r),o=Math.min(n,i,r);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const d=a-o;switch(c=h<=.5?d/(a+o):d/(2-a-o),a){case n:l=(i-r)/d+(i<r?6:0);break;case i:l=(r-n)/d+2;break;case r:l=(n-i)/d+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=He.workingColorSpace){return He.workingToColorSpace(Dt.copy(this),t),e.r=Dt.r,e.g=Dt.g,e.b=Dt.b,e}getStyle(e=Ct){He.workingToColorSpace(Dt.copy(this),e);const t=Dt.r,n=Dt.g,i=Dt.b;return e!==Ct?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(Vn),this.setHSL(Vn.h+e,Vn.s+t,Vn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Vn),e.getHSL(Cs);const n=ps(Vn.h,Cs.h,t),i=ps(Vn.s,Cs.s,t),r=ps(Vn.l,Cs.l,t);return this.setHSL(n,i,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,i=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*i,this.g=r[1]*t+r[4]*n+r[7]*i,this.b=r[2]*t+r[5]*n+r[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Dt=new Ce;Ce.NAMES=th;class Eo{constructor(e,t=1,n=1e3){this.isFog=!0,this.name="",this.color=new Ce(e),this.near=t,this.far=n}clone(){return new Eo(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class bd extends ht{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new $n,this.environmentIntensity=1,this.environmentRotation=new $n,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}const Jt=new U,Tn=new U,kr=new U,En=new U,Si=new U,yi=new U,Ml=new U,zr=new U,Vr=new U,Hr=new U,Gr=new st,Wr=new st,Xr=new st;class nn{constructor(e=new U,t=new U,n=new U){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),Jt.subVectors(e,t),i.cross(Jt);const r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(e,t,n,i,r){Jt.subVectors(i,t),Tn.subVectors(n,t),kr.subVectors(e,t);const a=Jt.dot(Jt),o=Jt.dot(Tn),l=Jt.dot(kr),c=Tn.dot(Tn),h=Tn.dot(kr),d=a*c-o*o;if(d===0)return r.set(0,0,0),null;const u=1/d,f=(c*l-o*h)*u,g=(a*h-o*l)*u;return r.set(1-f-g,g,f)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,En)===null?!1:En.x>=0&&En.y>=0&&En.x+En.y<=1}static getInterpolation(e,t,n,i,r,a,o,l){return this.getBarycoord(e,t,n,i,En)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,En.x),l.addScaledVector(a,En.y),l.addScaledVector(o,En.z),l)}static getInterpolatedAttribute(e,t,n,i,r,a){return Gr.setScalar(0),Wr.setScalar(0),Xr.setScalar(0),Gr.fromBufferAttribute(e,t),Wr.fromBufferAttribute(e,n),Xr.fromBufferAttribute(e,i),a.setScalar(0),a.addScaledVector(Gr,r.x),a.addScaledVector(Wr,r.y),a.addScaledVector(Xr,r.z),a}static isFrontFacing(e,t,n,i){return Jt.subVectors(n,t),Tn.subVectors(e,t),Jt.cross(Tn).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Jt.subVectors(this.c,this.b),Tn.subVectors(this.a,this.b),Jt.cross(Tn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return nn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return nn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,r){return nn.getInterpolation(e,this.a,this.b,this.c,t,n,i,r)}containsPoint(e){return nn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return nn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,i=this.b,r=this.c;let a,o;Si.subVectors(i,n),yi.subVectors(r,n),zr.subVectors(e,n);const l=Si.dot(zr),c=yi.dot(zr);if(l<=0&&c<=0)return t.copy(n);Vr.subVectors(e,i);const h=Si.dot(Vr),d=yi.dot(Vr);if(h>=0&&d<=h)return t.copy(i);const u=l*d-h*c;if(u<=0&&l>=0&&h<=0)return a=l/(l-h),t.copy(n).addScaledVector(Si,a);Hr.subVectors(e,r);const f=Si.dot(Hr),g=yi.dot(Hr);if(g>=0&&f<=g)return t.copy(r);const x=f*c-l*g;if(x<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(n).addScaledVector(yi,o);const m=h*g-f*d;if(m<=0&&d-h>=0&&f-g>=0)return Ml.subVectors(r,i),o=(d-h)/(d-h+(f-g)),t.copy(i).addScaledVector(Ml,o);const p=1/(m+x+u);return a=x*p,o=u*p,t.copy(n).addScaledVector(Si,a).addScaledVector(yi,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class vn{constructor(e=new U(1/0,1/0,1/0),t=new U(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Qt.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Qt.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=Qt.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,Qt):Qt.fromBufferAttribute(r,a),Qt.applyMatrix4(e.matrixWorld),this.expandByPoint(Qt);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Ls.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Ls.copy(n.boundingBox)),Ls.applyMatrix4(e.matrixWorld),this.union(Ls)}const i=e.children;for(let r=0,a=i.length;r<a;r++)this.expandByObject(i[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Qt),Qt.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Qi),Ps.subVectors(this.max,Qi),bi.subVectors(e.a,Qi),Ti.subVectors(e.b,Qi),Ei.subVectors(e.c,Qi),Hn.subVectors(Ti,bi),Gn.subVectors(Ei,Ti),Qn.subVectors(bi,Ei);let t=[0,-Hn.z,Hn.y,0,-Gn.z,Gn.y,0,-Qn.z,Qn.y,Hn.z,0,-Hn.x,Gn.z,0,-Gn.x,Qn.z,0,-Qn.x,-Hn.y,Hn.x,0,-Gn.y,Gn.x,0,-Qn.y,Qn.x,0];return!qr(t,bi,Ti,Ei,Ps)||(t=[1,0,0,0,1,0,0,0,1],!qr(t,bi,Ti,Ei,Ps))?!1:(Ds.crossVectors(Hn,Gn),t=[Ds.x,Ds.y,Ds.z],qr(t,bi,Ti,Ei,Ps))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Qt).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Qt).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(wn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),wn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),wn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),wn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),wn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),wn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),wn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),wn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(wn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const wn=[new U,new U,new U,new U,new U,new U,new U,new U],Qt=new U,Ls=new vn,bi=new U,Ti=new U,Ei=new U,Hn=new U,Gn=new U,Qn=new U,Qi=new U,Ps=new U,Ds=new U,ei=new U;function qr(s,e,t,n,i){for(let r=0,a=s.length-3;r<=a;r+=3){ei.fromArray(s,r);const o=i.x*Math.abs(ei.x)+i.y*Math.abs(ei.y)+i.z*Math.abs(ei.z),l=e.dot(ei),c=t.dot(ei),h=n.dot(ei);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const vt=new U,Is=new qe;let Td=0;class Ft extends fi{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Td++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=no,this.updateRanges=[],this.gpuType=Kt,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Is.fromBufferAttribute(this,t),Is.applyMatrix3(e),this.setXY(t,Is.x,Is.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)vt.fromBufferAttribute(this,t),vt.applyMatrix3(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)vt.fromBufferAttribute(this,t),vt.applyMatrix4(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)vt.fromBufferAttribute(this,t),vt.applyNormalMatrix(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)vt.fromBufferAttribute(this,t),vt.transformDirection(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=tn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Je(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=tn(t,this.array)),t}setX(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=tn(t,this.array)),t}setY(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=tn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=tn(t,this.array)),t}setW(e,t){return this.normalized&&(t=Je(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),i=Je(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e*=this.itemSize,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),i=Je(i,this.array),r=Je(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==no&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}}class nh extends Ft{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class ih extends Ft{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class Mt extends Ft{constructor(e,t,n){super(new Float32Array(e),t,n)}}const Ed=new vn,es=new U,Yr=new U;class Mn{constructor(e=new U,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Ed.setFromPoints(e).getCenter(n);let i=0;for(let r=0,a=e.length;r<a;r++)i=Math.max(i,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;es.subVectors(e,this.center);const t=es.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.addScaledVector(es,i/n),this.radius+=i}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Yr.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(es.copy(e.center).add(Yr)),this.expandByPoint(es.copy(e.center).sub(Yr))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}let wd=0;const Yt=new ke,jr=new ht,wi=new U,Gt=new vn,ts=new vn,Rt=new U;class Ot extends fi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:wd++}),this.uuid=sn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Hu(e)?ih:nh)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new De().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Yt.makeRotationFromQuaternion(e),this.applyMatrix4(Yt),this}rotateX(e){return Yt.makeRotationX(e),this.applyMatrix4(Yt),this}rotateY(e){return Yt.makeRotationY(e),this.applyMatrix4(Yt),this}rotateZ(e){return Yt.makeRotationZ(e),this.applyMatrix4(Yt),this}translate(e,t,n){return Yt.makeTranslation(e,t,n),this.applyMatrix4(Yt),this}scale(e,t,n){return Yt.makeScale(e,t,n),this.applyMatrix4(Yt),this}lookAt(e){return jr.lookAt(e),jr.updateMatrix(),this.applyMatrix4(jr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(wi).negate(),this.translate(wi.x,wi.y,wi.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let i=0,r=e.length;i<r;i++){const a=e[i];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new Mt(n,3))}else{const n=Math.min(e.length,t.count);for(let i=0;i<n;i++){const r=e[i];t.setXYZ(i,r.x,r.y,r.z||0)}e.length>t.count&&Se("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new vn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ae("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new U(-1/0,-1/0,-1/0),new U(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){const r=t[n];Gt.setFromBufferAttribute(r),this.morphTargetsRelative?(Rt.addVectors(this.boundingBox.min,Gt.min),this.boundingBox.expandByPoint(Rt),Rt.addVectors(this.boundingBox.max,Gt.max),this.boundingBox.expandByPoint(Rt)):(this.boundingBox.expandByPoint(Gt.min),this.boundingBox.expandByPoint(Gt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ae('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Mn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ae("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new U,1/0);return}if(e){const n=this.boundingSphere.center;if(Gt.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];ts.setFromBufferAttribute(o),this.morphTargetsRelative?(Rt.addVectors(Gt.min,ts.min),Gt.expandByPoint(Rt),Rt.addVectors(Gt.max,ts.max),Gt.expandByPoint(Rt)):(Gt.expandByPoint(ts.min),Gt.expandByPoint(ts.max))}Gt.getCenter(n);let i=0;for(let r=0,a=e.count;r<a;r++)Rt.fromBufferAttribute(e,r),i=Math.max(i,n.distanceToSquared(Rt));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Rt.fromBufferAttribute(o,c),l&&(wi.fromBufferAttribute(e,c),Rt.add(wi)),i=Math.max(i,n.distanceToSquared(Rt))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&Ae('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ae("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,i=t.normal,r=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Ft(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let M=0;M<n.count;M++)o[M]=new U,l[M]=new U;const c=new U,h=new U,d=new U,u=new qe,f=new qe,g=new qe,x=new U,m=new U;function p(M,w,P){c.fromBufferAttribute(n,M),h.fromBufferAttribute(n,w),d.fromBufferAttribute(n,P),u.fromBufferAttribute(r,M),f.fromBufferAttribute(r,w),g.fromBufferAttribute(r,P),h.sub(c),d.sub(c),f.sub(u),g.sub(u);const C=1/(f.x*g.y-g.x*f.y);isFinite(C)&&(x.copy(h).multiplyScalar(g.y).addScaledVector(d,-f.y).multiplyScalar(C),m.copy(d).multiplyScalar(f.x).addScaledVector(h,-g.x).multiplyScalar(C),o[M].add(x),o[w].add(x),o[P].add(x),l[M].add(m),l[w].add(m),l[P].add(m))}let v=this.groups;v.length===0&&(v=[{start:0,count:e.count}]);for(let M=0,w=v.length;M<w;++M){const P=v[M],C=P.start,F=P.count;for(let G=C,W=C+F;G<W;G+=3)p(e.getX(G+0),e.getX(G+1),e.getX(G+2))}const S=new U,b=new U,A=new U,T=new U;function R(M){A.fromBufferAttribute(i,M),T.copy(A);const w=o[M];S.copy(w),S.sub(A.multiplyScalar(A.dot(w))).normalize(),b.crossVectors(T,w);const C=b.dot(l[M])<0?-1:1;a.setXYZW(M,S.x,S.y,S.z,C)}for(let M=0,w=v.length;M<w;++M){const P=v[M],C=P.start,F=P.count;for(let G=C,W=C+F;G<W;G+=3)R(e.getX(G+0)),R(e.getX(G+1)),R(e.getX(G+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Ft(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let u=0,f=n.count;u<f;u++)n.setXYZ(u,0,0,0);const i=new U,r=new U,a=new U,o=new U,l=new U,c=new U,h=new U,d=new U;if(e)for(let u=0,f=e.count;u<f;u+=3){const g=e.getX(u+0),x=e.getX(u+1),m=e.getX(u+2);i.fromBufferAttribute(t,g),r.fromBufferAttribute(t,x),a.fromBufferAttribute(t,m),h.subVectors(a,r),d.subVectors(i,r),h.cross(d),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,m),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let u=0,f=t.count;u<f;u+=3)i.fromBufferAttribute(t,u+0),r.fromBufferAttribute(t,u+1),a.fromBufferAttribute(t,u+2),h.subVectors(a,r),d.subVectors(i,r),h.cross(d),n.setXYZ(u+0,h.x,h.y,h.z),n.setXYZ(u+1,h.x,h.y,h.z),n.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Rt.fromBufferAttribute(e,t),Rt.normalize(),e.setXYZ(t,Rt.x,Rt.y,Rt.z)}toNonIndexed(){function e(o,l){const c=o.array,h=o.itemSize,d=o.normalized,u=new c.constructor(l.length*h);let f=0,g=0;for(let x=0,m=l.length;x<m;x++){o.isInterleavedBufferAttribute?f=l[x]*o.data.stride+o.offset:f=l[x]*h;for(let p=0;p<h;p++)u[g++]=c[f++]}return new Ft(u,h,d)}if(this.index===null)return Se("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Ot,n=this.index.array,i=this.attributes;for(const o in i){const l=i[o],c=e(l,n);t.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let h=0,d=c.length;h<d;h++){const u=c[h],f=e(u,n);l.push(f)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const i={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let d=0,u=c.length;d<u;d++){const f=c[d];h.push(f.toJSON(e.data))}h.length>0&&(i[l]=h,r=!0)}r&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const i=e.attributes;for(const c in i){const h=i[c];this.setAttribute(c,h.clone(t))}const r=e.morphAttributes;for(const c in r){const h=[],d=r[c];for(let u=0,f=d.length;u<f;u++)h.push(d[u].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,h=a.length;c<h;c++){const d=a[c];this.addGroup(d.start,d.count,d.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Ad{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=no,this.updateRanges=[],this.version=0,this.uuid=sn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,r=this.stride;i<r;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=sn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=sn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const It=new U;class wo{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)It.fromBufferAttribute(this,t),It.applyMatrix4(e),this.setXYZ(t,It.x,It.y,It.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)It.fromBufferAttribute(this,t),It.applyNormalMatrix(e),this.setXYZ(t,It.x,It.y,It.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)It.fromBufferAttribute(this,t),It.transformDirection(e),this.setXYZ(t,It.x,It.y,It.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=tn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Je(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=Je(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=tn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=tn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=tn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=tn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),i=Je(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=Je(t,this.array),n=Je(n,this.array),i=Je(i,this.array),r=Je(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=r,this}clone(e){if(e===void 0){dr("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return new Ft(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new wo(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){dr("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}let Rd=0;class gn extends fi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Rd++}),this.uuid=sn(),this.name="",this.type="Material",this.blending=Ii,this.side=In,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=ma,this.blendDst=ga,this.blendEquation=oi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ce(0,0,0),this.blendAlpha=0,this.depthFunc=Oi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=al,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=gi,this.stencilZFail=gi,this.stencilZPass=gi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){Se(`Material: parameter '${t}' has value of undefined.`);continue}const i=this[t];if(i===void 0){Se(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Ii&&(n.blending=this.blending),this.side!==In&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==ma&&(n.blendSrc=this.blendSrc),this.blendDst!==ga&&(n.blendDst=this.blendDst),this.blendEquation!==oi&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Oi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==al&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==gi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==gi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==gi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(t){const r=i(e.textures),a=i(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const i=t.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}const An=new U,Kr=new U,Ns=new U,Wn=new U,Zr=new U,Us=new U,$r=new U;class _r{constructor(e=new U,t=new U(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,An)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=An.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(An.copy(this.origin).addScaledVector(this.direction,t),An.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){Kr.copy(e).add(t).multiplyScalar(.5),Ns.copy(t).sub(e).normalize(),Wn.copy(this.origin).sub(Kr);const r=e.distanceTo(t)*.5,a=-this.direction.dot(Ns),o=Wn.dot(this.direction),l=-Wn.dot(Ns),c=Wn.lengthSq(),h=Math.abs(1-a*a);let d,u,f,g;if(h>0)if(d=a*l-o,u=a*o-l,g=r*h,d>=0)if(u>=-g)if(u<=g){const x=1/h;d*=x,u*=x,f=d*(d+a*u+2*o)+u*(a*d+u+2*l)+c}else u=r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;else u=-r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;else u<=-g?(d=Math.max(0,-(-a*r+o)),u=d>0?-r:Math.min(Math.max(-r,-l),r),f=-d*d+u*(u+2*l)+c):u<=g?(d=0,u=Math.min(Math.max(-r,-l),r),f=u*(u+2*l)+c):(d=Math.max(0,-(a*r+o)),u=d>0?r:Math.min(Math.max(-r,-l),r),f=-d*d+u*(u+2*l)+c);else u=a>0?-r:r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,d),i&&i.copy(Kr).addScaledVector(Ns,u),f}intersectSphere(e,t){An.subVectors(e.center,this.origin);const n=An.dot(this.direction),i=An.dot(An)-n*n,r=e.radius*e.radius;if(i>r)return null;const a=Math.sqrt(r-i),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,r,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,u=this.origin;return c>=0?(n=(e.min.x-u.x)*c,i=(e.max.x-u.x)*c):(n=(e.max.x-u.x)*c,i=(e.min.x-u.x)*c),h>=0?(r=(e.min.y-u.y)*h,a=(e.max.y-u.y)*h):(r=(e.max.y-u.y)*h,a=(e.min.y-u.y)*h),n>a||r>i||((r>n||isNaN(n))&&(n=r),(a<i||isNaN(i))&&(i=a),d>=0?(o=(e.min.z-u.z)*d,l=(e.max.z-u.z)*d):(o=(e.max.z-u.z)*d,l=(e.min.z-u.z)*d),n>l||o>i)||((o>n||n!==n)&&(n=o),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,An)!==null}intersectTriangle(e,t,n,i,r){Zr.subVectors(t,e),Us.subVectors(n,e),$r.crossVectors(Zr,Us);let a=this.direction.dot($r),o;if(a>0){if(i)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Wn.subVectors(this.origin,e);const l=o*this.direction.dot(Us.crossVectors(Wn,Us));if(l<0)return null;const c=o*this.direction.dot(Zr.cross(Wn));if(c<0||l+c>a)return null;const h=-o*Wn.dot($r);return h<0?null:this.at(h/a,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Kn extends gn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ce(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new $n,this.combine=Uc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Sl=new ke,ti=new _r,Fs=new Mn,yl=new U,Os=new U,Bs=new U,ks=new U,Jr=new U,zs=new U,bl=new U,Vs=new U;class kt extends ht{constructor(e=new Ot,t=new Kn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(i,e);const o=this.morphTargetInfluences;if(r&&o){zs.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=o[l],d=r[l];h!==0&&(Jr.fromBufferAttribute(d,e),a?zs.addScaledVector(Jr,h):zs.addScaledVector(Jr.sub(t),h))}t.add(zs)}return t}raycast(e,t){const n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Fs.copy(n.boundingSphere),Fs.applyMatrix4(r),ti.copy(e.ray).recast(e.near),!(Fs.containsPoint(ti.origin)===!1&&(ti.intersectSphere(Fs,yl)===null||ti.origin.distanceToSquared(yl)>(e.far-e.near)**2))&&(Sl.copy(r).invert(),ti.copy(e.ray).applyMatrix4(Sl),!(n.boundingBox!==null&&ti.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,ti)))}_computeIntersections(e,t,n){let i;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,d=r.attributes.normal,u=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,x=u.length;g<x;g++){const m=u[g],p=a[m.materialIndex],v=Math.max(m.start,f.start),S=Math.min(o.count,Math.min(m.start+m.count,f.start+f.count));for(let b=v,A=S;b<A;b+=3){const T=o.getX(b),R=o.getX(b+1),M=o.getX(b+2);i=Hs(this,p,e,n,c,h,d,T,R,M),i&&(i.faceIndex=Math.floor(b/3),i.face.materialIndex=m.materialIndex,t.push(i))}}else{const g=Math.max(0,f.start),x=Math.min(o.count,f.start+f.count);for(let m=g,p=x;m<p;m+=3){const v=o.getX(m),S=o.getX(m+1),b=o.getX(m+2);i=Hs(this,a,e,n,c,h,d,v,S,b),i&&(i.faceIndex=Math.floor(m/3),t.push(i))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,x=u.length;g<x;g++){const m=u[g],p=a[m.materialIndex],v=Math.max(m.start,f.start),S=Math.min(l.count,Math.min(m.start+m.count,f.start+f.count));for(let b=v,A=S;b<A;b+=3){const T=b,R=b+1,M=b+2;i=Hs(this,p,e,n,c,h,d,T,R,M),i&&(i.faceIndex=Math.floor(b/3),i.face.materialIndex=m.materialIndex,t.push(i))}}else{const g=Math.max(0,f.start),x=Math.min(l.count,f.start+f.count);for(let m=g,p=x;m<p;m+=3){const v=m,S=m+1,b=m+2;i=Hs(this,a,e,n,c,h,d,v,S,b),i&&(i.faceIndex=Math.floor(m/3),t.push(i))}}}}function Cd(s,e,t,n,i,r,a,o){let l;if(e.side===Bt?l=n.intersectTriangle(a,r,i,!0,o):l=n.intersectTriangle(i,r,a,e.side===In,o),l===null)return null;Vs.copy(o),Vs.applyMatrix4(s.matrixWorld);const c=t.ray.origin.distanceTo(Vs);return c<t.near||c>t.far?null:{distance:c,point:Vs.clone(),object:s}}function Hs(s,e,t,n,i,r,a,o,l,c){s.getVertexPosition(o,Os),s.getVertexPosition(l,Bs),s.getVertexPosition(c,ks);const h=Cd(s,e,t,n,Os,Bs,ks,bl);if(h){const d=new U;nn.getBarycoord(bl,Os,Bs,ks,d),i&&(h.uv=nn.getInterpolatedAttribute(i,o,l,c,d,new qe)),r&&(h.uv1=nn.getInterpolatedAttribute(r,o,l,c,d,new qe)),a&&(h.normal=nn.getInterpolatedAttribute(a,o,l,c,d,new U),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const u={a:o,b:l,c,normal:new U,materialIndex:0};nn.getNormal(Os,Bs,ks,u.normal),h.face=u,h.barycoord=d}return h}const ns=new st,Tl=new st,El=new st,Ld=new st,wl=new ke,Gs=new U,Qr=new Mn,Al=new ke,ea=new _r;class Pd extends kt{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=tl,this.bindMatrix=new ke,this.bindMatrixInverse=new ke,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const e=this.geometry;this.boundingBox===null&&(this.boundingBox=new vn),this.boundingBox.makeEmpty();const t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,Gs),this.boundingBox.expandByPoint(Gs)}computeBoundingSphere(){const e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new Mn),this.boundingSphere.makeEmpty();const t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,Gs),this.boundingSphere.expandByPoint(Gs)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){const n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Qr.copy(this.boundingSphere),Qr.applyMatrix4(i),e.ray.intersectsSphere(Qr)!==!1&&(Al.copy(i).invert(),ea.copy(e.ray).applyMatrix4(Al),!(this.boundingBox!==null&&ea.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,ea)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const e=new st,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.fromBufferAttribute(t,n);const r=1/e.manhattanLength();r!==1/0?e.multiplyScalar(r):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===tl?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===Pu?this.bindMatrixInverse.copy(this.bindMatrix).invert():Se("SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){const n=this.skeleton,i=this.geometry;Tl.fromBufferAttribute(i.attributes.skinIndex,e),El.fromBufferAttribute(i.attributes.skinWeight,e),t.isVector4?(ns.copy(t),t.set(0,0,0,0)):(ns.set(...t,1),t.set(0,0,0)),ns.applyMatrix4(this.bindMatrix);for(let r=0;r<4;r++){const a=El.getComponent(r);if(a!==0){const o=Tl.getComponent(r);wl.multiplyMatrices(n.bones[o].matrixWorld,n.boneInverses[o]),t.addScaledVector(Ld.copy(ns).applyMatrix4(wl),a)}}return t.isVector4&&(t.w=ns.w),t.applyMatrix4(this.bindMatrixInverse)}}class sh extends ht{constructor(){super(),this.isBone=!0,this.type="Bone"}}class Ao extends Et{constructor(e=null,t=1,n=1,i,r,a,o,l,c=bt,h=bt,d,u){super(null,a,o,l,c,h,i,r,d,u),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const Rl=new ke,Dd=new ke;class Ro{constructor(e=[],t=[]){this.uuid=sn(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.previousBoneMatrices=null,this.boneTexture=null,this.init()}init(){const e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){Se("Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,i=this.bones.length;n<i;n++)this.boneInverses.push(new ke)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){const n=new ke;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){const n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){const n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){const e=this.bones,t=this.boneInverses,n=this.boneMatrices,i=this.boneTexture;for(let r=0,a=e.length;r<a;r++){const o=e[r]?e[r].matrixWorld:Dd;Rl.multiplyMatrices(o,t[r]),Rl.toArray(n,r*16)}i!==null&&(i.needsUpdate=!0)}clone(){return new Ro(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);const t=new Float32Array(e*e*4);t.set(this.boneMatrices);const n=new Ao(t,e,e,Zt,Kt);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){const i=this.bones[t];if(i.name===e)return i}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,i=e.bones.length;n<i;n++){const r=e.bones[n];let a=t[r];a===void 0&&(Se("Skeleton: No bone found with UUID:",r),a=new sh),this.bones.push(a),this.boneInverses.push(new ke().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){const e={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;const t=this.bones,n=this.boneInverses;for(let i=0,r=t.length;i<r;i++){const a=t[i];e.bones.push(a.uuid);const o=n[i];e.boneInverses.push(o.toArray())}return e}}class so extends Ft{constructor(e,t,n,i=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const Ai=new ke,Cl=new ke,Ws=[],Ll=new vn,Id=new ke,is=new kt,ss=new Mn;class rh extends kt{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new so(new Float32Array(n*16),16),this.previousInstanceMatrix=null,this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,Id)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new vn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ai),Ll.copy(e.boundingBox).applyMatrix4(Ai),this.boundingBox.union(Ll)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Mn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ai),ss.copy(e.boundingSphere).applyMatrix4(Ai),this.boundingSphere.union(ss)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.previousInstanceMatrix!==null&&(this.previousInstanceMatrix=e.previousInstanceMatrix.clone()),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const n=t.morphTargetInfluences,i=this.morphTexture.source.data.data,r=n.length+1,a=e*r+1;for(let o=0;o<n.length;o++)n[o]=i[a+o]}raycast(e,t){const n=this.matrixWorld,i=this.count;if(is.geometry=this.geometry,is.material=this.material,is.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ss.copy(this.boundingSphere),ss.applyMatrix4(n),e.ray.intersectsSphere(ss)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,Ai),Cl.multiplyMatrices(n,Ai),is.matrixWorld=Cl,is.raycast(e,Ws);for(let a=0,o=Ws.length;a<o;a++){const l=Ws[a];l.instanceId=r,l.object=this,t.push(l)}Ws.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new so(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){const n=t.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new Ao(new Float32Array(i*this.count),i,this.count,xo,Kt));const r=this.morphTexture.source.data.data;let a=0;for(let c=0;c<n.length;c++)a+=n[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=i*e;return r[l]=o,r.set(n,l+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const ta=new U,Nd=new U,Ud=new De;class ai{constructor(e=new U(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const i=ta.subVectors(n,t).cross(Nd.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){const i=e.delta(ta),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const a=-(e.start.dot(this.normal)+this.constant)/r;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(i,a)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||Ud.getNormalMatrix(e),i=this.coplanarPoint(ta).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const ni=new Mn,Fd=new qe(.5,.5),Xs=new U;class Co{constructor(e=new ai,t=new ai,n=new ai,i=new ai,r=new ai,a=new ai){this.planes=[e,t,n,i,r,a]}set(e,t,n,i,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=pn,n=!1){const i=this.planes,r=e.elements,a=r[0],o=r[1],l=r[2],c=r[3],h=r[4],d=r[5],u=r[6],f=r[7],g=r[8],x=r[9],m=r[10],p=r[11],v=r[12],S=r[13],b=r[14],A=r[15];if(i[0].setComponents(c-a,f-h,p-g,A-v).normalize(),i[1].setComponents(c+a,f+h,p+g,A+v).normalize(),i[2].setComponents(c+o,f+d,p+x,A+S).normalize(),i[3].setComponents(c-o,f-d,p-x,A-S).normalize(),n)i[4].setComponents(l,u,m,b).normalize(),i[5].setComponents(c-l,f-u,p-m,A-b).normalize();else if(i[4].setComponents(c-l,f-u,p-m,A-b).normalize(),t===pn)i[5].setComponents(c+l,f+u,p+m,A+b).normalize();else if(t===Ms)i[5].setComponents(l,u,m,b).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),ni.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),ni.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ni)}intersectsSprite(e){ni.center.set(0,0,0);const t=Fd.distanceTo(e.center);return ni.radius=.7071067811865476+t,ni.applyMatrix4(e.matrixWorld),this.intersectsSphere(ni)}intersectsSphere(e){const t=this.planes,n=e.center,i=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const i=t[n];if(Xs.x=i.normal.x>0?e.max.x:e.min.x,Xs.y=i.normal.y>0?e.max.y:e.min.y,Xs.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Xs)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class ah extends gn{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Ce(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const fr=new U,pr=new U,Pl=new ke,rs=new _r,qs=new Mn,na=new U,Dl=new U;class Lo extends ht{constructor(e=new Ot,t=new ah){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[0];for(let i=1,r=t.count;i<r;i++)fr.fromBufferAttribute(t,i-1),pr.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=fr.distanceTo(pr);e.setAttribute("lineDistance",new Mt(n,1))}else Se("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const n=this.geometry,i=this.matrixWorld,r=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),qs.copy(n.boundingSphere),qs.applyMatrix4(i),qs.radius+=r,e.ray.intersectsSphere(qs)===!1)return;Pl.copy(i).invert(),rs.copy(e.ray).applyMatrix4(Pl);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=n.index,u=n.attributes.position;if(h!==null){const f=Math.max(0,a.start),g=Math.min(h.count,a.start+a.count);for(let x=f,m=g-1;x<m;x+=c){const p=h.getX(x),v=h.getX(x+1),S=Ys(this,e,rs,l,p,v,x);S&&t.push(S)}if(this.isLineLoop){const x=h.getX(g-1),m=h.getX(f),p=Ys(this,e,rs,l,x,m,g-1);p&&t.push(p)}}else{const f=Math.max(0,a.start),g=Math.min(u.count,a.start+a.count);for(let x=f,m=g-1;x<m;x+=c){const p=Ys(this,e,rs,l,x,x+1,x);p&&t.push(p)}if(this.isLineLoop){const x=Ys(this,e,rs,l,g-1,f,g-1);x&&t.push(x)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Ys(s,e,t,n,i,r,a){const o=s.geometry.attributes.position;if(fr.fromBufferAttribute(o,i),pr.fromBufferAttribute(o,r),t.distanceSqToSegment(fr,pr,na,Dl)>n)return;na.applyMatrix4(s.matrixWorld);const c=e.ray.origin.distanceTo(na);if(!(c<e.near||c>e.far))return{distance:c,point:Dl.clone().applyMatrix4(s.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:s}}const Il=new U,Nl=new U;class Od extends Lo{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[];for(let i=0,r=t.count;i<r;i+=2)Il.fromBufferAttribute(t,i),Nl.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+Il.distanceTo(Nl);e.setAttribute("lineDistance",new Mt(n,1))}else Se("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class Bd extends Lo{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}}class oh extends gn{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Ce(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const Ul=new ke,ro=new _r,js=new Mn,Ks=new U;class kd extends ht{constructor(e=new Ot,t=new oh){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const n=this.geometry,i=this.matrixWorld,r=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),js.copy(n.boundingSphere),js.applyMatrix4(i),js.radius+=r,e.ray.intersectsSphere(js)===!1)return;Ul.copy(i).invert(),ro.copy(e.ray).applyMatrix4(Ul);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,d=n.attributes.position;if(c!==null){const u=Math.max(0,a.start),f=Math.min(c.count,a.start+a.count);for(let g=u,x=f;g<x;g++){const m=c.getX(g);Ks.fromBufferAttribute(d,m),Fl(Ks,m,l,i,e,t,this)}}else{const u=Math.max(0,a.start),f=Math.min(d.count,a.start+a.count);for(let g=u,x=f;g<x;g++)Ks.fromBufferAttribute(d,g),Fl(Ks,g,l,i,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=i.length;r<a;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Fl(s,e,t,n,i,r,a){const o=ro.distanceSqToPoint(s);if(o<t){const l=new U;ro.closestPointToPoint(s,l),l.applyMatrix4(n);const c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}class lh extends Et{constructor(e=[],t=hi,n,i,r,a,o,l,c,h){super(e,t,n,i,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class zd extends Et{constructor(e,t,n,i,r,a,o,l,c){super(e,t,n,i,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class zi extends Et{constructor(e,t,n=xn,i,r,a,o=bt,l=bt,c,h=Un,d=1){if(h!==Un&&h!==ci)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const u={width:e,height:t,depth:d};super(u,i,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new To(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class Vd extends zi{constructor(e,t=xn,n=hi,i,r,a=bt,o=bt,l,c=Un){const h={width:e,height:e,depth:1},d=[h,h,h,h,h,h];super(e,e,t,n,i,r,a,o,l,c),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class ch extends Et{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Xi extends Ot{constructor(e=1,t=1,n=1,i=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:r,depthSegments:a};const o=this;i=Math.floor(i),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],h=[],d=[];let u=0,f=0;g("z","y","x",-1,-1,n,t,e,a,r,0),g("z","y","x",1,-1,n,t,-e,a,r,1),g("x","z","y",1,1,e,n,t,i,a,2),g("x","z","y",1,-1,e,n,-t,i,a,3),g("x","y","z",1,-1,e,t,n,i,r,4),g("x","y","z",-1,-1,e,t,-n,i,r,5),this.setIndex(l),this.setAttribute("position",new Mt(c,3)),this.setAttribute("normal",new Mt(h,3)),this.setAttribute("uv",new Mt(d,2));function g(x,m,p,v,S,b,A,T,R,M,w){const P=b/R,C=A/M,F=b/2,G=A/2,W=T/2,N=R+1,B=M+1;let V=0,Q=0;const ee=new U;for(let he=0;he<B;he++){const ve=he*C-G;for(let Te=0;Te<N;Te++){const Ye=Te*P-F;ee[x]=Ye*v,ee[m]=ve*S,ee[p]=W,c.push(ee.x,ee.y,ee.z),ee[x]=0,ee[m]=0,ee[p]=T>0?1:-1,h.push(ee.x,ee.y,ee.z),d.push(Te/R),d.push(1-he/M),V+=1}}for(let he=0;he<M;he++)for(let ve=0;ve<R;ve++){const Te=u+ve+N*he,Ye=u+ve+N*(he+1),et=u+(ve+1)+N*(he+1),Ue=u+(ve+1)+N*he;l.push(Te,Ye,Ue),l.push(Ye,et,Ue),Q+=6}o.addGroup(f,Q,w),f+=Q,u+=V}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Xi(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class vr extends Ot{constructor(e=1,t=1,n=1,i=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;i=Math.floor(i),r=Math.floor(r);const h=[],d=[],u=[],f=[];let g=0;const x=[],m=n/2;let p=0;v(),a===!1&&(e>0&&S(!0),t>0&&S(!1)),this.setIndex(h),this.setAttribute("position",new Mt(d,3)),this.setAttribute("normal",new Mt(u,3)),this.setAttribute("uv",new Mt(f,2));function v(){const b=new U,A=new U;let T=0;const R=(t-e)/n;for(let M=0;M<=r;M++){const w=[],P=M/r,C=P*(t-e)+e;for(let F=0;F<=i;F++){const G=F/i,W=G*l+o,N=Math.sin(W),B=Math.cos(W);A.x=C*N,A.y=-P*n+m,A.z=C*B,d.push(A.x,A.y,A.z),b.set(N,R,B).normalize(),u.push(b.x,b.y,b.z),f.push(G,1-P),w.push(g++)}x.push(w)}for(let M=0;M<i;M++)for(let w=0;w<r;w++){const P=x[w][M],C=x[w+1][M],F=x[w+1][M+1],G=x[w][M+1];(e>0||w!==0)&&(h.push(P,C,G),T+=3),(t>0||w!==r-1)&&(h.push(C,F,G),T+=3)}c.addGroup(p,T,0),p+=T}function S(b){const A=g,T=new qe,R=new U;let M=0;const w=b===!0?e:t,P=b===!0?1:-1;for(let F=1;F<=i;F++)d.push(0,m*P,0),u.push(0,P,0),f.push(.5,.5),g++;const C=g;for(let F=0;F<=i;F++){const W=F/i*l+o,N=Math.cos(W),B=Math.sin(W);R.x=w*B,R.y=m*P,R.z=w*N,d.push(R.x,R.y,R.z),u.push(0,P,0),T.x=N*.5+.5,T.y=B*.5*P+.5,f.push(T.x,T.y),g++}for(let F=0;F<i;F++){const G=A+F,W=C+F;b===!0?h.push(W,W+1,G):h.push(W+1,W,G),M+=3}c.addGroup(p,M,b===!0?1:2),p+=M}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new vr(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Po extends vr{constructor(e=1,t=1,n=32,i=1,r=!1,a=0,o=Math.PI*2){super(0,e,t,n,i,r,a,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(e){return new Po(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class ys extends Ot{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};const r=e/2,a=t/2,o=Math.floor(n),l=Math.floor(i),c=o+1,h=l+1,d=e/o,u=t/l,f=[],g=[],x=[],m=[];for(let p=0;p<h;p++){const v=p*u-a;for(let S=0;S<c;S++){const b=S*d-r;g.push(b,-v,0),x.push(0,0,1),m.push(S/o),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let v=0;v<o;v++){const S=v+c*p,b=v+c*(p+1),A=v+1+c*(p+1),T=v+1+c*p;f.push(S,b,T),f.push(b,A,T)}this.setIndex(f),this.setAttribute("position",new Mt(g,3)),this.setAttribute("normal",new Mt(x,3)),this.setAttribute("uv",new Mt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ys(e.width,e.height,e.widthSegments,e.heightSegments)}}class Do extends Ot{constructor(e=1,t=32,n=16,i=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:r,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const h=[],d=new U,u=new U,f=[],g=[],x=[],m=[];for(let p=0;p<=n;p++){const v=[],S=p/n;let b=0;p===0&&a===0?b=.5/t:p===n&&l===Math.PI&&(b=-.5/t);for(let A=0;A<=t;A++){const T=A/t;d.x=-e*Math.cos(i+T*r)*Math.sin(a+S*o),d.y=e*Math.cos(a+S*o),d.z=e*Math.sin(i+T*r)*Math.sin(a+S*o),g.push(d.x,d.y,d.z),u.copy(d).normalize(),x.push(u.x,u.y,u.z),m.push(T+b,1-S),v.push(c++)}h.push(v)}for(let p=0;p<n;p++)for(let v=0;v<t;v++){const S=h[p][v+1],b=h[p][v],A=h[p+1][v],T=h[p+1][v+1];(p!==0||a>0)&&f.push(S,b,T),(p!==n-1||l<Math.PI)&&f.push(b,A,T)}this.setIndex(f),this.setAttribute("position",new Mt(g,3)),this.setAttribute("normal",new Mt(x,3)),this.setAttribute("uv",new Mt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Do(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class Io extends Ot{constructor(e=1,t=.4,n=12,i=48,r=Math.PI*2,a=0,o=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:i,arc:r,thetaStart:a,thetaLength:o},n=Math.floor(n),i=Math.floor(i);const l=[],c=[],h=[],d=[],u=new U,f=new U,g=new U;for(let x=0;x<=n;x++){const m=a+x/n*o;for(let p=0;p<=i;p++){const v=p/i*r;f.x=(e+t*Math.cos(m))*Math.cos(v),f.y=(e+t*Math.cos(m))*Math.sin(v),f.z=t*Math.sin(m),c.push(f.x,f.y,f.z),u.x=e*Math.cos(v),u.y=e*Math.sin(v),g.subVectors(f,u).normalize(),h.push(g.x,g.y,g.z),d.push(p/i),d.push(x/n)}}for(let x=1;x<=n;x++)for(let m=1;m<=i;m++){const p=(i+1)*x+m-1,v=(i+1)*(x-1)+m-1,S=(i+1)*(x-1)+m,b=(i+1)*x+m;l.push(p,v,b),l.push(v,S,b)}this.setIndex(l),this.setAttribute("position",new Mt(c,3)),this.setAttribute("normal",new Mt(h,3)),this.setAttribute("uv",new Mt(d,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Io(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}function Vi(s){const e={};for(const t in s){e[t]={};for(const n in s[t]){const i=s[t][n];if(Ol(i))i.isRenderTargetTexture?(Se("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=i.clone();else if(Array.isArray(i))if(Ol(i[0])){const r=[];for(let a=0,o=i.length;a<o;a++)r[a]=i[a].clone();e[t][n]=r}else e[t][n]=i.slice();else e[t][n]=i}}return e}function Nt(s){const e={};for(let t=0;t<s.length;t++){const n=Vi(s[t]);for(const i in n)e[i]=n[i]}return e}function Ol(s){return s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)}function Hd(s){const e=[];for(let t=0;t<s.length;t++)e.push(s[t].clone());return e}function hh(s){const e=s.getRenderTarget();return e===null?s.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:He.workingColorSpace}const Gd={clone:Vi,merge:Nt};var Wd=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Xd=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class _n extends gn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Wd,this.fragmentShader=Xd,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Vi(e.uniforms),this.uniformsGroups=Hd(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const i in this.uniforms){const a=this.uniforms[i].value;a&&a.isTexture?t.uniforms[i]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[i]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[i]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[i]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[i]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[i]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[i]={type:"m4",value:a.toArray()}:t.uniforms[i]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}class qd extends _n{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class Mr extends gn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ce(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ce(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=to,this.normalScale=new qe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new $n,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Sn extends Mr{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new qe(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Ge(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Ce(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Ce(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Ce(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class Yd extends gn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Nu,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class jd extends gn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}function Zs(s,e){return!s||s.constructor===e?s:typeof e.BYTES_PER_ELEMENT=="number"?new e(s):Array.prototype.slice.call(s)}function Kd(s){function e(i,r){return s[i]-s[r]}const t=s.length,n=new Array(t);for(let i=0;i!==t;++i)n[i]=i;return n.sort(e),n}function Bl(s,e,t){const n=s.length,i=new s.constructor(n);for(let r=0,a=0;a!==n;++r){const o=t[r]*e;for(let l=0;l!==e;++l)i[a++]=s[o+l]}return i}function uh(s,e,t,n){let i=1,r=s[0];for(;r!==void 0&&r[n]===void 0;)r=s[i++];if(r===void 0)return;let a=r[n];if(a!==void 0)if(Array.isArray(a))do a=r[n],a!==void 0&&(e.push(r.time),t.push(...a)),r=s[i++];while(r!==void 0);else if(a.toArray!==void 0)do a=r[n],a!==void 0&&(e.push(r.time),a.toArray(t,t.length)),r=s[i++];while(r!==void 0);else do a=r[n],a!==void 0&&(e.push(r.time),t.push(a)),r=s[i++];while(r!==void 0)}class qi{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){const t=this.parameterPositions;let n=this._cachedIndex,i=t[n],r=t[n-1];n:{e:{let a;t:{i:if(!(e<i)){for(let o=n+2;;){if(i===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=i,i=t[++n],e<i)break e}a=t.length;break t}if(!(e>=r)){const o=t[1];e<o&&(n=2,r=o);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(i=r,r=t[--n-1],e>=r)break e}a=n,n=0;break t}break n}for(;n<a;){const o=n+a>>>1;e<t[o]?a=o:n=o+1}if(i=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){const t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i;for(let a=0;a!==i;++a)t[a]=n[r+a];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}}class Zd extends qi{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:il,endingEnd:il}}intervalChanged_(e,t,n){const i=this.parameterPositions;let r=e-2,a=e+1,o=i[r],l=i[a];if(o===void 0)switch(this.getSettings_().endingStart){case sl:r=e,o=2*t-n;break;case rl:r=i.length-2,o=t+i[r]-i[r+1];break;default:r=e,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case sl:a=e,l=2*n-t;break;case rl:a=1,l=n+i[1]-i[0];break;default:a=e-1,l=t}const c=(n-t)*.5,h=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(e,t,n,i){const r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this._offsetPrev,d=this._offsetNext,u=this._weightPrev,f=this._weightNext,g=(n-t)/(i-t),x=g*g,m=x*g,p=-u*m+2*u*x-u*g,v=(1+u)*m+(-1.5-2*u)*x+(-.5+u)*g+1,S=(-1-f)*m+(1.5+f)*x+.5*g,b=f*m-f*x;for(let A=0;A!==o;++A)r[A]=p*a[h+A]+v*a[c+A]+S*a[l+A]+b*a[d+A];return r}}class $d extends qi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){const r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=(n-t)/(i-t),d=1-h;for(let u=0;u!==o;++u)r[u]=a[c+u]*d+a[l+u]*h;return r}}class Jd extends qi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}}class Qd extends qi{interpolate_(e,t,n,i){const r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this.settings||this.DefaultSettings_,d=h.inTangents,u=h.outTangents;if(!d||!u){const x=(n-t)/(i-t),m=1-x;for(let p=0;p!==o;++p)r[p]=a[c+p]*m+a[l+p]*x;return r}const f=o*2,g=e-1;for(let x=0;x!==o;++x){const m=a[c+x],p=a[l+x],v=g*f+x*2,S=u[v],b=u[v+1],A=e*f+x*2,T=d[A],R=d[A+1];let M=(n-t)/(i-t),w,P,C,F,G;for(let W=0;W<8;W++){w=M*M,P=w*M,C=1-M,F=C*C,G=F*C;const B=G*t+3*F*M*S+3*C*w*T+P*i-n;if(Math.abs(B)<1e-10)break;const V=3*F*(S-t)+6*C*M*(T-S)+3*w*(i-T);if(Math.abs(V)<1e-10)break;M=M-B/V,M=Math.max(0,Math.min(1,M))}r[x]=G*m+3*F*M*b+3*C*w*R+P*p}return r}}class an{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Zs(t,this.TimeBufferType),this.values=Zs(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){const t=e.constructor;let n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Zs(e.times,Array),values:Zs(e.values,Array)};const i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Jd(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new $d(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Zd(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){const t=new Qd(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.settings=this.settings),t}setInterpolation(e){let t;switch(e){case _s:t=this.InterpolantFactoryMethodDiscrete;break;case vs:t=this.InterpolantFactoryMethodLinear;break;case Pr:t=this.InterpolantFactoryMethodSmooth;break;case nl:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){const n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Se("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return _s;case this.InterpolantFactoryMethodLinear:return vs;case this.InterpolantFactoryMethodSmooth:return Pr;case this.InterpolantFactoryMethodBezier:return nl}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){const t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){const t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e}return this}trim(e,t){const n=this.times,i=n.length;let r=0,a=i-1;for(;r!==i&&n[r]<e;)++r;for(;a!==-1&&n[a]>t;)--a;if(++a,r!==0||a!==i){r>=a&&(a=Math.max(a,1),r=a-1);const o=this.getValueSize();this.times=n.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let e=!0;const t=this.getValueSize();t-Math.floor(t)!==0&&(Ae("KeyframeTrack: Invalid value size in track.",this),e=!1);const n=this.times,i=this.values,r=n.length;r===0&&(Ae("KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==r;o++){const l=n[o];if(typeof l=="number"&&isNaN(l)){Ae("KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){Ae("KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(i!==void 0&&Gu(i))for(let o=0,l=i.length;o!==l;++o){const c=i[o];if(isNaN(c)){Ae("KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){const e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===Pr,r=e.length-1;let a=1;for(let o=1;o<r;++o){let l=!1;const c=e[o],h=e[o+1];if(c!==h&&(o!==1||c!==e[0]))if(i)l=!0;else{const d=o*n,u=d-n,f=d+n;for(let g=0;g!==n;++g){const x=t[d+g];if(x!==t[u+g]||x!==t[f+g]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];const d=o*n,u=a*n;for(let f=0;f!==n;++f)t[u+f]=t[d+f]}++a}}if(r>0){e[a]=e[r];for(let o=r*n,l=a*n,c=0;c!==n;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*n)):(this.times=e,this.values=t),this}clone(){const e=this.times.slice(),t=this.values.slice(),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,i}}an.prototype.ValueTypeName="";an.prototype.TimeBufferType=Float32Array;an.prototype.ValueBufferType=Float32Array;an.prototype.DefaultInterpolation=vs;class Yi extends an{constructor(e,t,n){super(e,t,n)}}Yi.prototype.ValueTypeName="bool";Yi.prototype.ValueBufferType=Array;Yi.prototype.DefaultInterpolation=_s;Yi.prototype.InterpolantFactoryMethodLinear=void 0;Yi.prototype.InterpolantFactoryMethodSmooth=void 0;class dh extends an{constructor(e,t,n,i){super(e,t,n,i)}}dh.prototype.ValueTypeName="color";class Hi extends an{constructor(e,t,n,i){super(e,t,n,i)}}Hi.prototype.ValueTypeName="number";class ef extends qi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){const r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-t)/(i-t);let c=e*o;for(let h=c+o;c!==h;c+=4)Fn.slerpFlat(r,0,a,c-o,a,c,l);return r}}class Gi extends an{constructor(e,t,n,i){super(e,t,n,i)}InterpolantFactoryMethodLinear(e){return new ef(this.times,this.values,this.getValueSize(),e)}}Gi.prototype.ValueTypeName="quaternion";Gi.prototype.InterpolantFactoryMethodSmooth=void 0;class ji extends an{constructor(e,t,n){super(e,t,n)}}ji.prototype.ValueTypeName="string";ji.prototype.ValueBufferType=Array;ji.prototype.DefaultInterpolation=_s;ji.prototype.InterpolantFactoryMethodLinear=void 0;ji.prototype.InterpolantFactoryMethodSmooth=void 0;class Wi extends an{constructor(e,t,n,i){super(e,t,n,i)}}Wi.prototype.ValueTypeName="vector";class tf{constructor(e="",t=-1,n=[],i=Du){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=sn(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){const t=[],n=e.tracks,i=1/(e.fps||1);for(let a=0,o=n.length;a!==o;++a)t.push(sf(n[a]).scale(i));const r=new this(e.name,e.duration,t,e.blendMode);return r.uuid=e.uuid,r.userData=JSON.parse(e.userData||"{}"),r}static toJSON(e){const t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let r=0,a=n.length;r!==a;++r)t.push(an.toJSON(n[r]));return i}static CreateFromMorphTargetSequence(e,t,n,i){const r=t.length,a=[];for(let o=0;o<r;o++){let l=[],c=[];l.push((o+r-1)%r,o,(o+1)%r),c.push(0,1,0);const h=Kd(l);l=Bl(l,1,h),c=Bl(c,1,h),!i&&l[0]===0&&(l.push(r),c.push(c[0])),a.push(new Hi(".morphTargetInfluences["+t[o].name+"]",l,c).scale(1/n))}return new this(e,-1,a)}static findByName(e,t){let n=e;if(!Array.isArray(e)){const i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){const i={},r=/^([\w-]*?)([\d]+)$/;for(let o=0,l=e.length;o<l;o++){const c=e[o],h=c.name.match(r);if(h&&h.length>1){const d=h[1];let u=i[d];u||(i[d]=u=[]),u.push(c)}}const a=[];for(const o in i)a.push(this.CreateFromMorphTargetSequence(o,i[o],t,n));return a}static parseAnimation(e,t){if(Se("AnimationClip: parseAnimation() is deprecated and will be removed with r185"),!e)return Ae("AnimationClip: No animation in JSONLoader data."),null;const n=function(d,u,f,g,x){if(f.length!==0){const m=[],p=[];uh(f,m,p,g),m.length!==0&&x.push(new d(u,m,p))}},i=[],r=e.name||"default",a=e.fps||30,o=e.blendMode;let l=e.length||-1;const c=e.hierarchy||[];for(let d=0;d<c.length;d++){const u=c[d].keys;if(!(!u||u.length===0))if(u[0].morphTargets){const f={};let g;for(g=0;g<u.length;g++)if(u[g].morphTargets)for(let x=0;x<u[g].morphTargets.length;x++)f[u[g].morphTargets[x]]=-1;for(const x in f){const m=[],p=[];for(let v=0;v!==u[g].morphTargets.length;++v){const S=u[g];m.push(S.time),p.push(S.morphTarget===x?1:0)}i.push(new Hi(".morphTargetInfluence["+x+"]",m,p))}l=f.length*a}else{const f=".bones["+t[d].name+"]";n(Wi,f+".position",u,"pos",i),n(Gi,f+".quaternion",u,"rot",i),n(Wi,f+".scale",u,"scl",i)}}return i.length===0?null:new this(r,l,i,o)}resetDuration(){const e=this.tracks;let t=0;for(let n=0,i=e.length;n!==i;++n){const r=this.tracks[n];t=Math.max(t,r.times[r.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){const e=[];for(let n=0;n<this.tracks.length;n++)e.push(this.tracks[n].clone());const t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}}function nf(s){switch(s.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Hi;case"vector":case"vector2":case"vector3":case"vector4":return Wi;case"color":return dh;case"quaternion":return Gi;case"bool":case"boolean":return Yi;case"string":return ji}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+s)}function sf(s){if(s.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const e=nf(s.type);if(s.times===void 0){const t=[],n=[];uh(s.keys,t,n,"value"),s.times=t,s.values=n}return e.parse!==void 0?e.parse(s):new e(s.name,s.times,s.values,s.interpolation)}const Ln={enabled:!1,files:{},add:function(s,e){this.enabled!==!1&&(kl(s)||(this.files[s]=e))},get:function(s){if(this.enabled!==!1&&!kl(s))return this.files[s]},remove:function(s){delete this.files[s]},clear:function(){this.files={}}};function kl(s){try{const e=s.slice(s.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}class rf{constructor(e,t,n){const i=this;let r=!1,a=0,o=0,l;const c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(h){o++,r===!1&&i.onStart!==void 0&&i.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,i.onProgress!==void 0&&i.onProgress(h,a,o),a===o&&(r=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,d){return c.push(h,d),this},this.removeHandler=function(h){const d=c.indexOf(h);return d!==-1&&c.splice(d,2),this},this.getHandler=function(h){for(let d=0,u=c.length;d<u;d+=2){const f=c[d],g=c[d+1];if(f.global&&(f.lastIndex=0),f.test(h))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}}const af=new rf;class Ki{constructor(e){this.manager=e!==void 0?e:af,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){const n=this;return new Promise(function(i,r){n.load(e,i,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}Ki.DEFAULT_MATERIAL_NAME="__DEFAULT";const Rn={};class of extends Error{constructor(e,t){super(e),this.response=t}}class fh extends Ki{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=Ln.get(`file:${e}`);if(r!==void 0){this.manager.itemStart(e),setTimeout(()=>{t&&t(r),this.manager.itemEnd(e)},0);return}if(Rn[e]!==void 0){Rn[e].push({onLoad:t,onProgress:n,onError:i});return}Rn[e]=[],Rn[e].push({onLoad:t,onProgress:n,onError:i});const a=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),o=this.mimeType,l=this.responseType;fetch(a).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&Se("FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;const h=Rn[e],d=c.body.getReader(),u=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),f=u?parseInt(u):0,g=f!==0;let x=0;const m=new ReadableStream({start(p){v();function v(){d.read().then(({done:S,value:b})=>{if(S)p.close();else{x+=b.byteLength;const A=new ProgressEvent("progress",{lengthComputable:g,loaded:x,total:f});for(let T=0,R=h.length;T<R;T++){const M=h[T];M.onProgress&&M.onProgress(A)}p.enqueue(b),v()}},S=>{p.error(S)})}}});return new Response(m)}else throw new of(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(h=>new DOMParser().parseFromString(h,o));case"json":return c.json();default:if(o==="")return c.text();{const d=/charset="?([^;"\s]*)"?/i.exec(o),u=d&&d[1]?d[1].toLowerCase():void 0,f=new TextDecoder(u);return c.arrayBuffer().then(g=>f.decode(g))}}}).then(c=>{Ln.add(`file:${e}`,c);const h=Rn[e];delete Rn[e];for(let d=0,u=h.length;d<u;d++){const f=h[d];f.onLoad&&f.onLoad(c)}}).catch(c=>{const h=Rn[e];if(h===void 0)throw this.manager.itemError(e),c;delete Rn[e];for(let d=0,u=h.length;d<u;d++){const f=h[d];f.onError&&f.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}const Ri=new WeakMap;class lf extends Ki{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=this,a=Ln.get(`image:${e}`);if(a!==void 0){if(a.complete===!0)r.manager.itemStart(e),setTimeout(function(){t&&t(a),r.manager.itemEnd(e)},0);else{let d=Ri.get(a);d===void 0&&(d=[],Ri.set(a,d)),d.push({onLoad:t,onError:i})}return a}const o=Ss("img");function l(){h(),t&&t(this);const d=Ri.get(this)||[];for(let u=0;u<d.length;u++){const f=d[u];f.onLoad&&f.onLoad(this)}Ri.delete(this),r.manager.itemEnd(e)}function c(d){h(),i&&i(d),Ln.remove(`image:${e}`);const u=Ri.get(this)||[];for(let f=0;f<u.length;f++){const g=u[f];g.onError&&g.onError(d)}Ri.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function h(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),Ln.add(`image:${e}`,o),r.manager.itemStart(e),o.src=e,o}}class cf extends Ki{constructor(e){super(e)}load(e,t,n,i){const r=new Et,a=new lf(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(e,function(o){r.image=o,r.needsUpdate=!0,t!==void 0&&t(r)},n,i),r}}class bs extends ht{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Ce(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}class hf extends bs{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(ht.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ce(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){const t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}}const ia=new ke,zl=new U,Vl=new U;class No{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new qe(512,512),this.mapType=Wt,this.map=null,this.mapPass=null,this.matrix=new ke,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Co,this._frameExtents=new qe(1,1),this._viewportCount=1,this._viewports=[new st(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;zl.setFromMatrixPosition(e.matrixWorld),t.position.copy(zl),Vl.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Vl),t.updateMatrixWorld(),ia.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ia,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===Ms||t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(ia)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}const $s=new U,Js=new Fn,cn=new U;class ph extends ht{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ke,this.projectionMatrix=new ke,this.projectionMatrixInverse=new ke,this.coordinateSystem=pn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose($s,Js,cn),cn.x===1&&cn.y===1&&cn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose($s,Js,cn.set(1,1,1)).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorld.decompose($s,Js,cn),cn.x===1&&cn.y===1&&cn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose($s,Js,cn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}const Xn=new U,Hl=new qe,Gl=new qe;class Ut extends ph{constructor(e=50,t=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=ki*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(fs*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return ki*2*Math.atan(Math.tan(fs*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Xn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Xn.x,Xn.y).multiplyScalar(-e/Xn.z),Xn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Xn.x,Xn.y).multiplyScalar(-e/Xn.z)}getViewSize(e,t){return this.getViewBounds(e,Hl,Gl),t.subVectors(Gl,Hl)}setViewOffset(e,t,n,i,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(fs*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,r=-.5*i;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*i/l,t-=a.offsetY*n/c,i*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class uf extends No{constructor(){super(new Ut(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){const t=this.camera,n=ki*2*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height*this.aspect,r=e.distance||t.far;(n!==t.fov||i!==t.aspect||r!==t.far)&&(t.fov=n,t.aspect=i,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}}class df extends bs{constructor(e,t,n=0,i=Math.PI/3,r=0,a=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(ht.DEFAULT_UP),this.updateMatrix(),this.target=new ht,this.distance=n,this.angle=i,this.penumbra=r,this.decay=a,this.map=null,this.shadow=new uf}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}}class ff extends No{constructor(){super(new Ut(90,1,.5,500)),this.isPointLightShadow=!0}}class pf extends bs{constructor(e,t,n=0,i=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new ff}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}}class Sr extends ph{constructor(e=-1,t=1,n=1,i=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let r=n-e,a=n+e,o=i+t,l=i-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class mf extends No{constructor(){super(new Sr(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class mh extends bs{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(ht.DEFAULT_UP),this.updateMatrix(),this.target=new ht,this.shadow=new mf}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}}class gf extends bs{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}class ms{static extractUrlBase(e){const t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}}const sa=new WeakMap;class xf extends Ki{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&Se("ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&Se("ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=this,a=Ln.get(`image-bitmap:${e}`);if(a!==void 0){if(r.manager.itemStart(e),a.then){a.then(c=>{sa.has(a)===!0?(i&&i(sa.get(a)),r.manager.itemError(e),r.manager.itemEnd(e)):(t&&t(c),r.manager.itemEnd(e))});return}setTimeout(function(){t&&t(a),r.manager.itemEnd(e)},0);return}const o={};o.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",o.headers=this.requestHeader,o.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;const l=fetch(e,o).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(r.options,{colorSpaceConversion:"none"}))}).then(function(c){Ln.add(`image-bitmap:${e}`,c),t&&t(c),r.manager.itemEnd(e)}).catch(function(c){i&&i(c),sa.set(l,c),Ln.remove(`image-bitmap:${e}`),r.manager.itemError(e),r.manager.itemEnd(e)});Ln.add(`image-bitmap:${e}`,l),r.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}const Ci=-90,Li=1;class _f extends ht{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new Ut(Ci,Li,e,t);i.layers=this.layers,this.add(i);const r=new Ut(Ci,Li,e,t);r.layers=this.layers,this.add(r);const a=new Ut(Ci,Li,e,t);a.layers=this.layers,this.add(a);const o=new Ut(Ci,Li,e,t);o.layers=this.layers,this.add(o);const l=new Ut(Ci,Li,e,t);l.layers=this.layers,this.add(l);const c=new Ut(Ci,Li,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,i,r,a,o,l]=t;for(const c of t)this.remove(c);if(e===pn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Ms)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,h]=this.children,d=e.getRenderTarget(),u=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;const x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(n,0,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,1,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=x,e.setRenderTarget(n,5,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(d,u,f),e.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class vf extends Ut{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}const Uo="\\[\\]\\.:\\/",Mf=new RegExp("["+Uo+"]","g"),Fo="[^"+Uo+"]",Sf="[^"+Uo.replace("\\.","")+"]",yf=/((?:WC+[\/:])*)/.source.replace("WC",Fo),bf=/(WCOD+)?/.source.replace("WCOD",Sf),Tf=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Fo),Ef=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Fo),wf=new RegExp("^"+yf+bf+Tf+Ef+"$"),Af=["material","materials","bones","map"];class Rf{constructor(e,t,n){const i=n||Qe.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();const n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){const n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(e,t)}bind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}}class Qe{constructor(e,t,n){this.path=t,this.parsedPath=n||Qe.parseTrackName(t),this.node=Qe.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new Qe.Composite(e,t,n):new Qe(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Mf,"")}static parseTrackName(e){const t=wf.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);const n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){const r=n.nodeName.substring(i+1);Af.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){const n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){const n=function(r){for(let a=0;a<r.length;a++){const o=r[a];if(o.name===t||o.uuid===t)return o;const l=n(o.children);if(l)return l}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){const n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){const n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){const n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){const n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node;const t=this.parsedPath,n=t.objectName,i=t.propertyName;let r=t.propertyIndex;if(e||(e=Qe.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Se("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){Ae("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ae("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ae("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ae("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ae("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){Ae("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){Ae("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}const a=e[i];if(a===void 0){const c=t.nodeName;Ae("PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){Ae("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ae("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}Qe.Composite=Rf;Qe.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Qe.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Qe.prototype.GetterByBindingType=[Qe.prototype._getValue_direct,Qe.prototype._getValue_array,Qe.prototype._getValue_arrayElement,Qe.prototype._getValue_toArray];Qe.prototype.SetterByBindingTypeAndVersioning=[[Qe.prototype._setValue_direct,Qe.prototype._setValue_direct_setNeedsUpdate,Qe.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Qe.prototype._setValue_array,Qe.prototype._setValue_array_setNeedsUpdate,Qe.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Qe.prototype._setValue_arrayElement,Qe.prototype._setValue_arrayElement_setNeedsUpdate,Qe.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Qe.prototype._setValue_fromArray,Qe.prototype._setValue_fromArray_setNeedsUpdate,Qe.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];const Vo=class Vo{constructor(e,t,n,i){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,i){const r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=i,this}};Vo.prototype.isMatrix2=!0;let Wl=Vo;function Xl(s,e,t,n){const i=Cf(n);switch(t){case Kc:return s*e;case xo:return s*e/i.components*i.byteLength;case _o:return s*e/i.components*i.byteLength;case di:return s*e*2/i.components*i.byteLength;case vo:return s*e*2/i.components*i.byteLength;case Zc:return s*e*3/i.components*i.byteLength;case Zt:return s*e*4/i.components*i.byteLength;case Mo:return s*e*4/i.components*i.byteLength;case ir:case sr:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case rr:case ar:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Ea:case Aa:return Math.max(s,16)*Math.max(e,8)/4;case Ta:case wa:return Math.max(s,8)*Math.max(e,8)/2;case Ra:case Ca:case Pa:case Da:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case La:case cr:case Ia:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Na:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Ua:return Math.floor((s+4)/5)*Math.floor((e+3)/4)*16;case Fa:return Math.floor((s+4)/5)*Math.floor((e+4)/5)*16;case Oa:return Math.floor((s+5)/6)*Math.floor((e+4)/5)*16;case Ba:return Math.floor((s+5)/6)*Math.floor((e+5)/6)*16;case ka:return Math.floor((s+7)/8)*Math.floor((e+4)/5)*16;case za:return Math.floor((s+7)/8)*Math.floor((e+5)/6)*16;case Va:return Math.floor((s+7)/8)*Math.floor((e+7)/8)*16;case Ha:return Math.floor((s+9)/10)*Math.floor((e+4)/5)*16;case Ga:return Math.floor((s+9)/10)*Math.floor((e+5)/6)*16;case Wa:return Math.floor((s+9)/10)*Math.floor((e+7)/8)*16;case Xa:return Math.floor((s+9)/10)*Math.floor((e+9)/10)*16;case qa:return Math.floor((s+11)/12)*Math.floor((e+9)/10)*16;case Ya:return Math.floor((s+11)/12)*Math.floor((e+11)/12)*16;case ja:case Ka:case Za:return Math.ceil(s/4)*Math.ceil(e/4)*16;case $a:case Ja:return Math.ceil(s/4)*Math.ceil(e/4)*8;case hr:case Qa:return Math.ceil(s/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Cf(s){switch(s){case Wt:case Xc:return{byteLength:1,components:1};case gs:case qc:case Nn:return{byteLength:2,components:1};case mo:case go:return{byteLength:2,components:4};case xn:case po:case Kt:return{byteLength:4,components:1};case Yc:case jc:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${s}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:fo}}));typeof window<"u"&&(window.__THREE__?Se("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=fo);/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function gh(){let s=null,e=!1,t=null,n=null;function i(r,a){t(r,a),n=s.requestAnimationFrame(i)}return{start:function(){e!==!0&&t!==null&&s!==null&&(n=s.requestAnimationFrame(i),e=!0)},stop:function(){s!==null&&s.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){s=r}}}function Lf(s){const e=new WeakMap;function t(o,l){const c=o.array,h=o.usage,d=c.byteLength,u=s.createBuffer();s.bindBuffer(l,u),s.bufferData(l,c,h),o.onUploadCallback();let f;if(c instanceof Float32Array)f=s.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=s.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=s.HALF_FLOAT:f=s.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=s.SHORT;else if(c instanceof Uint32Array)f=s.UNSIGNED_INT;else if(c instanceof Int32Array)f=s.INT;else if(c instanceof Int8Array)f=s.BYTE;else if(c instanceof Uint8Array)f=s.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:d}}function n(o,l,c){const h=l.array,d=l.updateRanges;if(s.bindBuffer(c,o),d.length===0)s.bufferSubData(c,0,h);else{d.sort((f,g)=>f.start-g.start);let u=0;for(let f=1;f<d.length;f++){const g=d[u],x=d[f];x.start<=g.start+g.count+1?g.count=Math.max(g.count,x.start+x.count-g.start):(++u,d[u]=x)}d.length=u+1;for(let f=0,g=d.length;f<g;f++){const x=d[f];s.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function i(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(s.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:i,remove:r,update:a}}var Pf=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Df=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,If=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Nf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Uf=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Ff=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Of=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Bf=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,kf=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,zf=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Vf=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Hf=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Gf=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Wf=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Xf=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,qf=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Yf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,jf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Kf=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Zf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,$f=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Jf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Qf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,ep=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,tp=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,np=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,ip=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,sp=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,rp=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,ap=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,op="gl_FragColor = linearToOutputTexel( gl_FragColor );",lp=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,cp=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,hp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,up=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,dp=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,fp=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,pp=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,mp=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,gp=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,xp=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,_p=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,vp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Mp=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Sp=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,yp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,bp=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Tp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Ep=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,wp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Ap=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Rp=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Cp=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Lp=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = inverseTransformDirection( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Pp=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Dp=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Ip=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Np=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Up=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Fp=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Op=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Bp=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,kp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,zp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Vp=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Hp=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Gp=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Wp=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Xp=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,qp=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Yp=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,jp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Kp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Zp=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,$p=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Jp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Qp=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,em=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,tm=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,nm=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,im=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,sm=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,rm=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,am=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,om=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,lm=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,cm=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,hm=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,um=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,dm=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,fm=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,pm=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,mm=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,gm=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,xm=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,_m=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,vm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Mm=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Sm=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,ym=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,bm=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Tm=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Em=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,wm=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Am=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Rm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Cm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Lm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Pm=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Dm=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Im=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Nm=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Um=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Fm=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Om=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Bm=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,km=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,zm=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Vm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Hm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Gm=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Wm=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Xm=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,qm=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ym=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,jm=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Km=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Zm=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,$m=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Jm=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Qm=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,eg=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,tg=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,ng=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ig=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,sg=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,rg=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,ag=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,og=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,lg=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,cg=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,hg=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Oe={alphahash_fragment:Pf,alphahash_pars_fragment:Df,alphamap_fragment:If,alphamap_pars_fragment:Nf,alphatest_fragment:Uf,alphatest_pars_fragment:Ff,aomap_fragment:Of,aomap_pars_fragment:Bf,batching_pars_vertex:kf,batching_vertex:zf,begin_vertex:Vf,beginnormal_vertex:Hf,bsdfs:Gf,iridescence_fragment:Wf,bumpmap_pars_fragment:Xf,clipping_planes_fragment:qf,clipping_planes_pars_fragment:Yf,clipping_planes_pars_vertex:jf,clipping_planes_vertex:Kf,color_fragment:Zf,color_pars_fragment:$f,color_pars_vertex:Jf,color_vertex:Qf,common:ep,cube_uv_reflection_fragment:tp,defaultnormal_vertex:np,displacementmap_pars_vertex:ip,displacementmap_vertex:sp,emissivemap_fragment:rp,emissivemap_pars_fragment:ap,colorspace_fragment:op,colorspace_pars_fragment:lp,envmap_fragment:cp,envmap_common_pars_fragment:hp,envmap_pars_fragment:up,envmap_pars_vertex:dp,envmap_physical_pars_fragment:bp,envmap_vertex:fp,fog_vertex:pp,fog_pars_vertex:mp,fog_fragment:gp,fog_pars_fragment:xp,gradientmap_pars_fragment:_p,lightmap_pars_fragment:vp,lights_lambert_fragment:Mp,lights_lambert_pars_fragment:Sp,lights_pars_begin:yp,lights_toon_fragment:Tp,lights_toon_pars_fragment:Ep,lights_phong_fragment:wp,lights_phong_pars_fragment:Ap,lights_physical_fragment:Rp,lights_physical_pars_fragment:Cp,lights_fragment_begin:Lp,lights_fragment_maps:Pp,lights_fragment_end:Dp,lightprobes_pars_fragment:Ip,logdepthbuf_fragment:Np,logdepthbuf_pars_fragment:Up,logdepthbuf_pars_vertex:Fp,logdepthbuf_vertex:Op,map_fragment:Bp,map_pars_fragment:kp,map_particle_fragment:zp,map_particle_pars_fragment:Vp,metalnessmap_fragment:Hp,metalnessmap_pars_fragment:Gp,morphinstance_vertex:Wp,morphcolor_vertex:Xp,morphnormal_vertex:qp,morphtarget_pars_vertex:Yp,morphtarget_vertex:jp,normal_fragment_begin:Kp,normal_fragment_maps:Zp,normal_pars_fragment:$p,normal_pars_vertex:Jp,normal_vertex:Qp,normalmap_pars_fragment:em,clearcoat_normal_fragment_begin:tm,clearcoat_normal_fragment_maps:nm,clearcoat_pars_fragment:im,iridescence_pars_fragment:sm,opaque_fragment:rm,packing:am,premultiplied_alpha_fragment:om,project_vertex:lm,dithering_fragment:cm,dithering_pars_fragment:hm,roughnessmap_fragment:um,roughnessmap_pars_fragment:dm,shadowmap_pars_fragment:fm,shadowmap_pars_vertex:pm,shadowmap_vertex:mm,shadowmask_pars_fragment:gm,skinbase_vertex:xm,skinning_pars_vertex:_m,skinning_vertex:vm,skinnormal_vertex:Mm,specularmap_fragment:Sm,specularmap_pars_fragment:ym,tonemapping_fragment:bm,tonemapping_pars_fragment:Tm,transmission_fragment:Em,transmission_pars_fragment:wm,uv_pars_fragment:Am,uv_pars_vertex:Rm,uv_vertex:Cm,worldpos_vertex:Lm,background_vert:Pm,background_frag:Dm,backgroundCube_vert:Im,backgroundCube_frag:Nm,cube_vert:Um,cube_frag:Fm,depth_vert:Om,depth_frag:Bm,distance_vert:km,distance_frag:zm,equirect_vert:Vm,equirect_frag:Hm,linedashed_vert:Gm,linedashed_frag:Wm,meshbasic_vert:Xm,meshbasic_frag:qm,meshlambert_vert:Ym,meshlambert_frag:jm,meshmatcap_vert:Km,meshmatcap_frag:Zm,meshnormal_vert:$m,meshnormal_frag:Jm,meshphong_vert:Qm,meshphong_frag:eg,meshphysical_vert:tg,meshphysical_frag:ng,meshtoon_vert:ig,meshtoon_frag:sg,points_vert:rg,points_frag:ag,shadow_vert:og,shadow_frag:lg,sprite_vert:cg,sprite_frag:hg},ce={common:{diffuse:{value:new Ce(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new De},alphaMap:{value:null},alphaMapTransform:{value:new De},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new De}},envmap:{envMap:{value:null},envMapRotation:{value:new De},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new De}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new De}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new De},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new De},normalScale:{value:new qe(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new De},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new De}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new De}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new De}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ce(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new U},probesMax:{value:new U},probesResolution:{value:new U}},points:{diffuse:{value:new Ce(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new De},alphaTest:{value:0},uvTransform:{value:new De}},sprite:{diffuse:{value:new Ce(16777215)},opacity:{value:1},center:{value:new qe(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new De},alphaMap:{value:null},alphaMapTransform:{value:new De},alphaTest:{value:0}}},dn={basic:{uniforms:Nt([ce.common,ce.specularmap,ce.envmap,ce.aomap,ce.lightmap,ce.fog]),vertexShader:Oe.meshbasic_vert,fragmentShader:Oe.meshbasic_frag},lambert:{uniforms:Nt([ce.common,ce.specularmap,ce.envmap,ce.aomap,ce.lightmap,ce.emissivemap,ce.bumpmap,ce.normalmap,ce.displacementmap,ce.fog,ce.lights,{emissive:{value:new Ce(0)},envMapIntensity:{value:1}}]),vertexShader:Oe.meshlambert_vert,fragmentShader:Oe.meshlambert_frag},phong:{uniforms:Nt([ce.common,ce.specularmap,ce.envmap,ce.aomap,ce.lightmap,ce.emissivemap,ce.bumpmap,ce.normalmap,ce.displacementmap,ce.fog,ce.lights,{emissive:{value:new Ce(0)},specular:{value:new Ce(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Oe.meshphong_vert,fragmentShader:Oe.meshphong_frag},standard:{uniforms:Nt([ce.common,ce.envmap,ce.aomap,ce.lightmap,ce.emissivemap,ce.bumpmap,ce.normalmap,ce.displacementmap,ce.roughnessmap,ce.metalnessmap,ce.fog,ce.lights,{emissive:{value:new Ce(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag},toon:{uniforms:Nt([ce.common,ce.aomap,ce.lightmap,ce.emissivemap,ce.bumpmap,ce.normalmap,ce.displacementmap,ce.gradientmap,ce.fog,ce.lights,{emissive:{value:new Ce(0)}}]),vertexShader:Oe.meshtoon_vert,fragmentShader:Oe.meshtoon_frag},matcap:{uniforms:Nt([ce.common,ce.bumpmap,ce.normalmap,ce.displacementmap,ce.fog,{matcap:{value:null}}]),vertexShader:Oe.meshmatcap_vert,fragmentShader:Oe.meshmatcap_frag},points:{uniforms:Nt([ce.points,ce.fog]),vertexShader:Oe.points_vert,fragmentShader:Oe.points_frag},dashed:{uniforms:Nt([ce.common,ce.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Oe.linedashed_vert,fragmentShader:Oe.linedashed_frag},depth:{uniforms:Nt([ce.common,ce.displacementmap]),vertexShader:Oe.depth_vert,fragmentShader:Oe.depth_frag},normal:{uniforms:Nt([ce.common,ce.bumpmap,ce.normalmap,ce.displacementmap,{opacity:{value:1}}]),vertexShader:Oe.meshnormal_vert,fragmentShader:Oe.meshnormal_frag},sprite:{uniforms:Nt([ce.sprite,ce.fog]),vertexShader:Oe.sprite_vert,fragmentShader:Oe.sprite_frag},background:{uniforms:{uvTransform:{value:new De},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Oe.background_vert,fragmentShader:Oe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new De}},vertexShader:Oe.backgroundCube_vert,fragmentShader:Oe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Oe.cube_vert,fragmentShader:Oe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Oe.equirect_vert,fragmentShader:Oe.equirect_frag},distance:{uniforms:Nt([ce.common,ce.displacementmap,{referencePosition:{value:new U},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Oe.distance_vert,fragmentShader:Oe.distance_frag},shadow:{uniforms:Nt([ce.lights,ce.fog,{color:{value:new Ce(0)},opacity:{value:1}}]),vertexShader:Oe.shadow_vert,fragmentShader:Oe.shadow_frag}};dn.physical={uniforms:Nt([dn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new De},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new De},clearcoatNormalScale:{value:new qe(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new De},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new De},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new De},sheen:{value:0},sheenColor:{value:new Ce(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new De},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new De},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new De},transmissionSamplerSize:{value:new qe},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new De},attenuationDistance:{value:0},attenuationColor:{value:new Ce(0)},specularColor:{value:new Ce(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new De},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new De},anisotropyVector:{value:new qe},anisotropyMap:{value:null},anisotropyMapTransform:{value:new De}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag};const Qs={r:0,b:0,g:0},ug=new ke,xh=new De;xh.set(-1,0,0,0,1,0,0,0,1);function dg(s,e,t,n,i,r){const a=new Ce(0);let o=i===!0?0:1,l,c,h=null,d=0,u=null;function f(v){let S=v.isScene===!0?v.background:null;if(S&&S.isTexture){const b=v.backgroundBlurriness>0;S=e.get(S,b)}return S}function g(v){let S=!1;const b=f(v);b===null?m(a,o):b&&b.isColor&&(m(b,1),S=!0);const A=s.xr.getEnvironmentBlendMode();A==="additive"?t.buffers.color.setClear(0,0,0,1,r):A==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(s.autoClear||S)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil))}function x(v,S){const b=f(S);b&&(b.isCubeTexture||b.mapping===xr)?(c===void 0&&(c=new kt(new Xi(1,1,1),new _n({name:"BackgroundCubeMaterial",uniforms:Vi(dn.backgroundCube.uniforms),vertexShader:dn.backgroundCube.vertexShader,fragmentShader:dn.backgroundCube.fragmentShader,side:Bt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(A,T,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=b,c.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(ug.makeRotationFromEuler(S.backgroundRotation)).transpose(),b.isCubeTexture&&b.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(xh),c.material.toneMapped=He.getTransfer(b.colorSpace)!==$e,(h!==b||d!==b.version||u!==s.toneMapping)&&(c.material.needsUpdate=!0,h=b,d=b.version,u=s.toneMapping),c.layers.enableAll(),v.unshift(c,c.geometry,c.material,0,0,null)):b&&b.isTexture&&(l===void 0&&(l=new kt(new ys(2,2),new _n({name:"BackgroundMaterial",uniforms:Vi(dn.background.uniforms),vertexShader:dn.background.vertexShader,fragmentShader:dn.background.fragmentShader,side:In,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=b,l.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,l.material.toneMapped=He.getTransfer(b.colorSpace)!==$e,b.matrixAutoUpdate===!0&&b.updateMatrix(),l.material.uniforms.uvTransform.value.copy(b.matrix),(h!==b||d!==b.version||u!==s.toneMapping)&&(l.material.needsUpdate=!0,h=b,d=b.version,u=s.toneMapping),l.layers.enableAll(),v.unshift(l,l.geometry,l.material,0,0,null))}function m(v,S){v.getRGB(Qs,hh(s)),t.buffers.color.setClear(Qs.r,Qs.g,Qs.b,S,r)}function p(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(v,S=1){a.set(v),o=S,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(v){o=v,m(a,o)},render:g,addToRenderList:x,dispose:p}}function fg(s,e){const t=s.getParameter(s.MAX_VERTEX_ATTRIBS),n={},i=u(null);let r=i,a=!1;function o(C,F,G,W,N){let B=!1;const V=d(C,W,G,F);r!==V&&(r=V,c(r.object)),B=f(C,W,G,N),B&&g(C,W,G,N),N!==null&&e.update(N,s.ELEMENT_ARRAY_BUFFER),(B||a)&&(a=!1,b(C,F,G,W),N!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,e.get(N).buffer))}function l(){return s.createVertexArray()}function c(C){return s.bindVertexArray(C)}function h(C){return s.deleteVertexArray(C)}function d(C,F,G,W){const N=W.wireframe===!0;let B=n[F.id];B===void 0&&(B={},n[F.id]=B);const V=C.isInstancedMesh===!0?C.id:0;let Q=B[V];Q===void 0&&(Q={},B[V]=Q);let ee=Q[G.id];ee===void 0&&(ee={},Q[G.id]=ee);let he=ee[N];return he===void 0&&(he=u(l()),ee[N]=he),he}function u(C){const F=[],G=[],W=[];for(let N=0;N<t;N++)F[N]=0,G[N]=0,W[N]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:F,enabledAttributes:G,attributeDivisors:W,object:C,attributes:{},index:null}}function f(C,F,G,W){const N=r.attributes,B=F.attributes;let V=0;const Q=G.getAttributes();for(const ee in Q)if(Q[ee].location>=0){const ve=N[ee];let Te=B[ee];if(Te===void 0&&(ee==="instanceMatrix"&&C.instanceMatrix&&(Te=C.instanceMatrix),ee==="instanceColor"&&C.instanceColor&&(Te=C.instanceColor)),ve===void 0||ve.attribute!==Te||Te&&ve.data!==Te.data)return!0;V++}return r.attributesNum!==V||r.index!==W}function g(C,F,G,W){const N={},B=F.attributes;let V=0;const Q=G.getAttributes();for(const ee in Q)if(Q[ee].location>=0){let ve=B[ee];ve===void 0&&(ee==="instanceMatrix"&&C.instanceMatrix&&(ve=C.instanceMatrix),ee==="instanceColor"&&C.instanceColor&&(ve=C.instanceColor));const Te={};Te.attribute=ve,ve&&ve.data&&(Te.data=ve.data),N[ee]=Te,V++}r.attributes=N,r.attributesNum=V,r.index=W}function x(){const C=r.newAttributes;for(let F=0,G=C.length;F<G;F++)C[F]=0}function m(C){p(C,0)}function p(C,F){const G=r.newAttributes,W=r.enabledAttributes,N=r.attributeDivisors;G[C]=1,W[C]===0&&(s.enableVertexAttribArray(C),W[C]=1),N[C]!==F&&(s.vertexAttribDivisor(C,F),N[C]=F)}function v(){const C=r.newAttributes,F=r.enabledAttributes;for(let G=0,W=F.length;G<W;G++)F[G]!==C[G]&&(s.disableVertexAttribArray(G),F[G]=0)}function S(C,F,G,W,N,B,V){V===!0?s.vertexAttribIPointer(C,F,G,N,B):s.vertexAttribPointer(C,F,G,W,N,B)}function b(C,F,G,W){x();const N=W.attributes,B=G.getAttributes(),V=F.defaultAttributeValues;for(const Q in B){const ee=B[Q];if(ee.location>=0){let he=N[Q];if(he===void 0&&(Q==="instanceMatrix"&&C.instanceMatrix&&(he=C.instanceMatrix),Q==="instanceColor"&&C.instanceColor&&(he=C.instanceColor)),he!==void 0){const ve=he.normalized,Te=he.itemSize,Ye=e.get(he);if(Ye===void 0)continue;const et=Ye.buffer,Ue=Ye.type,Z=Ye.bytesPerElement,fe=Ue===s.INT||Ue===s.UNSIGNED_INT||he.gpuType===po;if(he.isInterleavedBufferAttribute){const se=he.data,we=se.stride,Pe=he.offset;if(se.isInstancedInterleavedBuffer){for(let Re=0;Re<ee.locationSize;Re++)p(ee.location+Re,se.meshPerAttribute);C.isInstancedMesh!==!0&&W._maxInstanceCount===void 0&&(W._maxInstanceCount=se.meshPerAttribute*se.count)}else for(let Re=0;Re<ee.locationSize;Re++)m(ee.location+Re);s.bindBuffer(s.ARRAY_BUFFER,et);for(let Re=0;Re<ee.locationSize;Re++)S(ee.location+Re,Te/ee.locationSize,Ue,ve,we*Z,(Pe+Te/ee.locationSize*Re)*Z,fe)}else{if(he.isInstancedBufferAttribute){for(let se=0;se<ee.locationSize;se++)p(ee.location+se,he.meshPerAttribute);C.isInstancedMesh!==!0&&W._maxInstanceCount===void 0&&(W._maxInstanceCount=he.meshPerAttribute*he.count)}else for(let se=0;se<ee.locationSize;se++)m(ee.location+se);s.bindBuffer(s.ARRAY_BUFFER,et);for(let se=0;se<ee.locationSize;se++)S(ee.location+se,Te/ee.locationSize,Ue,ve,Te*Z,Te/ee.locationSize*se*Z,fe)}}else if(V!==void 0){const ve=V[Q];if(ve!==void 0)switch(ve.length){case 2:s.vertexAttrib2fv(ee.location,ve);break;case 3:s.vertexAttrib3fv(ee.location,ve);break;case 4:s.vertexAttrib4fv(ee.location,ve);break;default:s.vertexAttrib1fv(ee.location,ve)}}}}v()}function A(){w();for(const C in n){const F=n[C];for(const G in F){const W=F[G];for(const N in W){const B=W[N];for(const V in B)h(B[V].object),delete B[V];delete W[N]}}delete n[C]}}function T(C){if(n[C.id]===void 0)return;const F=n[C.id];for(const G in F){const W=F[G];for(const N in W){const B=W[N];for(const V in B)h(B[V].object),delete B[V];delete W[N]}}delete n[C.id]}function R(C){for(const F in n){const G=n[F];for(const W in G){const N=G[W];if(N[C.id]===void 0)continue;const B=N[C.id];for(const V in B)h(B[V].object),delete B[V];delete N[C.id]}}}function M(C){for(const F in n){const G=n[F],W=C.isInstancedMesh===!0?C.id:0,N=G[W];if(N!==void 0){for(const B in N){const V=N[B];for(const Q in V)h(V[Q].object),delete V[Q];delete N[B]}delete G[W],Object.keys(G).length===0&&delete n[F]}}}function w(){P(),a=!0,r!==i&&(r=i,c(r.object))}function P(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:o,reset:w,resetDefaultState:P,dispose:A,releaseStatesOfGeometry:T,releaseStatesOfObject:M,releaseStatesOfProgram:R,initAttributes:x,enableAttribute:m,disableUnusedAttributes:v}}function pg(s,e,t){let n;function i(l){n=l}function r(l,c){s.drawArrays(n,l,c),t.update(c,n,1)}function a(l,c,h){h!==0&&(s.drawArraysInstanced(n,l,c,h),t.update(c,n,h))}function o(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let u=0;for(let f=0;f<h;f++)u+=c[f];t.update(u,n,1)}this.setMode=i,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function mg(s,e,t,n){let i;function r(){if(i!==void 0)return i;if(e.has("EXT_texture_filter_anisotropic")===!0){const R=e.get("EXT_texture_filter_anisotropic");i=s.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function a(R){return!(R!==Zt&&n.convert(R)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){const M=R===Nn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(R!==Wt&&n.convert(R)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==Kt&&!M)}function l(R){if(R==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const h=l(c);h!==c&&(Se("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const d=t.logarithmicDepthBuffer===!0,u=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&u===!1&&Se("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const f=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),g=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=s.getParameter(s.MAX_TEXTURE_SIZE),m=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),p=s.getParameter(s.MAX_VERTEX_ATTRIBS),v=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),S=s.getParameter(s.MAX_VARYING_VECTORS),b=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),A=s.getParameter(s.MAX_SAMPLES),T=s.getParameter(s.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:u,maxTextures:f,maxVertexTextures:g,maxTextureSize:x,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:v,maxVaryings:S,maxFragmentUniforms:b,maxSamples:A,samples:T}}function gg(s){const e=this;let t=null,n=0,i=!1,r=!1;const a=new ai,o=new De,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,u){const f=d.length!==0||u||n!==0||i;return i=u,n=d.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(d,u){t=h(d,u,0)},this.setState=function(d,u,f){const g=d.clippingPlanes,x=d.clipIntersection,m=d.clipShadows,p=s.get(d);if(!i||g===null||g.length===0||r&&!m)r?h(null):c();else{const v=r?0:n,S=v*4;let b=p.clippingState||null;l.value=b,b=h(g,u,S,f);for(let A=0;A!==S;++A)b[A]=t[A];p.clippingState=b,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=v}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(d,u,f,g){const x=d!==null?d.length:0;let m=null;if(x!==0){if(m=l.value,g!==!0||m===null){const p=f+x*4,v=u.matrixWorldInverse;o.getNormalMatrix(v),(m===null||m.length<p)&&(m=new Float32Array(p));for(let S=0,b=f;S!==x;++S,b+=4)a.copy(d[S]).applyMatrix4(v,o),a.normal.toArray(m,b),m[b+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,m}}const Zn=4,ql=[.125,.215,.35,.446,.526,.582],li=20,xg=256,as=new Sr,Yl=new Ce;let ra=null,aa=0,oa=0,la=!1;const _g=new U;class jl{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,i=100,r={}){const{size:a=256,position:o=_g}=r;ra=this._renderer.getRenderTarget(),aa=this._renderer.getActiveCubeFace(),oa=this._renderer.getActiveMipmapLevel(),la=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,i,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=$l(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Zl(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(ra,aa,oa),this._renderer.xr.enabled=la,e.scissorTest=!1,Pi(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===hi||e.mapping===Bi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),ra=this._renderer.getRenderTarget(),aa=this._renderer.getActiveCubeFace(),oa=this._renderer.getActiveMipmapLevel(),la=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Tt,minFilter:Tt,generateMipmaps:!1,type:Nn,format:Zt,colorSpace:Xt,depthBuffer:!1},i=Kl(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Kl(e,t,n);const{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=vg(r)),this._blurMaterial=Sg(r,e,t),this._ggxMaterial=Mg(r,e,t)}return i}_compileMaterial(e){const t=new kt(new Ot,e);this._renderer.compile(t,as)}_sceneToCubeUV(e,t,n,i,r){const l=new Ut(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],d=this._renderer,u=d.autoClear,f=d.toneMapping;d.getClearColor(Yl),d.toneMapping=mn,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(i),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new kt(new Xi,new Kn({name:"PMREM.Background",side:Bt,depthWrite:!1,depthTest:!1})));const x=this._backgroundBox,m=x.material;let p=!1;const v=e.background;v?v.isColor&&(m.color.copy(v),e.background=null,p=!0):(m.color.copy(Yl),p=!0);for(let S=0;S<6;S++){const b=S%3;b===0?(l.up.set(0,c[S],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[S],r.y,r.z)):b===1?(l.up.set(0,0,c[S]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[S],r.z)):(l.up.set(0,c[S],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[S]));const A=this._cubeSize;Pi(i,b*A,S>2?A:0,A,A),d.setRenderTarget(i),p&&d.render(x,l),d.render(e,l)}d.toneMapping=f,d.autoClear=u,e.background=v}_textureToCubeUV(e,t){const n=this._renderer,i=e.mapping===hi||e.mapping===Bi;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=$l()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Zl());const r=i?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;const o=r.uniforms;o.envMap.value=e;const l=this._cubeSize;Pi(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,as)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const i=this._lodMeshes.length;for(let r=1;r<i;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){const i=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;const l=a.uniforms,c=n/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),d=Math.sqrt(c*c-h*h),u=0+c*1.25,f=d*u,{_lodMax:g}=this,x=this._sizeLods[n],m=3*x*(n>g-Zn?n-g+Zn:0),p=4*(this._cubeSize-x);l.envMap.value=e.texture,l.roughness.value=f,l.mipInt.value=g-t,Pi(r,m,p,3*x,2*x),i.setRenderTarget(r),i.render(o,as),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=g-n,Pi(e,m,p,3*x,2*x),i.setRenderTarget(e),i.render(o,as)}_blur(e,t,n,i,r){const a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,i,"latitudinal",r),this._halfBlur(a,e,n,n,i,"longitudinal",r)}_halfBlur(e,t,n,i,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&Ae("blur direction must be either latitudinal or longitudinal!");const h=3,d=this._lodMeshes[i];d.material=c;const u=c.uniforms,f=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*li-1),x=r/g,m=isFinite(r)?1+Math.floor(h*x):li;m>li&&Se(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${li}`);const p=[];let v=0;for(let R=0;R<li;++R){const M=R/x,w=Math.exp(-M*M/2);p.push(w),R===0?v+=w:R<m&&(v+=2*w)}for(let R=0;R<p.length;R++)p[R]=p[R]/v;u.envMap.value=e.texture,u.samples.value=m,u.weights.value=p,u.latitudinal.value=a==="latitudinal",o&&(u.poleAxis.value=o);const{_lodMax:S}=this;u.dTheta.value=g,u.mipInt.value=S-n;const b=this._sizeLods[i],A=3*b*(i>S-Zn?i-S+Zn:0),T=4*(this._cubeSize-b);Pi(t,A,T,3*b,2*b),l.setRenderTarget(t),l.render(d,as)}}function vg(s){const e=[],t=[],n=[];let i=s;const r=s-Zn+1+ql.length;for(let a=0;a<r;a++){const o=Math.pow(2,i);e.push(o);let l=1/o;a>s-Zn?l=ql[a-s+Zn-1]:a===0&&(l=0),t.push(l);const c=1/(o-2),h=-c,d=1+c,u=[h,h,d,h,d,d,h,h,d,d,h,d],f=6,g=6,x=3,m=2,p=1,v=new Float32Array(x*g*f),S=new Float32Array(m*g*f),b=new Float32Array(p*g*f);for(let T=0;T<f;T++){const R=T%3*2/3-1,M=T>2?0:-1,w=[R,M,0,R+2/3,M,0,R+2/3,M+1,0,R,M,0,R+2/3,M+1,0,R,M+1,0];v.set(w,x*g*T),S.set(u,m*g*T);const P=[T,T,T,T,T,T];b.set(P,p*g*T)}const A=new Ot;A.setAttribute("position",new Ft(v,x)),A.setAttribute("uv",new Ft(S,m)),A.setAttribute("faceIndex",new Ft(b,p)),n.push(new kt(A,null)),i>Zn&&i--}return{lodMeshes:n,sizeLods:e,sigmas:t}}function Kl(s,e,t){const n=new rn(s,e,t);return n.texture.mapping=xr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Pi(s,e,t,n,i){s.viewport.set(e,t,n,i),s.scissor.set(e,t,n,i)}function Mg(s,e,t){return new _n({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:xg,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:yr(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Pn,depthTest:!1,depthWrite:!1})}function Sg(s,e,t){const n=new Float32Array(li),i=new U(0,1,0);return new _n({name:"SphericalGaussianBlur",defines:{n:li,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:yr(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Pn,depthTest:!1,depthWrite:!1})}function Zl(){return new _n({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:yr(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Pn,depthTest:!1,depthWrite:!1})}function $l(){return new _n({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:yr(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Pn,depthTest:!1,depthWrite:!1})}function yr(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}class _h extends rn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new lh(i),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new Xi(5,5,5),r=new _n({name:"CubemapFromEquirect",uniforms:Vi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Bt,blending:Pn});r.uniforms.tEquirect.value=t;const a=new kt(i,r),o=t.minFilter;return t.minFilter===Cn&&(t.minFilter=Tt),new _f(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,i=!0){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,i);e.setRenderTarget(r)}}function yg(s){let e=new WeakMap,t=new WeakMap,n=null;function i(u,f=!1){return u==null?null:f?a(u):r(u)}function r(u){if(u&&u.isTexture){const f=u.mapping;if(f===Cr||f===Lr)if(e.has(u)){const g=e.get(u).texture;return o(g,u.mapping)}else{const g=u.image;if(g&&g.height>0){const x=new _h(g.height);return x.fromEquirectangularTexture(s,u),e.set(u,x),u.addEventListener("dispose",c),o(x.texture,u.mapping)}else return null}}return u}function a(u){if(u&&u.isTexture){const f=u.mapping,g=f===Cr||f===Lr,x=f===hi||f===Bi;if(g||x){let m=t.get(u);const p=m!==void 0?m.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==p)return n===null&&(n=new jl(s)),m=g?n.fromEquirectangular(u,m):n.fromCubemap(u,m),m.texture.pmremVersion=u.pmremVersion,t.set(u,m),m.texture;if(m!==void 0)return m.texture;{const v=u.image;return g&&v&&v.height>0||x&&v&&l(v)?(n===null&&(n=new jl(s)),m=g?n.fromEquirectangular(u):n.fromCubemap(u),m.texture.pmremVersion=u.pmremVersion,t.set(u,m),u.addEventListener("dispose",h),m.texture):null}}}return u}function o(u,f){return f===Cr?u.mapping=hi:f===Lr&&(u.mapping=Bi),u}function l(u){let f=0;const g=6;for(let x=0;x<g;x++)u[x]!==void 0&&f++;return f===g}function c(u){const f=u.target;f.removeEventListener("dispose",c);const g=e.get(f);g!==void 0&&(e.delete(f),g.dispose())}function h(u){const f=u.target;f.removeEventListener("dispose",h);const g=t.get(f);g!==void 0&&(t.delete(f),g.dispose())}function d(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:i,dispose:d}}function bg(s){const e={};function t(n){if(e[n]!==void 0)return e[n];const i=s.getExtension(n);return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const i=t(n);return i===null&&io("WebGLRenderer: "+n+" extension not supported."),i}}}function Tg(s,e,t,n){const i={},r=new WeakMap;function a(d){const u=d.target;u.index!==null&&e.remove(u.index);for(const g in u.attributes)e.remove(u.attributes[g]);u.removeEventListener("dispose",a),delete i[u.id];const f=r.get(u);f&&(e.remove(f),r.delete(u)),n.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,t.memory.geometries--}function o(d,u){return i[u.id]===!0||(u.addEventListener("dispose",a),i[u.id]=!0,t.memory.geometries++),u}function l(d){const u=d.attributes;for(const f in u)e.update(u[f],s.ARRAY_BUFFER)}function c(d){const u=[],f=d.index,g=d.attributes.position;let x=0;if(g===void 0)return;if(f!==null){const v=f.array;x=f.version;for(let S=0,b=v.length;S<b;S+=3){const A=v[S+0],T=v[S+1],R=v[S+2];u.push(A,T,T,R,R,A)}}else{const v=g.array;x=g.version;for(let S=0,b=v.length/3-1;S<b;S+=3){const A=S+0,T=S+1,R=S+2;u.push(A,T,T,R,R,A)}}const m=new(g.count>=65535?ih:nh)(u,1);m.version=x;const p=r.get(d);p&&e.remove(p),r.set(d,m)}function h(d){const u=r.get(d);if(u){const f=d.index;f!==null&&u.version<f.version&&c(d)}else c(d);return r.get(d)}return{get:o,update:l,getWireframeAttribute:h}}function Eg(s,e,t){let n;function i(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,u){s.drawElements(n,u,r,d*a),t.update(u,n,1)}function c(d,u,f){f!==0&&(s.drawElementsInstanced(n,u,r,d*a,f),t.update(u,n,f))}function h(d,u,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,r,d,0,f);let x=0;for(let m=0;m<f;m++)x+=u[m];t.update(x,n,1)}this.setMode=i,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function wg(s){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case s.TRIANGLES:t.triangles+=o*(r/3);break;case s.LINES:t.lines+=o*(r/2);break;case s.LINE_STRIP:t.lines+=o*(r-1);break;case s.LINE_LOOP:t.lines+=o*r;break;case s.POINTS:t.points+=o*r;break;default:Ae("WebGLInfo: Unknown draw mode:",a);break}}function i(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:i,update:n}}function Ag(s,e,t){const n=new WeakMap,i=new st;function r(a,o,l){const c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,d=h!==void 0?h.length:0;let u=n.get(o);if(u===void 0||u.count!==d){let w=function(){R.dispose(),n.delete(o),o.removeEventListener("dispose",w)};u!==void 0&&u.texture.dispose();const f=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,x=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],p=o.morphAttributes.normal||[],v=o.morphAttributes.color||[];let S=0;f===!0&&(S=1),g===!0&&(S=2),x===!0&&(S=3);let b=o.attributes.position.count*S,A=1;b>e.maxTextureSize&&(A=Math.ceil(b/e.maxTextureSize),b=e.maxTextureSize);const T=new Float32Array(b*A*4*d),R=new Qc(T,b,A,d);R.type=Kt,R.needsUpdate=!0;const M=S*4;for(let P=0;P<d;P++){const C=m[P],F=p[P],G=v[P],W=b*A*4*P;for(let N=0;N<C.count;N++){const B=N*M;f===!0&&(i.fromBufferAttribute(C,N),T[W+B+0]=i.x,T[W+B+1]=i.y,T[W+B+2]=i.z,T[W+B+3]=0),g===!0&&(i.fromBufferAttribute(F,N),T[W+B+4]=i.x,T[W+B+5]=i.y,T[W+B+6]=i.z,T[W+B+7]=0),x===!0&&(i.fromBufferAttribute(G,N),T[W+B+8]=i.x,T[W+B+9]=i.y,T[W+B+10]=i.z,T[W+B+11]=G.itemSize===4?i.w:1)}}u={count:d,texture:R,size:new qe(b,A)},n.set(o,u),o.addEventListener("dispose",w)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(s,"morphTexture",a.morphTexture,t);else{let f=0;for(let x=0;x<c.length;x++)f+=c[x];const g=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(s,"morphTargetBaseInfluence",g),l.getUniforms().setValue(s,"morphTargetInfluences",c)}l.getUniforms().setValue(s,"morphTargetsTexture",u.texture,t),l.getUniforms().setValue(s,"morphTargetsTextureSize",u.size)}return{update:r}}function Rg(s,e,t,n,i){let r=new WeakMap;function a(c){const h=i.render.frame,d=c.geometry,u=e.get(c,d);if(r.get(u)!==h&&(e.update(u),r.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(t.update(c.instanceMatrix,s.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,s.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){const f=c.skeleton;r.get(f)!==h&&(f.update(),r.set(f,h))}return u}function o(){r=new WeakMap}function l(c){const h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:a,dispose:o}}const Cg={[Fc]:"LINEAR_TONE_MAPPING",[Oc]:"REINHARD_TONE_MAPPING",[Bc]:"CINEON_TONE_MAPPING",[kc]:"ACES_FILMIC_TONE_MAPPING",[Vc]:"AGX_TONE_MAPPING",[Hc]:"NEUTRAL_TONE_MAPPING",[zc]:"CUSTOM_TONE_MAPPING"};function Lg(s,e,t,n,i){const r=new rn(e,t,{type:s,depthBuffer:n,stencilBuffer:i,depthTexture:n?new zi(e,t):void 0}),a=new rn(e,t,{type:Nn,depthBuffer:!1,stencilBuffer:!1}),o=new Ot;o.setAttribute("position",new Mt([-1,3,0,-1,-1,0,3,-1,0],3)),o.setAttribute("uv",new Mt([0,2,0,0,2,0],2));const l=new qd({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),c=new kt(o,l),h=new Sr(-1,1,1,-1,0,1);let d=null,u=null,f=!1,g,x=null,m=[],p=!1;this.setSize=function(v,S){r.setSize(v,S),a.setSize(v,S);for(let b=0;b<m.length;b++){const A=m[b];A.setSize&&A.setSize(v,S)}},this.setEffects=function(v){m=v,p=m.length>0&&m[0].isRenderPass===!0;const S=r.width,b=r.height;for(let A=0;A<m.length;A++){const T=m[A];T.setSize&&T.setSize(S,b)}},this.begin=function(v,S){if(f||v.toneMapping===mn&&m.length===0)return!1;if(x=S,S!==null){const b=S.width,A=S.height;(r.width!==b||r.height!==A)&&this.setSize(b,A)}return p===!1&&v.setRenderTarget(r),g=v.toneMapping,v.toneMapping=mn,!0},this.hasRenderPass=function(){return p},this.end=function(v,S){v.toneMapping=g,f=!0;let b=r,A=a;for(let T=0;T<m.length;T++){const R=m[T];if(R.enabled!==!1&&(R.render(v,A,b,S),R.needsSwap!==!1)){const M=b;b=A,A=M}}if(d!==v.outputColorSpace||u!==v.toneMapping){d=v.outputColorSpace,u=v.toneMapping,l.defines={},He.getTransfer(d)===$e&&(l.defines.SRGB_TRANSFER="");const T=Cg[u];T&&(l.defines[T]=""),l.needsUpdate=!0}l.uniforms.tDiffuse.value=b.texture,v.setRenderTarget(x),v.render(c,h),x=null,f=!1},this.isCompositing=function(){return f},this.dispose=function(){r.depthTexture&&r.depthTexture.dispose(),r.dispose(),a.dispose(),o.dispose(),l.dispose()}}const vh=new Et,ao=new zi(1,1),Mh=new Qc,Sh=new md,yh=new lh,Jl=[],Ql=[],ec=new Float32Array(16),tc=new Float32Array(9),nc=new Float32Array(4);function Zi(s,e,t){const n=s[0];if(n<=0||n>0)return s;const i=e*t;let r=Jl[i];if(r===void 0&&(r=new Float32Array(i),Jl[i]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,s[a].toArray(r,o)}return r}function wt(s,e){if(s.length!==e.length)return!1;for(let t=0,n=s.length;t<n;t++)if(s[t]!==e[t])return!1;return!0}function At(s,e){for(let t=0,n=e.length;t<n;t++)s[t]=e[t]}function br(s,e){let t=Ql[e];t===void 0&&(t=new Int32Array(e),Ql[e]=t);for(let n=0;n!==e;++n)t[n]=s.allocateTextureUnit();return t}function Pg(s,e){const t=this.cache;t[0]!==e&&(s.uniform1f(this.addr,e),t[0]=e)}function Dg(s,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(wt(t,e))return;s.uniform2fv(this.addr,e),At(t,e)}}function Ig(s,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(s.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(wt(t,e))return;s.uniform3fv(this.addr,e),At(t,e)}}function Ng(s,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(wt(t,e))return;s.uniform4fv(this.addr,e),At(t,e)}}function Ug(s,e){const t=this.cache,n=e.elements;if(n===void 0){if(wt(t,e))return;s.uniformMatrix2fv(this.addr,!1,e),At(t,e)}else{if(wt(t,n))return;nc.set(n),s.uniformMatrix2fv(this.addr,!1,nc),At(t,n)}}function Fg(s,e){const t=this.cache,n=e.elements;if(n===void 0){if(wt(t,e))return;s.uniformMatrix3fv(this.addr,!1,e),At(t,e)}else{if(wt(t,n))return;tc.set(n),s.uniformMatrix3fv(this.addr,!1,tc),At(t,n)}}function Og(s,e){const t=this.cache,n=e.elements;if(n===void 0){if(wt(t,e))return;s.uniformMatrix4fv(this.addr,!1,e),At(t,e)}else{if(wt(t,n))return;ec.set(n),s.uniformMatrix4fv(this.addr,!1,ec),At(t,n)}}function Bg(s,e){const t=this.cache;t[0]!==e&&(s.uniform1i(this.addr,e),t[0]=e)}function kg(s,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(wt(t,e))return;s.uniform2iv(this.addr,e),At(t,e)}}function zg(s,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(wt(t,e))return;s.uniform3iv(this.addr,e),At(t,e)}}function Vg(s,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(wt(t,e))return;s.uniform4iv(this.addr,e),At(t,e)}}function Hg(s,e){const t=this.cache;t[0]!==e&&(s.uniform1ui(this.addr,e),t[0]=e)}function Gg(s,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(wt(t,e))return;s.uniform2uiv(this.addr,e),At(t,e)}}function Wg(s,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(wt(t,e))return;s.uniform3uiv(this.addr,e),At(t,e)}}function Xg(s,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(wt(t,e))return;s.uniform4uiv(this.addr,e),At(t,e)}}function qg(s,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);let r;this.type===s.SAMPLER_2D_SHADOW?(ao.compareFunction=t.isReversedDepthBuffer()?yo:So,r=ao):r=vh,t.setTexture2D(e||r,i)}function Yg(s,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||Sh,i)}function jg(s,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTextureCube(e||yh,i)}function Kg(s,e,t){const n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||Mh,i)}function Zg(s){switch(s){case 5126:return Pg;case 35664:return Dg;case 35665:return Ig;case 35666:return Ng;case 35674:return Ug;case 35675:return Fg;case 35676:return Og;case 5124:case 35670:return Bg;case 35667:case 35671:return kg;case 35668:case 35672:return zg;case 35669:case 35673:return Vg;case 5125:return Hg;case 36294:return Gg;case 36295:return Wg;case 36296:return Xg;case 35678:case 36198:case 36298:case 36306:case 35682:return qg;case 35679:case 36299:case 36307:return Yg;case 35680:case 36300:case 36308:case 36293:return jg;case 36289:case 36303:case 36311:case 36292:return Kg}}function $g(s,e){s.uniform1fv(this.addr,e)}function Jg(s,e){const t=Zi(e,this.size,2);s.uniform2fv(this.addr,t)}function Qg(s,e){const t=Zi(e,this.size,3);s.uniform3fv(this.addr,t)}function e0(s,e){const t=Zi(e,this.size,4);s.uniform4fv(this.addr,t)}function t0(s,e){const t=Zi(e,this.size,4);s.uniformMatrix2fv(this.addr,!1,t)}function n0(s,e){const t=Zi(e,this.size,9);s.uniformMatrix3fv(this.addr,!1,t)}function i0(s,e){const t=Zi(e,this.size,16);s.uniformMatrix4fv(this.addr,!1,t)}function s0(s,e){s.uniform1iv(this.addr,e)}function r0(s,e){s.uniform2iv(this.addr,e)}function a0(s,e){s.uniform3iv(this.addr,e)}function o0(s,e){s.uniform4iv(this.addr,e)}function l0(s,e){s.uniform1uiv(this.addr,e)}function c0(s,e){s.uniform2uiv(this.addr,e)}function h0(s,e){s.uniform3uiv(this.addr,e)}function u0(s,e){s.uniform4uiv(this.addr,e)}function d0(s,e,t){const n=this.cache,i=e.length,r=br(t,i);wt(n,r)||(s.uniform1iv(this.addr,r),At(n,r));let a;this.type===s.SAMPLER_2D_SHADOW?a=ao:a=vh;for(let o=0;o!==i;++o)t.setTexture2D(e[o]||a,r[o])}function f0(s,e,t){const n=this.cache,i=e.length,r=br(t,i);wt(n,r)||(s.uniform1iv(this.addr,r),At(n,r));for(let a=0;a!==i;++a)t.setTexture3D(e[a]||Sh,r[a])}function p0(s,e,t){const n=this.cache,i=e.length,r=br(t,i);wt(n,r)||(s.uniform1iv(this.addr,r),At(n,r));for(let a=0;a!==i;++a)t.setTextureCube(e[a]||yh,r[a])}function m0(s,e,t){const n=this.cache,i=e.length,r=br(t,i);wt(n,r)||(s.uniform1iv(this.addr,r),At(n,r));for(let a=0;a!==i;++a)t.setTexture2DArray(e[a]||Mh,r[a])}function g0(s){switch(s){case 5126:return $g;case 35664:return Jg;case 35665:return Qg;case 35666:return e0;case 35674:return t0;case 35675:return n0;case 35676:return i0;case 5124:case 35670:return s0;case 35667:case 35671:return r0;case 35668:case 35672:return a0;case 35669:case 35673:return o0;case 5125:return l0;case 36294:return c0;case 36295:return h0;case 36296:return u0;case 35678:case 36198:case 36298:case 36306:case 35682:return d0;case 35679:case 36299:case 36307:return f0;case 35680:case 36300:case 36308:case 36293:return p0;case 36289:case 36303:case 36311:case 36292:return m0}}class x0{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Zg(t.type)}}class _0{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=g0(t.type)}}class v0{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const i=this.seq;for(let r=0,a=i.length;r!==a;++r){const o=i[r];o.setValue(e,t[o.id],n)}}}const ca=/(\w+)(\])?(\[|\.)?/g;function ic(s,e){s.seq.push(e),s.map[e.id]=e}function M0(s,e,t){const n=s.name,i=n.length;for(ca.lastIndex=0;;){const r=ca.exec(n),a=ca.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===i){ic(t,c===void 0?new x0(o,s,e):new _0(o,s,e));break}else{let d=t.map[o];d===void 0&&(d=new v0(o),ic(t,d)),t=d}}}class or{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){const o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);M0(o,l,this)}const i=[],r=[];for(const a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?i.push(a):r.push(a);i.length>0&&(this.seq=i.concat(r))}setValue(e,t,n,i){const r=this.map[t];r!==void 0&&r.setValue(e,n,i)}setOptional(e,t,n){const i=t[n];i!==void 0&&this.setValue(e,n,i)}static upload(e,t,n,i){for(let r=0,a=t.length;r!==a;++r){const o=t[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,i)}}static seqWithValue(e,t){const n=[];for(let i=0,r=e.length;i!==r;++i){const a=e[i];a.id in t&&n.push(a)}return n}}function sc(s,e,t){const n=s.createShader(e);return s.shaderSource(n,t),s.compileShader(n),n}const S0=37297;let y0=0;function b0(s,e){const t=s.split(`
`),n=[],i=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=i;a<r;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}const rc=new De;function T0(s){He._getMatrix(rc,He.workingColorSpace,s);const e=`mat3( ${rc.elements.map(t=>t.toFixed(4))} )`;switch(He.getTransfer(s)){case ur:return[e,"LinearTransferOETF"];case $e:return[e,"sRGBTransferOETF"];default:return Se("WebGLProgram: Unsupported color space: ",s),[e,"LinearTransferOETF"]}}function ac(s,e,t){const n=s.getShaderParameter(e,s.COMPILE_STATUS),r=(s.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";const a=/ERROR: 0:(\d+)/.exec(r);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+b0(s.getShaderSource(e),o)}else return r}function E0(s,e){const t=T0(e);return[`vec4 ${s}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const w0={[Fc]:"Linear",[Oc]:"Reinhard",[Bc]:"Cineon",[kc]:"ACESFilmic",[Vc]:"AgX",[Hc]:"Neutral",[zc]:"Custom"};function A0(s,e){const t=w0[e];return t===void 0?(Se("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+s+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+s+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const er=new U;function R0(){He.getLuminanceCoefficients(er);const s=er.x.toFixed(4),e=er.y.toFixed(4),t=er.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${s}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function C0(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",s.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ds).join(`
`)}function L0(s){const e=[];for(const t in s){const n=s[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function P0(s,e){const t={},n=s.getProgramParameter(e,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){const r=s.getActiveAttrib(e,i),a=r.name;let o=1;r.type===s.FLOAT_MAT2&&(o=2),r.type===s.FLOAT_MAT3&&(o=3),r.type===s.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:s.getAttribLocation(e,a),locationSize:o}}return t}function ds(s){return s!==""}function oc(s,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function lc(s,e){return s.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const D0=/^[ \t]*#include +<([\w\d./]+)>/gm;function oo(s){return s.replace(D0,N0)}const I0=new Map;function N0(s,e){let t=Oe[e];if(t===void 0){const n=I0.get(e);if(n!==void 0)t=Oe[n],Se('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return oo(t)}const U0=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function cc(s){return s.replace(U0,F0)}function F0(s,e,t,n){let i="";for(let r=parseInt(e);r<parseInt(t);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function hc(s){let e=`precision ${s.precision} float;
	precision ${s.precision} int;
	precision ${s.precision} sampler2D;
	precision ${s.precision} samplerCube;
	precision ${s.precision} sampler3D;
	precision ${s.precision} sampler2DArray;
	precision ${s.precision} sampler2DShadow;
	precision ${s.precision} samplerCubeShadow;
	precision ${s.precision} sampler2DArrayShadow;
	precision ${s.precision} isampler2D;
	precision ${s.precision} isampler3D;
	precision ${s.precision} isamplerCube;
	precision ${s.precision} isampler2DArray;
	precision ${s.precision} usampler2D;
	precision ${s.precision} usampler3D;
	precision ${s.precision} usamplerCube;
	precision ${s.precision} usampler2DArray;
	`;return s.precision==="highp"?e+=`
#define HIGH_PRECISION`:s.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}const O0={[tr]:"SHADOWMAP_TYPE_PCF",[hs]:"SHADOWMAP_TYPE_VSM"};function B0(s){return O0[s.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const k0={[hi]:"ENVMAP_TYPE_CUBE",[Bi]:"ENVMAP_TYPE_CUBE",[xr]:"ENVMAP_TYPE_CUBE_UV"};function z0(s){return s.envMap===!1?"ENVMAP_TYPE_CUBE":k0[s.envMapMode]||"ENVMAP_TYPE_CUBE"}const V0={[Bi]:"ENVMAP_MODE_REFRACTION"};function H0(s){return s.envMap===!1?"ENVMAP_MODE_REFLECTION":V0[s.envMapMode]||"ENVMAP_MODE_REFLECTION"}const G0={[Uc]:"ENVMAP_BLENDING_MULTIPLY",[Cu]:"ENVMAP_BLENDING_MIX",[Lu]:"ENVMAP_BLENDING_ADD"};function W0(s){return s.envMap===!1?"ENVMAP_BLENDING_NONE":G0[s.combine]||"ENVMAP_BLENDING_NONE"}function X0(s){const e=s.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function q0(s,e,t,n){const i=s.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=B0(t),c=z0(t),h=H0(t),d=W0(t),u=X0(t),f=C0(t),g=L0(r),x=i.createProgram();let m,p,v=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(ds).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(ds).join(`
`),p.length>0&&(p+=`
`)):(m=[hc(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ds).join(`
`),p=[hc(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+d:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==mn?"#define TONE_MAPPING":"",t.toneMapping!==mn?Oe.tonemapping_pars_fragment:"",t.toneMapping!==mn?A0("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Oe.colorspace_pars_fragment,E0("linearToOutputTexel",t.outputColorSpace),R0(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ds).join(`
`)),a=oo(a),a=oc(a,t),a=lc(a,t),o=oo(o),o=oc(o,t),o=lc(o,t),a=cc(a),o=cc(o),t.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",t.glslVersion===ol?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===ol?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const S=v+m+a,b=v+p+o,A=sc(i,i.VERTEX_SHADER,S),T=sc(i,i.FRAGMENT_SHADER,b);i.attachShader(x,A),i.attachShader(x,T),t.index0AttributeName!==void 0?i.bindAttribLocation(x,0,t.index0AttributeName):t.morphTargets===!0&&i.bindAttribLocation(x,0,"position"),i.linkProgram(x);function R(C){if(s.debug.checkShaderErrors){const F=i.getProgramInfoLog(x)||"",G=i.getShaderInfoLog(A)||"",W=i.getShaderInfoLog(T)||"",N=F.trim(),B=G.trim(),V=W.trim();let Q=!0,ee=!0;if(i.getProgramParameter(x,i.LINK_STATUS)===!1)if(Q=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,x,A,T);else{const he=ac(i,A,"vertex"),ve=ac(i,T,"fragment");Ae("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(x,i.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+N+`
`+he+`
`+ve)}else N!==""?Se("WebGLProgram: Program Info Log:",N):(B===""||V==="")&&(ee=!1);ee&&(C.diagnostics={runnable:Q,programLog:N,vertexShader:{log:B,prefix:m},fragmentShader:{log:V,prefix:p}})}i.deleteShader(A),i.deleteShader(T),M=new or(i,x),w=P0(i,x)}let M;this.getUniforms=function(){return M===void 0&&R(this),M};let w;this.getAttributes=function(){return w===void 0&&R(this),w};let P=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return P===!1&&(P=i.getProgramParameter(x,S0)),P},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=y0++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=A,this.fragmentShader=T,this}let Y0=0;class j0{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,i=this._getShaderStage(t),r=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new K0(e),t.set(e,n)),n}}class K0{constructor(e){this.id=Y0++,this.code=e,this.usedTimes=0}}function Z0(s){return s===di||s===cr||s===hr}function $0(s,e,t,n,i,r){const a=new eh,o=new j0,l=new Set,c=[],h=new Map,d=n.logarithmicDepthBuffer;let u=n.precision;const f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(M){return l.add(M),M===0?"uv":`uv${M}`}function x(M,w,P,C,F,G){const W=C.fog,N=F.geometry,B=M.isMeshStandardMaterial||M.isMeshLambertMaterial||M.isMeshPhongMaterial?C.environment:null,V=M.isMeshStandardMaterial||M.isMeshLambertMaterial&&!M.envMap||M.isMeshPhongMaterial&&!M.envMap,Q=e.get(M.envMap||B,V),ee=Q&&Q.mapping===xr?Q.image.height:null,he=f[M.type];M.precision!==null&&(u=n.getMaxPrecision(M.precision),u!==M.precision&&Se("WebGLProgram.getParameters:",M.precision,"not supported, using",u,"instead."));const ve=N.morphAttributes.position||N.morphAttributes.normal||N.morphAttributes.color,Te=ve!==void 0?ve.length:0;let Ye=0;N.morphAttributes.position!==void 0&&(Ye=1),N.morphAttributes.normal!==void 0&&(Ye=2),N.morphAttributes.color!==void 0&&(Ye=3);let et,Ue,Z,fe;if(he){const Ie=dn[he];et=Ie.vertexShader,Ue=Ie.fragmentShader}else et=M.vertexShader,Ue=M.fragmentShader,o.update(M),Z=o.getVertexShaderID(M),fe=o.getFragmentShaderID(M);const se=s.getRenderTarget(),we=s.state.buffers.depth.getReversed(),Pe=F.isInstancedMesh===!0,Re=F.isBatchedMesh===!0,ut=!!M.map,We=!!M.matcap,tt=!!Q,ct=!!M.aoMap,Ve=!!M.lightMap,St=!!M.bumpMap,dt=!!M.normalMap,zt=!!M.displacementMap,D=!!M.emissiveMap,yt=!!M.metalnessMap,Xe=!!M.roughnessMap,ot=M.anisotropy>0,le=M.clearcoat>0,ft=M.dispersion>0,E=M.iridescence>0,_=M.sheen>0,O=M.transmission>0,j=ot&&!!M.anisotropyMap,J=le&&!!M.clearcoatMap,te=le&&!!M.clearcoatNormalMap,oe=le&&!!M.clearcoatRoughnessMap,q=E&&!!M.iridescenceMap,K=E&&!!M.iridescenceThicknessMap,pe=_&&!!M.sheenColorMap,xe=_&&!!M.sheenRoughnessMap,re=!!M.specularMap,ne=!!M.specularColorMap,Le=!!M.specularIntensityMap,Fe=O&&!!M.transmissionMap,Ke=O&&!!M.thicknessMap,L=!!M.gradientMap,ie=!!M.alphaMap,Y=M.alphaTest>0,me=!!M.alphaHash,ae=!!M.extensions;let $=mn;M.toneMapped&&(se===null||se.isXRRenderTarget===!0)&&($=s.toneMapping);const ye={shaderID:he,shaderType:M.type,shaderName:M.name,vertexShader:et,fragmentShader:Ue,defines:M.defines,customVertexShaderID:Z,customFragmentShaderID:fe,isRawShaderMaterial:M.isRawShaderMaterial===!0,glslVersion:M.glslVersion,precision:u,batching:Re,batchingColor:Re&&F._colorsTexture!==null,instancing:Pe,instancingColor:Pe&&F.instanceColor!==null,instancingMorph:Pe&&F.morphTexture!==null,outputColorSpace:se===null?s.outputColorSpace:se.isXRRenderTarget===!0?se.texture.colorSpace:He.workingColorSpace,alphaToCoverage:!!M.alphaToCoverage,map:ut,matcap:We,envMap:tt,envMapMode:tt&&Q.mapping,envMapCubeUVHeight:ee,aoMap:ct,lightMap:Ve,bumpMap:St,normalMap:dt,displacementMap:zt,emissiveMap:D,normalMapObjectSpace:dt&&M.normalMapType===Uu,normalMapTangentSpace:dt&&M.normalMapType===to,packedNormalMap:dt&&M.normalMapType===to&&Z0(M.normalMap.format),metalnessMap:yt,roughnessMap:Xe,anisotropy:ot,anisotropyMap:j,clearcoat:le,clearcoatMap:J,clearcoatNormalMap:te,clearcoatRoughnessMap:oe,dispersion:ft,iridescence:E,iridescenceMap:q,iridescenceThicknessMap:K,sheen:_,sheenColorMap:pe,sheenRoughnessMap:xe,specularMap:re,specularColorMap:ne,specularIntensityMap:Le,transmission:O,transmissionMap:Fe,thicknessMap:Ke,gradientMap:L,opaque:M.transparent===!1&&M.blending===Ii&&M.alphaToCoverage===!1,alphaMap:ie,alphaTest:Y,alphaHash:me,combine:M.combine,mapUv:ut&&g(M.map.channel),aoMapUv:ct&&g(M.aoMap.channel),lightMapUv:Ve&&g(M.lightMap.channel),bumpMapUv:St&&g(M.bumpMap.channel),normalMapUv:dt&&g(M.normalMap.channel),displacementMapUv:zt&&g(M.displacementMap.channel),emissiveMapUv:D&&g(M.emissiveMap.channel),metalnessMapUv:yt&&g(M.metalnessMap.channel),roughnessMapUv:Xe&&g(M.roughnessMap.channel),anisotropyMapUv:j&&g(M.anisotropyMap.channel),clearcoatMapUv:J&&g(M.clearcoatMap.channel),clearcoatNormalMapUv:te&&g(M.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:oe&&g(M.clearcoatRoughnessMap.channel),iridescenceMapUv:q&&g(M.iridescenceMap.channel),iridescenceThicknessMapUv:K&&g(M.iridescenceThicknessMap.channel),sheenColorMapUv:pe&&g(M.sheenColorMap.channel),sheenRoughnessMapUv:xe&&g(M.sheenRoughnessMap.channel),specularMapUv:re&&g(M.specularMap.channel),specularColorMapUv:ne&&g(M.specularColorMap.channel),specularIntensityMapUv:Le&&g(M.specularIntensityMap.channel),transmissionMapUv:Fe&&g(M.transmissionMap.channel),thicknessMapUv:Ke&&g(M.thicknessMap.channel),alphaMapUv:ie&&g(M.alphaMap.channel),vertexTangents:!!N.attributes.tangent&&(dt||ot),vertexNormals:!!N.attributes.normal,vertexColors:M.vertexColors,vertexAlphas:M.vertexColors===!0&&!!N.attributes.color&&N.attributes.color.itemSize===4,pointsUvs:F.isPoints===!0&&!!N.attributes.uv&&(ut||ie),fog:!!W,useFog:M.fog===!0,fogExp2:!!W&&W.isFogExp2,flatShading:M.wireframe===!1&&(M.flatShading===!0||N.attributes.normal===void 0&&dt===!1&&(M.isMeshLambertMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isMeshPhysicalMaterial)),sizeAttenuation:M.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:we,skinning:F.isSkinnedMesh===!0,morphTargets:N.morphAttributes.position!==void 0,morphNormals:N.morphAttributes.normal!==void 0,morphColors:N.morphAttributes.color!==void 0,morphTargetsCount:Te,morphTextureStride:Ye,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numLightProbeGrids:G.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:M.dithering,shadowMapEnabled:s.shadowMap.enabled&&P.length>0,shadowMapType:s.shadowMap.type,toneMapping:$,decodeVideoTexture:ut&&M.map.isVideoTexture===!0&&He.getTransfer(M.map.colorSpace)===$e,decodeVideoTextureEmissive:D&&M.emissiveMap.isVideoTexture===!0&&He.getTransfer(M.emissiveMap.colorSpace)===$e,premultipliedAlpha:M.premultipliedAlpha,doubleSided:M.side===en,flipSided:M.side===Bt,useDepthPacking:M.depthPacking>=0,depthPacking:M.depthPacking||0,index0AttributeName:M.index0AttributeName,extensionClipCullDistance:ae&&M.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ae&&M.extensions.multiDraw===!0||Re)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:M.customProgramCacheKey()};return ye.vertexUv1s=l.has(1),ye.vertexUv2s=l.has(2),ye.vertexUv3s=l.has(3),l.clear(),ye}function m(M){const w=[];if(M.shaderID?w.push(M.shaderID):(w.push(M.customVertexShaderID),w.push(M.customFragmentShaderID)),M.defines!==void 0)for(const P in M.defines)w.push(P),w.push(M.defines[P]);return M.isRawShaderMaterial===!1&&(p(w,M),v(w,M),w.push(s.outputColorSpace)),w.push(M.customProgramCacheKey),w.join()}function p(M,w){M.push(w.precision),M.push(w.outputColorSpace),M.push(w.envMapMode),M.push(w.envMapCubeUVHeight),M.push(w.mapUv),M.push(w.alphaMapUv),M.push(w.lightMapUv),M.push(w.aoMapUv),M.push(w.bumpMapUv),M.push(w.normalMapUv),M.push(w.displacementMapUv),M.push(w.emissiveMapUv),M.push(w.metalnessMapUv),M.push(w.roughnessMapUv),M.push(w.anisotropyMapUv),M.push(w.clearcoatMapUv),M.push(w.clearcoatNormalMapUv),M.push(w.clearcoatRoughnessMapUv),M.push(w.iridescenceMapUv),M.push(w.iridescenceThicknessMapUv),M.push(w.sheenColorMapUv),M.push(w.sheenRoughnessMapUv),M.push(w.specularMapUv),M.push(w.specularColorMapUv),M.push(w.specularIntensityMapUv),M.push(w.transmissionMapUv),M.push(w.thicknessMapUv),M.push(w.combine),M.push(w.fogExp2),M.push(w.sizeAttenuation),M.push(w.morphTargetsCount),M.push(w.morphAttributeCount),M.push(w.numDirLights),M.push(w.numPointLights),M.push(w.numSpotLights),M.push(w.numSpotLightMaps),M.push(w.numHemiLights),M.push(w.numRectAreaLights),M.push(w.numDirLightShadows),M.push(w.numPointLightShadows),M.push(w.numSpotLightShadows),M.push(w.numSpotLightShadowsWithMaps),M.push(w.numLightProbes),M.push(w.shadowMapType),M.push(w.toneMapping),M.push(w.numClippingPlanes),M.push(w.numClipIntersection),M.push(w.depthPacking)}function v(M,w){a.disableAll(),w.instancing&&a.enable(0),w.instancingColor&&a.enable(1),w.instancingMorph&&a.enable(2),w.matcap&&a.enable(3),w.envMap&&a.enable(4),w.normalMapObjectSpace&&a.enable(5),w.normalMapTangentSpace&&a.enable(6),w.clearcoat&&a.enable(7),w.iridescence&&a.enable(8),w.alphaTest&&a.enable(9),w.vertexColors&&a.enable(10),w.vertexAlphas&&a.enable(11),w.vertexUv1s&&a.enable(12),w.vertexUv2s&&a.enable(13),w.vertexUv3s&&a.enable(14),w.vertexTangents&&a.enable(15),w.anisotropy&&a.enable(16),w.alphaHash&&a.enable(17),w.batching&&a.enable(18),w.dispersion&&a.enable(19),w.batchingColor&&a.enable(20),w.gradientMap&&a.enable(21),w.packedNormalMap&&a.enable(22),w.vertexNormals&&a.enable(23),M.push(a.mask),a.disableAll(),w.fog&&a.enable(0),w.useFog&&a.enable(1),w.flatShading&&a.enable(2),w.logarithmicDepthBuffer&&a.enable(3),w.reversedDepthBuffer&&a.enable(4),w.skinning&&a.enable(5),w.morphTargets&&a.enable(6),w.morphNormals&&a.enable(7),w.morphColors&&a.enable(8),w.premultipliedAlpha&&a.enable(9),w.shadowMapEnabled&&a.enable(10),w.doubleSided&&a.enable(11),w.flipSided&&a.enable(12),w.useDepthPacking&&a.enable(13),w.dithering&&a.enable(14),w.transmission&&a.enable(15),w.sheen&&a.enable(16),w.opaque&&a.enable(17),w.pointsUvs&&a.enable(18),w.decodeVideoTexture&&a.enable(19),w.decodeVideoTextureEmissive&&a.enable(20),w.alphaToCoverage&&a.enable(21),w.numLightProbeGrids>0&&a.enable(22),M.push(a.mask)}function S(M){const w=f[M.type];let P;if(w){const C=dn[w];P=Gd.clone(C.uniforms)}else P=M.uniforms;return P}function b(M,w){let P=h.get(w);return P!==void 0?++P.usedTimes:(P=new q0(s,w,M,i),c.push(P),h.set(w,P)),P}function A(M){if(--M.usedTimes===0){const w=c.indexOf(M);c[w]=c[c.length-1],c.pop(),h.delete(M.cacheKey),M.destroy()}}function T(M){o.remove(M)}function R(){o.dispose()}return{getParameters:x,getProgramCacheKey:m,getUniforms:S,acquireProgram:b,releaseProgram:A,releaseShaderCache:T,programs:c,dispose:R}}function J0(){let s=new WeakMap;function e(a){return s.has(a)}function t(a){let o=s.get(a);return o===void 0&&(o={},s.set(a,o)),o}function n(a){s.delete(a)}function i(a,o,l){s.get(a)[o]=l}function r(){s=new WeakMap}return{has:e,get:t,remove:n,update:i,dispose:r}}function Q0(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.material.id!==e.material.id?s.material.id-e.material.id:s.materialVariant!==e.materialVariant?s.materialVariant-e.materialVariant:s.z!==e.z?s.z-e.z:s.id-e.id}function uc(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.z!==e.z?e.z-s.z:s.id-e.id}function dc(){const s=[];let e=0;const t=[],n=[],i=[];function r(){e=0,t.length=0,n.length=0,i.length=0}function a(u){let f=0;return u.isInstancedMesh&&(f+=2),u.isSkinnedMesh&&(f+=1),f}function o(u,f,g,x,m,p){let v=s[e];return v===void 0?(v={id:u.id,object:u,geometry:f,material:g,materialVariant:a(u),groupOrder:x,renderOrder:u.renderOrder,z:m,group:p},s[e]=v):(v.id=u.id,v.object=u,v.geometry=f,v.material=g,v.materialVariant=a(u),v.groupOrder=x,v.renderOrder=u.renderOrder,v.z=m,v.group=p),e++,v}function l(u,f,g,x,m,p){const v=o(u,f,g,x,m,p);g.transmission>0?n.push(v):g.transparent===!0?i.push(v):t.push(v)}function c(u,f,g,x,m,p){const v=o(u,f,g,x,m,p);g.transmission>0?n.unshift(v):g.transparent===!0?i.unshift(v):t.unshift(v)}function h(u,f){t.length>1&&t.sort(u||Q0),n.length>1&&n.sort(f||uc),i.length>1&&i.sort(f||uc)}function d(){for(let u=e,f=s.length;u<f;u++){const g=s[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:n,transparent:i,init:r,push:l,unshift:c,finish:d,sort:h}}function ex(){let s=new WeakMap;function e(n,i){const r=s.get(n);let a;return r===void 0?(a=new dc,s.set(n,[a])):i>=r.length?(a=new dc,r.push(a)):a=r[i],a}function t(){s=new WeakMap}return{get:e,dispose:t}}function tx(){const s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new U,color:new Ce};break;case"SpotLight":t={position:new U,direction:new U,color:new Ce,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new U,color:new Ce,distance:0,decay:0};break;case"HemisphereLight":t={direction:new U,skyColor:new Ce,groundColor:new Ce};break;case"RectAreaLight":t={color:new Ce,position:new U,halfWidth:new U,halfHeight:new U};break}return s[e.id]=t,t}}}function nx(){const s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new qe};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new qe};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new qe,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[e.id]=t,t}}}let ix=0;function sx(s,e){return(e.castShadow?2:0)-(s.castShadow?2:0)+(e.map?1:0)-(s.map?1:0)}function rx(s){const e=new tx,t=nx(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new U);const i=new U,r=new ke,a=new ke;function o(c){let h=0,d=0,u=0;for(let w=0;w<9;w++)n.probe[w].set(0,0,0);let f=0,g=0,x=0,m=0,p=0,v=0,S=0,b=0,A=0,T=0,R=0;c.sort(sx);for(let w=0,P=c.length;w<P;w++){const C=c[w],F=C.color,G=C.intensity,W=C.distance;let N=null;if(C.shadow&&C.shadow.map&&(C.shadow.map.texture.format===di?N=C.shadow.map.texture:N=C.shadow.map.depthTexture||C.shadow.map.texture),C.isAmbientLight)h+=F.r*G,d+=F.g*G,u+=F.b*G;else if(C.isLightProbe){for(let B=0;B<9;B++)n.probe[B].addScaledVector(C.sh.coefficients[B],G);R++}else if(C.isDirectionalLight){const B=e.get(C);if(B.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){const V=C.shadow,Q=t.get(C);Q.shadowIntensity=V.intensity,Q.shadowBias=V.bias,Q.shadowNormalBias=V.normalBias,Q.shadowRadius=V.radius,Q.shadowMapSize=V.mapSize,n.directionalShadow[f]=Q,n.directionalShadowMap[f]=N,n.directionalShadowMatrix[f]=C.shadow.matrix,v++}n.directional[f]=B,f++}else if(C.isSpotLight){const B=e.get(C);B.position.setFromMatrixPosition(C.matrixWorld),B.color.copy(F).multiplyScalar(G),B.distance=W,B.coneCos=Math.cos(C.angle),B.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),B.decay=C.decay,n.spot[x]=B;const V=C.shadow;if(C.map&&(n.spotLightMap[A]=C.map,A++,V.updateMatrices(C),C.castShadow&&T++),n.spotLightMatrix[x]=V.matrix,C.castShadow){const Q=t.get(C);Q.shadowIntensity=V.intensity,Q.shadowBias=V.bias,Q.shadowNormalBias=V.normalBias,Q.shadowRadius=V.radius,Q.shadowMapSize=V.mapSize,n.spotShadow[x]=Q,n.spotShadowMap[x]=N,b++}x++}else if(C.isRectAreaLight){const B=e.get(C);B.color.copy(F).multiplyScalar(G),B.halfWidth.set(C.width*.5,0,0),B.halfHeight.set(0,C.height*.5,0),n.rectArea[m]=B,m++}else if(C.isPointLight){const B=e.get(C);if(B.color.copy(C.color).multiplyScalar(C.intensity),B.distance=C.distance,B.decay=C.decay,C.castShadow){const V=C.shadow,Q=t.get(C);Q.shadowIntensity=V.intensity,Q.shadowBias=V.bias,Q.shadowNormalBias=V.normalBias,Q.shadowRadius=V.radius,Q.shadowMapSize=V.mapSize,Q.shadowCameraNear=V.camera.near,Q.shadowCameraFar=V.camera.far,n.pointShadow[g]=Q,n.pointShadowMap[g]=N,n.pointShadowMatrix[g]=C.shadow.matrix,S++}n.point[g]=B,g++}else if(C.isHemisphereLight){const B=e.get(C);B.skyColor.copy(C.color).multiplyScalar(G),B.groundColor.copy(C.groundColor).multiplyScalar(G),n.hemi[p]=B,p++}}m>0&&(s.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ce.LTC_FLOAT_1,n.rectAreaLTC2=ce.LTC_FLOAT_2):(n.rectAreaLTC1=ce.LTC_HALF_1,n.rectAreaLTC2=ce.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=d,n.ambient[2]=u;const M=n.hash;(M.directionalLength!==f||M.pointLength!==g||M.spotLength!==x||M.rectAreaLength!==m||M.hemiLength!==p||M.numDirectionalShadows!==v||M.numPointShadows!==S||M.numSpotShadows!==b||M.numSpotMaps!==A||M.numLightProbes!==R)&&(n.directional.length=f,n.spot.length=x,n.rectArea.length=m,n.point.length=g,n.hemi.length=p,n.directionalShadow.length=v,n.directionalShadowMap.length=v,n.pointShadow.length=S,n.pointShadowMap.length=S,n.spotShadow.length=b,n.spotShadowMap.length=b,n.directionalShadowMatrix.length=v,n.pointShadowMatrix.length=S,n.spotLightMatrix.length=b+A-T,n.spotLightMap.length=A,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=R,M.directionalLength=f,M.pointLength=g,M.spotLength=x,M.rectAreaLength=m,M.hemiLength=p,M.numDirectionalShadows=v,M.numPointShadows=S,M.numSpotShadows=b,M.numSpotMaps=A,M.numLightProbes=R,n.version=ix++)}function l(c,h){let d=0,u=0,f=0,g=0,x=0;const m=h.matrixWorldInverse;for(let p=0,v=c.length;p<v;p++){const S=c[p];if(S.isDirectionalLight){const b=n.directional[d];b.direction.setFromMatrixPosition(S.matrixWorld),i.setFromMatrixPosition(S.target.matrixWorld),b.direction.sub(i),b.direction.transformDirection(m),d++}else if(S.isSpotLight){const b=n.spot[f];b.position.setFromMatrixPosition(S.matrixWorld),b.position.applyMatrix4(m),b.direction.setFromMatrixPosition(S.matrixWorld),i.setFromMatrixPosition(S.target.matrixWorld),b.direction.sub(i),b.direction.transformDirection(m),f++}else if(S.isRectAreaLight){const b=n.rectArea[g];b.position.setFromMatrixPosition(S.matrixWorld),b.position.applyMatrix4(m),a.identity(),r.copy(S.matrixWorld),r.premultiply(m),a.extractRotation(r),b.halfWidth.set(S.width*.5,0,0),b.halfHeight.set(0,S.height*.5,0),b.halfWidth.applyMatrix4(a),b.halfHeight.applyMatrix4(a),g++}else if(S.isPointLight){const b=n.point[u];b.position.setFromMatrixPosition(S.matrixWorld),b.position.applyMatrix4(m),u++}else if(S.isHemisphereLight){const b=n.hemi[x];b.direction.setFromMatrixPosition(S.matrixWorld),b.direction.transformDirection(m),x++}}}return{setup:o,setupView:l,state:n}}function fc(s){const e=new rx(s),t=[],n=[],i=[];function r(u){d.camera=u,t.length=0,n.length=0,i.length=0}function a(u){t.push(u)}function o(u){n.push(u)}function l(u){i.push(u)}function c(){e.setup(t)}function h(u){e.setupView(t,u)}const d={lightsArray:t,shadowsArray:n,lightProbeGridArray:i,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:d,setupLights:c,setupLightsView:h,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function ax(s){let e=new WeakMap;function t(i,r=0){const a=e.get(i);let o;return a===void 0?(o=new fc(s),e.set(i,[o])):r>=a.length?(o=new fc(s),a.push(o)):o=a[r],o}function n(){e=new WeakMap}return{get:t,dispose:n}}const ox=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,lx=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,cx=[new U(1,0,0),new U(-1,0,0),new U(0,1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1)],hx=[new U(0,-1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1),new U(0,-1,0),new U(0,-1,0)],pc=new ke,os=new U,ha=new U;function ux(s,e,t){let n=new Co;const i=new qe,r=new qe,a=new st,o=new Yd,l=new jd,c={},h=t.maxTextureSize,d={[In]:Bt,[Bt]:In,[en]:en},u=new _n({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new qe},radius:{value:4}},vertexShader:ox,fragmentShader:lx}),f=u.clone();f.defines.HORIZONTAL_PASS=1;const g=new Ot;g.setAttribute("position",new Ft(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const x=new kt(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=tr;let p=this.type;this.render=function(T,R,M){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||T.length===0)return;this.type===hu&&(Se("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=tr);const w=s.getRenderTarget(),P=s.getActiveCubeFace(),C=s.getActiveMipmapLevel(),F=s.state;F.setBlending(Pn),F.buffers.depth.getReversed()===!0?F.buffers.color.setClear(0,0,0,0):F.buffers.color.setClear(1,1,1,1),F.buffers.depth.setTest(!0),F.setScissorTest(!1);const G=p!==this.type;G&&R.traverse(function(W){W.material&&(Array.isArray(W.material)?W.material.forEach(N=>N.needsUpdate=!0):W.material.needsUpdate=!0)});for(let W=0,N=T.length;W<N;W++){const B=T[W],V=B.shadow;if(V===void 0){Se("WebGLShadowMap:",B,"has no shadow.");continue}if(V.autoUpdate===!1&&V.needsUpdate===!1)continue;i.copy(V.mapSize);const Q=V.getFrameExtents();i.multiply(Q),r.copy(V.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(r.x=Math.floor(h/Q.x),i.x=r.x*Q.x,V.mapSize.x=r.x),i.y>h&&(r.y=Math.floor(h/Q.y),i.y=r.y*Q.y,V.mapSize.y=r.y));const ee=s.state.buffers.depth.getReversed();if(V.camera._reversedDepth=ee,V.map===null||G===!0){if(V.map!==null&&(V.map.depthTexture!==null&&(V.map.depthTexture.dispose(),V.map.depthTexture=null),V.map.dispose()),this.type===hs){if(B.isPointLight){Se("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}V.map=new rn(i.x,i.y,{format:di,type:Nn,minFilter:Tt,magFilter:Tt,generateMipmaps:!1}),V.map.texture.name=B.name+".shadowMap",V.map.depthTexture=new zi(i.x,i.y,Kt),V.map.depthTexture.name=B.name+".shadowMapDepth",V.map.depthTexture.format=Un,V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=bt,V.map.depthTexture.magFilter=bt}else B.isPointLight?(V.map=new _h(i.x),V.map.depthTexture=new Vd(i.x,xn)):(V.map=new rn(i.x,i.y),V.map.depthTexture=new zi(i.x,i.y,xn)),V.map.depthTexture.name=B.name+".shadowMap",V.map.depthTexture.format=Un,this.type===tr?(V.map.depthTexture.compareFunction=ee?yo:So,V.map.depthTexture.minFilter=Tt,V.map.depthTexture.magFilter=Tt):(V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=bt,V.map.depthTexture.magFilter=bt);V.camera.updateProjectionMatrix()}const he=V.map.isWebGLCubeRenderTarget?6:1;for(let ve=0;ve<he;ve++){if(V.map.isWebGLCubeRenderTarget)s.setRenderTarget(V.map,ve),s.clear();else{ve===0&&(s.setRenderTarget(V.map),s.clear());const Te=V.getViewport(ve);a.set(r.x*Te.x,r.y*Te.y,r.x*Te.z,r.y*Te.w),F.viewport(a)}if(B.isPointLight){const Te=V.camera,Ye=V.matrix,et=B.distance||Te.far;et!==Te.far&&(Te.far=et,Te.updateProjectionMatrix()),os.setFromMatrixPosition(B.matrixWorld),Te.position.copy(os),ha.copy(Te.position),ha.add(cx[ve]),Te.up.copy(hx[ve]),Te.lookAt(ha),Te.updateMatrixWorld(),Ye.makeTranslation(-os.x,-os.y,-os.z),pc.multiplyMatrices(Te.projectionMatrix,Te.matrixWorldInverse),V._frustum.setFromProjectionMatrix(pc,Te.coordinateSystem,Te.reversedDepth)}else V.updateMatrices(B);n=V.getFrustum(),b(R,M,V.camera,B,this.type)}V.isPointLightShadow!==!0&&this.type===hs&&v(V,M),V.needsUpdate=!1}p=this.type,m.needsUpdate=!1,s.setRenderTarget(w,P,C)};function v(T,R){const M=e.update(x);u.defines.VSM_SAMPLES!==T.blurSamples&&(u.defines.VSM_SAMPLES=T.blurSamples,f.defines.VSM_SAMPLES=T.blurSamples,u.needsUpdate=!0,f.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new rn(i.x,i.y,{format:di,type:Nn})),u.uniforms.shadow_pass.value=T.map.depthTexture,u.uniforms.resolution.value=T.mapSize,u.uniforms.radius.value=T.radius,s.setRenderTarget(T.mapPass),s.clear(),s.renderBufferDirect(R,null,M,u,x,null),f.uniforms.shadow_pass.value=T.mapPass.texture,f.uniforms.resolution.value=T.mapSize,f.uniforms.radius.value=T.radius,s.setRenderTarget(T.map),s.clear(),s.renderBufferDirect(R,null,M,f,x,null)}function S(T,R,M,w){let P=null;const C=M.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(C!==void 0)P=C;else if(P=M.isPointLight===!0?l:o,s.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0||R.alphaToCoverage===!0){const F=P.uuid,G=R.uuid;let W=c[F];W===void 0&&(W={},c[F]=W);let N=W[G];N===void 0&&(N=P.clone(),W[G]=N,R.addEventListener("dispose",A)),P=N}if(P.visible=R.visible,P.wireframe=R.wireframe,w===hs?P.side=R.shadowSide!==null?R.shadowSide:R.side:P.side=R.shadowSide!==null?R.shadowSide:d[R.side],P.alphaMap=R.alphaMap,P.alphaTest=R.alphaToCoverage===!0?.5:R.alphaTest,P.map=R.map,P.clipShadows=R.clipShadows,P.clippingPlanes=R.clippingPlanes,P.clipIntersection=R.clipIntersection,P.displacementMap=R.displacementMap,P.displacementScale=R.displacementScale,P.displacementBias=R.displacementBias,P.wireframeLinewidth=R.wireframeLinewidth,P.linewidth=R.linewidth,M.isPointLight===!0&&P.isMeshDistanceMaterial===!0){const F=s.properties.get(P);F.light=M}return P}function b(T,R,M,w,P){if(T.visible===!1)return;if(T.layers.test(R.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&P===hs)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(M.matrixWorldInverse,T.matrixWorld);const G=e.update(T),W=T.material;if(Array.isArray(W)){const N=G.groups;for(let B=0,V=N.length;B<V;B++){const Q=N[B],ee=W[Q.materialIndex];if(ee&&ee.visible){const he=S(T,ee,w,P);T.onBeforeShadow(s,T,R,M,G,he,Q),s.renderBufferDirect(M,null,G,he,T,Q),T.onAfterShadow(s,T,R,M,G,he,Q)}}}else if(W.visible){const N=S(T,W,w,P);T.onBeforeShadow(s,T,R,M,G,N,null),s.renderBufferDirect(M,null,G,N,T,null),T.onAfterShadow(s,T,R,M,G,N,null)}}const F=T.children;for(let G=0,W=F.length;G<W;G++)b(F[G],R,M,w,P)}function A(T){T.target.removeEventListener("dispose",A);for(const M in c){const w=c[M],P=T.target.uuid;P in w&&(w[P].dispose(),delete w[P])}}}function dx(s,e){function t(){let L=!1;const ie=new st;let Y=null;const me=new st(0,0,0,0);return{setMask:function(ae){Y!==ae&&!L&&(s.colorMask(ae,ae,ae,ae),Y=ae)},setLocked:function(ae){L=ae},setClear:function(ae,$,ye,Ie,mt){mt===!0&&(ae*=Ie,$*=Ie,ye*=Ie),ie.set(ae,$,ye,Ie),me.equals(ie)===!1&&(s.clearColor(ae,$,ye,Ie),me.copy(ie))},reset:function(){L=!1,Y=null,me.set(-1,0,0,0)}}}function n(){let L=!1,ie=!1,Y=null,me=null,ae=null;return{setReversed:function($){if(ie!==$){const ye=e.get("EXT_clip_control");$?ye.clipControlEXT(ye.LOWER_LEFT_EXT,ye.ZERO_TO_ONE_EXT):ye.clipControlEXT(ye.LOWER_LEFT_EXT,ye.NEGATIVE_ONE_TO_ONE_EXT),ie=$;const Ie=ae;ae=null,this.setClear(Ie)}},getReversed:function(){return ie},setTest:function($){$?se(s.DEPTH_TEST):we(s.DEPTH_TEST)},setMask:function($){Y!==$&&!L&&(s.depthMask($),Y=$)},setFunc:function($){if(ie&&($=qu[$]),me!==$){switch($){case xa:s.depthFunc(s.NEVER);break;case _a:s.depthFunc(s.ALWAYS);break;case va:s.depthFunc(s.LESS);break;case Oi:s.depthFunc(s.LEQUAL);break;case Ma:s.depthFunc(s.EQUAL);break;case Sa:s.depthFunc(s.GEQUAL);break;case ya:s.depthFunc(s.GREATER);break;case ba:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}me=$}},setLocked:function($){L=$},setClear:function($){ae!==$&&(ae=$,ie&&($=1-$),s.clearDepth($))},reset:function(){L=!1,Y=null,me=null,ae=null,ie=!1}}}function i(){let L=!1,ie=null,Y=null,me=null,ae=null,$=null,ye=null,Ie=null,mt=null;return{setTest:function(nt){L||(nt?se(s.STENCIL_TEST):we(s.STENCIL_TEST))},setMask:function(nt){ie!==nt&&!L&&(s.stencilMask(nt),ie=nt)},setFunc:function(nt,yn,on){(Y!==nt||me!==yn||ae!==on)&&(s.stencilFunc(nt,yn,on),Y=nt,me=yn,ae=on)},setOp:function(nt,yn,on){($!==nt||ye!==yn||Ie!==on)&&(s.stencilOp(nt,yn,on),$=nt,ye=yn,Ie=on)},setLocked:function(nt){L=nt},setClear:function(nt){mt!==nt&&(s.clearStencil(nt),mt=nt)},reset:function(){L=!1,ie=null,Y=null,me=null,ae=null,$=null,ye=null,Ie=null,mt=null}}}const r=new t,a=new n,o=new i,l=new WeakMap,c=new WeakMap;let h={},d={},u={},f=new WeakMap,g=[],x=null,m=!1,p=null,v=null,S=null,b=null,A=null,T=null,R=null,M=new Ce(0,0,0),w=0,P=!1,C=null,F=null,G=null,W=null,N=null;const B=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let V=!1,Q=0;const ee=s.getParameter(s.VERSION);ee.indexOf("WebGL")!==-1?(Q=parseFloat(/^WebGL (\d)/.exec(ee)[1]),V=Q>=1):ee.indexOf("OpenGL ES")!==-1&&(Q=parseFloat(/^OpenGL ES (\d)/.exec(ee)[1]),V=Q>=2);let he=null,ve={};const Te=s.getParameter(s.SCISSOR_BOX),Ye=s.getParameter(s.VIEWPORT),et=new st().fromArray(Te),Ue=new st().fromArray(Ye);function Z(L,ie,Y,me){const ae=new Uint8Array(4),$=s.createTexture();s.bindTexture(L,$),s.texParameteri(L,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(L,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let ye=0;ye<Y;ye++)L===s.TEXTURE_3D||L===s.TEXTURE_2D_ARRAY?s.texImage3D(ie,0,s.RGBA,1,1,me,0,s.RGBA,s.UNSIGNED_BYTE,ae):s.texImage2D(ie+ye,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,ae);return $}const fe={};fe[s.TEXTURE_2D]=Z(s.TEXTURE_2D,s.TEXTURE_2D,1),fe[s.TEXTURE_CUBE_MAP]=Z(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),fe[s.TEXTURE_2D_ARRAY]=Z(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),fe[s.TEXTURE_3D]=Z(s.TEXTURE_3D,s.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),se(s.DEPTH_TEST),a.setFunc(Oi),St(!1),dt($o),se(s.CULL_FACE),ct(Pn);function se(L){h[L]!==!0&&(s.enable(L),h[L]=!0)}function we(L){h[L]!==!1&&(s.disable(L),h[L]=!1)}function Pe(L,ie){return u[L]!==ie?(s.bindFramebuffer(L,ie),u[L]=ie,L===s.DRAW_FRAMEBUFFER&&(u[s.FRAMEBUFFER]=ie),L===s.FRAMEBUFFER&&(u[s.DRAW_FRAMEBUFFER]=ie),!0):!1}function Re(L,ie){let Y=g,me=!1;if(L){Y=f.get(ie),Y===void 0&&(Y=[],f.set(ie,Y));const ae=L.textures;if(Y.length!==ae.length||Y[0]!==s.COLOR_ATTACHMENT0){for(let $=0,ye=ae.length;$<ye;$++)Y[$]=s.COLOR_ATTACHMENT0+$;Y.length=ae.length,me=!0}}else Y[0]!==s.BACK&&(Y[0]=s.BACK,me=!0);me&&s.drawBuffers(Y)}function ut(L){return x!==L?(s.useProgram(L),x=L,!0):!1}const We={[oi]:s.FUNC_ADD,[du]:s.FUNC_SUBTRACT,[fu]:s.FUNC_REVERSE_SUBTRACT};We[pu]=s.MIN,We[mu]=s.MAX;const tt={[gu]:s.ZERO,[xu]:s.ONE,[_u]:s.SRC_COLOR,[ma]:s.SRC_ALPHA,[Tu]:s.SRC_ALPHA_SATURATE,[yu]:s.DST_COLOR,[Mu]:s.DST_ALPHA,[vu]:s.ONE_MINUS_SRC_COLOR,[ga]:s.ONE_MINUS_SRC_ALPHA,[bu]:s.ONE_MINUS_DST_COLOR,[Su]:s.ONE_MINUS_DST_ALPHA,[Eu]:s.CONSTANT_COLOR,[wu]:s.ONE_MINUS_CONSTANT_COLOR,[Au]:s.CONSTANT_ALPHA,[Ru]:s.ONE_MINUS_CONSTANT_ALPHA};function ct(L,ie,Y,me,ae,$,ye,Ie,mt,nt){if(L===Pn){m===!0&&(we(s.BLEND),m=!1);return}if(m===!1&&(se(s.BLEND),m=!0),L!==uu){if(L!==p||nt!==P){if((v!==oi||A!==oi)&&(s.blendEquation(s.FUNC_ADD),v=oi,A=oi),nt)switch(L){case Ii:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Jo:s.blendFunc(s.ONE,s.ONE);break;case Qo:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case el:s.blendFuncSeparate(s.DST_COLOR,s.ONE_MINUS_SRC_ALPHA,s.ZERO,s.ONE);break;default:Ae("WebGLState: Invalid blending: ",L);break}else switch(L){case Ii:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Jo:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE,s.ONE,s.ONE);break;case Qo:Ae("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case el:Ae("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ae("WebGLState: Invalid blending: ",L);break}S=null,b=null,T=null,R=null,M.set(0,0,0),w=0,p=L,P=nt}return}ae=ae||ie,$=$||Y,ye=ye||me,(ie!==v||ae!==A)&&(s.blendEquationSeparate(We[ie],We[ae]),v=ie,A=ae),(Y!==S||me!==b||$!==T||ye!==R)&&(s.blendFuncSeparate(tt[Y],tt[me],tt[$],tt[ye]),S=Y,b=me,T=$,R=ye),(Ie.equals(M)===!1||mt!==w)&&(s.blendColor(Ie.r,Ie.g,Ie.b,mt),M.copy(Ie),w=mt),p=L,P=!1}function Ve(L,ie){L.side===en?we(s.CULL_FACE):se(s.CULL_FACE);let Y=L.side===Bt;ie&&(Y=!Y),St(Y),L.blending===Ii&&L.transparent===!1?ct(Pn):ct(L.blending,L.blendEquation,L.blendSrc,L.blendDst,L.blendEquationAlpha,L.blendSrcAlpha,L.blendDstAlpha,L.blendColor,L.blendAlpha,L.premultipliedAlpha),a.setFunc(L.depthFunc),a.setTest(L.depthTest),a.setMask(L.depthWrite),r.setMask(L.colorWrite);const me=L.stencilWrite;o.setTest(me),me&&(o.setMask(L.stencilWriteMask),o.setFunc(L.stencilFunc,L.stencilRef,L.stencilFuncMask),o.setOp(L.stencilFail,L.stencilZFail,L.stencilZPass)),D(L.polygonOffset,L.polygonOffsetFactor,L.polygonOffsetUnits),L.alphaToCoverage===!0?se(s.SAMPLE_ALPHA_TO_COVERAGE):we(s.SAMPLE_ALPHA_TO_COVERAGE)}function St(L){C!==L&&(L?s.frontFace(s.CW):s.frontFace(s.CCW),C=L)}function dt(L){L!==lu?(se(s.CULL_FACE),L!==F&&(L===$o?s.cullFace(s.BACK):L===cu?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):we(s.CULL_FACE),F=L}function zt(L){L!==G&&(V&&s.lineWidth(L),G=L)}function D(L,ie,Y){L?(se(s.POLYGON_OFFSET_FILL),(W!==ie||N!==Y)&&(W=ie,N=Y,a.getReversed()&&(ie=-ie),s.polygonOffset(ie,Y))):we(s.POLYGON_OFFSET_FILL)}function yt(L){L?se(s.SCISSOR_TEST):we(s.SCISSOR_TEST)}function Xe(L){L===void 0&&(L=s.TEXTURE0+B-1),he!==L&&(s.activeTexture(L),he=L)}function ot(L,ie,Y){Y===void 0&&(he===null?Y=s.TEXTURE0+B-1:Y=he);let me=ve[Y];me===void 0&&(me={type:void 0,texture:void 0},ve[Y]=me),(me.type!==L||me.texture!==ie)&&(he!==Y&&(s.activeTexture(Y),he=Y),s.bindTexture(L,ie||fe[L]),me.type=L,me.texture=ie)}function le(){const L=ve[he];L!==void 0&&L.type!==void 0&&(s.bindTexture(L.type,null),L.type=void 0,L.texture=void 0)}function ft(){try{s.compressedTexImage2D(...arguments)}catch(L){Ae("WebGLState:",L)}}function E(){try{s.compressedTexImage3D(...arguments)}catch(L){Ae("WebGLState:",L)}}function _(){try{s.texSubImage2D(...arguments)}catch(L){Ae("WebGLState:",L)}}function O(){try{s.texSubImage3D(...arguments)}catch(L){Ae("WebGLState:",L)}}function j(){try{s.compressedTexSubImage2D(...arguments)}catch(L){Ae("WebGLState:",L)}}function J(){try{s.compressedTexSubImage3D(...arguments)}catch(L){Ae("WebGLState:",L)}}function te(){try{s.texStorage2D(...arguments)}catch(L){Ae("WebGLState:",L)}}function oe(){try{s.texStorage3D(...arguments)}catch(L){Ae("WebGLState:",L)}}function q(){try{s.texImage2D(...arguments)}catch(L){Ae("WebGLState:",L)}}function K(){try{s.texImage3D(...arguments)}catch(L){Ae("WebGLState:",L)}}function pe(L){return d[L]!==void 0?d[L]:s.getParameter(L)}function xe(L,ie){d[L]!==ie&&(s.pixelStorei(L,ie),d[L]=ie)}function re(L){et.equals(L)===!1&&(s.scissor(L.x,L.y,L.z,L.w),et.copy(L))}function ne(L){Ue.equals(L)===!1&&(s.viewport(L.x,L.y,L.z,L.w),Ue.copy(L))}function Le(L,ie){let Y=c.get(ie);Y===void 0&&(Y=new WeakMap,c.set(ie,Y));let me=Y.get(L);me===void 0&&(me=s.getUniformBlockIndex(ie,L.name),Y.set(L,me))}function Fe(L,ie){const me=c.get(ie).get(L);l.get(ie)!==me&&(s.uniformBlockBinding(ie,me,L.__bindingPointIndex),l.set(ie,me))}function Ke(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),a.setReversed(!1),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),s.pixelStorei(s.PACK_ALIGNMENT,4),s.pixelStorei(s.UNPACK_ALIGNMENT,4),s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,!1),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,s.BROWSER_DEFAULT_WEBGL),s.pixelStorei(s.PACK_ROW_LENGTH,0),s.pixelStorei(s.PACK_SKIP_PIXELS,0),s.pixelStorei(s.PACK_SKIP_ROWS,0),s.pixelStorei(s.UNPACK_ROW_LENGTH,0),s.pixelStorei(s.UNPACK_IMAGE_HEIGHT,0),s.pixelStorei(s.UNPACK_SKIP_PIXELS,0),s.pixelStorei(s.UNPACK_SKIP_ROWS,0),s.pixelStorei(s.UNPACK_SKIP_IMAGES,0),h={},d={},he=null,ve={},u={},f=new WeakMap,g=[],x=null,m=!1,p=null,v=null,S=null,b=null,A=null,T=null,R=null,M=new Ce(0,0,0),w=0,P=!1,C=null,F=null,G=null,W=null,N=null,et.set(0,0,s.canvas.width,s.canvas.height),Ue.set(0,0,s.canvas.width,s.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:se,disable:we,bindFramebuffer:Pe,drawBuffers:Re,useProgram:ut,setBlending:ct,setMaterial:Ve,setFlipSided:St,setCullFace:dt,setLineWidth:zt,setPolygonOffset:D,setScissorTest:yt,activeTexture:Xe,bindTexture:ot,unbindTexture:le,compressedTexImage2D:ft,compressedTexImage3D:E,texImage2D:q,texImage3D:K,pixelStorei:xe,getParameter:pe,updateUBOMapping:Le,uniformBlockBinding:Fe,texStorage2D:te,texStorage3D:oe,texSubImage2D:_,texSubImage3D:O,compressedTexSubImage2D:j,compressedTexSubImage3D:J,scissor:re,viewport:ne,reset:Ke}}function fx(s,e,t,n,i,r,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new qe,h=new WeakMap,d=new Set;let u;const f=new WeakMap;let g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(E,_){return g?new OffscreenCanvas(E,_):Ss("canvas")}function m(E,_,O){let j=1;const J=ft(E);if((J.width>O||J.height>O)&&(j=O/Math.max(J.width,J.height)),j<1)if(typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&E instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&E instanceof ImageBitmap||typeof VideoFrame<"u"&&E instanceof VideoFrame){const te=Math.floor(j*J.width),oe=Math.floor(j*J.height);u===void 0&&(u=x(te,oe));const q=_?x(te,oe):u;return q.width=te,q.height=oe,q.getContext("2d").drawImage(E,0,0,te,oe),Se("WebGLRenderer: Texture has been resized from ("+J.width+"x"+J.height+") to ("+te+"x"+oe+")."),q}else return"data"in E&&Se("WebGLRenderer: Image in DataTexture is too big ("+J.width+"x"+J.height+")."),E;return E}function p(E){return E.generateMipmaps}function v(E){s.generateMipmap(E)}function S(E){return E.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:E.isWebGL3DRenderTarget?s.TEXTURE_3D:E.isWebGLArrayRenderTarget||E.isCompressedArrayTexture?s.TEXTURE_2D_ARRAY:s.TEXTURE_2D}function b(E,_,O,j,J,te=!1){if(E!==null){if(s[E]!==void 0)return s[E];Se("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+E+"'")}let oe;j&&(oe=e.get("EXT_texture_norm16"),oe||Se("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let q=_;if(_===s.RED&&(O===s.FLOAT&&(q=s.R32F),O===s.HALF_FLOAT&&(q=s.R16F),O===s.UNSIGNED_BYTE&&(q=s.R8),O===s.UNSIGNED_SHORT&&oe&&(q=oe.R16_EXT),O===s.SHORT&&oe&&(q=oe.R16_SNORM_EXT)),_===s.RED_INTEGER&&(O===s.UNSIGNED_BYTE&&(q=s.R8UI),O===s.UNSIGNED_SHORT&&(q=s.R16UI),O===s.UNSIGNED_INT&&(q=s.R32UI),O===s.BYTE&&(q=s.R8I),O===s.SHORT&&(q=s.R16I),O===s.INT&&(q=s.R32I)),_===s.RG&&(O===s.FLOAT&&(q=s.RG32F),O===s.HALF_FLOAT&&(q=s.RG16F),O===s.UNSIGNED_BYTE&&(q=s.RG8),O===s.UNSIGNED_SHORT&&oe&&(q=oe.RG16_EXT),O===s.SHORT&&oe&&(q=oe.RG16_SNORM_EXT)),_===s.RG_INTEGER&&(O===s.UNSIGNED_BYTE&&(q=s.RG8UI),O===s.UNSIGNED_SHORT&&(q=s.RG16UI),O===s.UNSIGNED_INT&&(q=s.RG32UI),O===s.BYTE&&(q=s.RG8I),O===s.SHORT&&(q=s.RG16I),O===s.INT&&(q=s.RG32I)),_===s.RGB_INTEGER&&(O===s.UNSIGNED_BYTE&&(q=s.RGB8UI),O===s.UNSIGNED_SHORT&&(q=s.RGB16UI),O===s.UNSIGNED_INT&&(q=s.RGB32UI),O===s.BYTE&&(q=s.RGB8I),O===s.SHORT&&(q=s.RGB16I),O===s.INT&&(q=s.RGB32I)),_===s.RGBA_INTEGER&&(O===s.UNSIGNED_BYTE&&(q=s.RGBA8UI),O===s.UNSIGNED_SHORT&&(q=s.RGBA16UI),O===s.UNSIGNED_INT&&(q=s.RGBA32UI),O===s.BYTE&&(q=s.RGBA8I),O===s.SHORT&&(q=s.RGBA16I),O===s.INT&&(q=s.RGBA32I)),_===s.RGB&&(O===s.UNSIGNED_SHORT&&oe&&(q=oe.RGB16_EXT),O===s.SHORT&&oe&&(q=oe.RGB16_SNORM_EXT),O===s.UNSIGNED_INT_5_9_9_9_REV&&(q=s.RGB9_E5),O===s.UNSIGNED_INT_10F_11F_11F_REV&&(q=s.R11F_G11F_B10F)),_===s.RGBA){const K=te?ur:He.getTransfer(J);O===s.FLOAT&&(q=s.RGBA32F),O===s.HALF_FLOAT&&(q=s.RGBA16F),O===s.UNSIGNED_BYTE&&(q=K===$e?s.SRGB8_ALPHA8:s.RGBA8),O===s.UNSIGNED_SHORT&&oe&&(q=oe.RGBA16_EXT),O===s.SHORT&&oe&&(q=oe.RGBA16_SNORM_EXT),O===s.UNSIGNED_SHORT_4_4_4_4&&(q=s.RGBA4),O===s.UNSIGNED_SHORT_5_5_5_1&&(q=s.RGB5_A1)}return(q===s.R16F||q===s.R32F||q===s.RG16F||q===s.RG32F||q===s.RGBA16F||q===s.RGBA32F)&&e.get("EXT_color_buffer_float"),q}function A(E,_){let O;return E?_===null||_===xn||_===xs?O=s.DEPTH24_STENCIL8:_===Kt?O=s.DEPTH32F_STENCIL8:_===gs&&(O=s.DEPTH24_STENCIL8,Se("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):_===null||_===xn||_===xs?O=s.DEPTH_COMPONENT24:_===Kt?O=s.DEPTH_COMPONENT32F:_===gs&&(O=s.DEPTH_COMPONENT16),O}function T(E,_){return p(E)===!0||E.isFramebufferTexture&&E.minFilter!==bt&&E.minFilter!==Tt?Math.log2(Math.max(_.width,_.height))+1:E.mipmaps!==void 0&&E.mipmaps.length>0?E.mipmaps.length:E.isCompressedTexture&&Array.isArray(E.image)?_.mipmaps.length:1}function R(E){const _=E.target;_.removeEventListener("dispose",R),w(_),_.isVideoTexture&&h.delete(_),_.isHTMLTexture&&d.delete(_)}function M(E){const _=E.target;_.removeEventListener("dispose",M),C(_)}function w(E){const _=n.get(E);if(_.__webglInit===void 0)return;const O=E.source,j=f.get(O);if(j){const J=j[_.__cacheKey];J.usedTimes--,J.usedTimes===0&&P(E),Object.keys(j).length===0&&f.delete(O)}n.remove(E)}function P(E){const _=n.get(E);s.deleteTexture(_.__webglTexture);const O=E.source,j=f.get(O);delete j[_.__cacheKey],a.memory.textures--}function C(E){const _=n.get(E);if(E.depthTexture&&(E.depthTexture.dispose(),n.remove(E.depthTexture)),E.isWebGLCubeRenderTarget)for(let j=0;j<6;j++){if(Array.isArray(_.__webglFramebuffer[j]))for(let J=0;J<_.__webglFramebuffer[j].length;J++)s.deleteFramebuffer(_.__webglFramebuffer[j][J]);else s.deleteFramebuffer(_.__webglFramebuffer[j]);_.__webglDepthbuffer&&s.deleteRenderbuffer(_.__webglDepthbuffer[j])}else{if(Array.isArray(_.__webglFramebuffer))for(let j=0;j<_.__webglFramebuffer.length;j++)s.deleteFramebuffer(_.__webglFramebuffer[j]);else s.deleteFramebuffer(_.__webglFramebuffer);if(_.__webglDepthbuffer&&s.deleteRenderbuffer(_.__webglDepthbuffer),_.__webglMultisampledFramebuffer&&s.deleteFramebuffer(_.__webglMultisampledFramebuffer),_.__webglColorRenderbuffer)for(let j=0;j<_.__webglColorRenderbuffer.length;j++)_.__webglColorRenderbuffer[j]&&s.deleteRenderbuffer(_.__webglColorRenderbuffer[j]);_.__webglDepthRenderbuffer&&s.deleteRenderbuffer(_.__webglDepthRenderbuffer)}const O=E.textures;for(let j=0,J=O.length;j<J;j++){const te=n.get(O[j]);te.__webglTexture&&(s.deleteTexture(te.__webglTexture),a.memory.textures--),n.remove(O[j])}n.remove(E)}let F=0;function G(){F=0}function W(){return F}function N(E){F=E}function B(){const E=F;return E>=i.maxTextures&&Se("WebGLTextures: Trying to use "+E+" texture units while this GPU supports only "+i.maxTextures),F+=1,E}function V(E){const _=[];return _.push(E.wrapS),_.push(E.wrapT),_.push(E.wrapR||0),_.push(E.magFilter),_.push(E.minFilter),_.push(E.anisotropy),_.push(E.internalFormat),_.push(E.format),_.push(E.type),_.push(E.generateMipmaps),_.push(E.premultiplyAlpha),_.push(E.flipY),_.push(E.unpackAlignment),_.push(E.colorSpace),_.join()}function Q(E,_){const O=n.get(E);if(E.isVideoTexture&&ot(E),E.isRenderTargetTexture===!1&&E.isExternalTexture!==!0&&E.version>0&&O.__version!==E.version){const j=E.image;if(j===null)Se("WebGLRenderer: Texture marked for update but no image data found.");else if(j.complete===!1)Se("WebGLRenderer: Texture marked for update but image is incomplete");else{we(O,E,_);return}}else E.isExternalTexture&&(O.__webglTexture=E.sourceTexture?E.sourceTexture:null);t.bindTexture(s.TEXTURE_2D,O.__webglTexture,s.TEXTURE0+_)}function ee(E,_){const O=n.get(E);if(E.isRenderTargetTexture===!1&&E.version>0&&O.__version!==E.version){we(O,E,_);return}else E.isExternalTexture&&(O.__webglTexture=E.sourceTexture?E.sourceTexture:null);t.bindTexture(s.TEXTURE_2D_ARRAY,O.__webglTexture,s.TEXTURE0+_)}function he(E,_){const O=n.get(E);if(E.isRenderTargetTexture===!1&&E.version>0&&O.__version!==E.version){we(O,E,_);return}t.bindTexture(s.TEXTURE_3D,O.__webglTexture,s.TEXTURE0+_)}function ve(E,_){const O=n.get(E);if(E.isCubeDepthTexture!==!0&&E.version>0&&O.__version!==E.version){Pe(O,E,_);return}t.bindTexture(s.TEXTURE_CUBE_MAP,O.__webglTexture,s.TEXTURE0+_)}const Te={[ui]:s.REPEAT,[fn]:s.CLAMP_TO_EDGE,[lr]:s.MIRRORED_REPEAT},Ye={[bt]:s.NEAREST,[Wc]:s.NEAREST_MIPMAP_NEAREST,[us]:s.NEAREST_MIPMAP_LINEAR,[Tt]:s.LINEAR,[nr]:s.LINEAR_MIPMAP_NEAREST,[Cn]:s.LINEAR_MIPMAP_LINEAR},et={[Fu]:s.NEVER,[Vu]:s.ALWAYS,[Ou]:s.LESS,[So]:s.LEQUAL,[Bu]:s.EQUAL,[yo]:s.GEQUAL,[ku]:s.GREATER,[zu]:s.NOTEQUAL};function Ue(E,_){if(_.type===Kt&&e.has("OES_texture_float_linear")===!1&&(_.magFilter===Tt||_.magFilter===nr||_.magFilter===us||_.magFilter===Cn||_.minFilter===Tt||_.minFilter===nr||_.minFilter===us||_.minFilter===Cn)&&Se("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),s.texParameteri(E,s.TEXTURE_WRAP_S,Te[_.wrapS]),s.texParameteri(E,s.TEXTURE_WRAP_T,Te[_.wrapT]),(E===s.TEXTURE_3D||E===s.TEXTURE_2D_ARRAY)&&s.texParameteri(E,s.TEXTURE_WRAP_R,Te[_.wrapR]),s.texParameteri(E,s.TEXTURE_MAG_FILTER,Ye[_.magFilter]),s.texParameteri(E,s.TEXTURE_MIN_FILTER,Ye[_.minFilter]),_.compareFunction&&(s.texParameteri(E,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(E,s.TEXTURE_COMPARE_FUNC,et[_.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(_.magFilter===bt||_.minFilter!==us&&_.minFilter!==Cn||_.type===Kt&&e.has("OES_texture_float_linear")===!1)return;if(_.anisotropy>1||n.get(_).__currentAnisotropy){const O=e.get("EXT_texture_filter_anisotropic");s.texParameterf(E,O.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(_.anisotropy,i.getMaxAnisotropy())),n.get(_).__currentAnisotropy=_.anisotropy}}}function Z(E,_){let O=!1;E.__webglInit===void 0&&(E.__webglInit=!0,_.addEventListener("dispose",R));const j=_.source;let J=f.get(j);J===void 0&&(J={},f.set(j,J));const te=V(_);if(te!==E.__cacheKey){J[te]===void 0&&(J[te]={texture:s.createTexture(),usedTimes:0},a.memory.textures++,O=!0),J[te].usedTimes++;const oe=J[E.__cacheKey];oe!==void 0&&(J[E.__cacheKey].usedTimes--,oe.usedTimes===0&&P(_)),E.__cacheKey=te,E.__webglTexture=J[te].texture}return O}function fe(E,_,O){return Math.floor(Math.floor(E/O)/_)}function se(E,_,O,j){const te=E.updateRanges;if(te.length===0)t.texSubImage2D(s.TEXTURE_2D,0,0,0,_.width,_.height,O,j,_.data);else{te.sort((xe,re)=>xe.start-re.start);let oe=0;for(let xe=1;xe<te.length;xe++){const re=te[oe],ne=te[xe],Le=re.start+re.count,Fe=fe(ne.start,_.width,4),Ke=fe(re.start,_.width,4);ne.start<=Le+1&&Fe===Ke&&fe(ne.start+ne.count-1,_.width,4)===Fe?re.count=Math.max(re.count,ne.start+ne.count-re.start):(++oe,te[oe]=ne)}te.length=oe+1;const q=t.getParameter(s.UNPACK_ROW_LENGTH),K=t.getParameter(s.UNPACK_SKIP_PIXELS),pe=t.getParameter(s.UNPACK_SKIP_ROWS);t.pixelStorei(s.UNPACK_ROW_LENGTH,_.width);for(let xe=0,re=te.length;xe<re;xe++){const ne=te[xe],Le=Math.floor(ne.start/4),Fe=Math.ceil(ne.count/4),Ke=Le%_.width,L=Math.floor(Le/_.width),ie=Fe,Y=1;t.pixelStorei(s.UNPACK_SKIP_PIXELS,Ke),t.pixelStorei(s.UNPACK_SKIP_ROWS,L),t.texSubImage2D(s.TEXTURE_2D,0,Ke,L,ie,Y,O,j,_.data)}E.clearUpdateRanges(),t.pixelStorei(s.UNPACK_ROW_LENGTH,q),t.pixelStorei(s.UNPACK_SKIP_PIXELS,K),t.pixelStorei(s.UNPACK_SKIP_ROWS,pe)}}function we(E,_,O){let j=s.TEXTURE_2D;(_.isDataArrayTexture||_.isCompressedArrayTexture)&&(j=s.TEXTURE_2D_ARRAY),_.isData3DTexture&&(j=s.TEXTURE_3D);const J=Z(E,_),te=_.source;t.bindTexture(j,E.__webglTexture,s.TEXTURE0+O);const oe=n.get(te);if(te.version!==oe.__version||J===!0){if(t.activeTexture(s.TEXTURE0+O),(typeof ImageBitmap<"u"&&_.image instanceof ImageBitmap)===!1){const Y=He.getPrimaries(He.workingColorSpace),me=_.colorSpace===Yn?null:He.getPrimaries(_.colorSpace),ae=_.colorSpace===Yn||Y===me?s.NONE:s.BROWSER_DEFAULT_WEBGL;t.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,_.flipY),t.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),t.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,ae)}t.pixelStorei(s.UNPACK_ALIGNMENT,_.unpackAlignment);let K=m(_.image,!1,i.maxTextureSize);K=le(_,K);const pe=r.convert(_.format,_.colorSpace),xe=r.convert(_.type);let re=b(_.internalFormat,pe,xe,_.normalized,_.colorSpace,_.isVideoTexture);Ue(j,_);let ne;const Le=_.mipmaps,Fe=_.isVideoTexture!==!0,Ke=oe.__version===void 0||J===!0,L=te.dataReady,ie=T(_,K);if(_.isDepthTexture)re=A(_.format===ci,_.type),Ke&&(Fe?t.texStorage2D(s.TEXTURE_2D,1,re,K.width,K.height):t.texImage2D(s.TEXTURE_2D,0,re,K.width,K.height,0,pe,xe,null));else if(_.isDataTexture)if(Le.length>0){Fe&&Ke&&t.texStorage2D(s.TEXTURE_2D,ie,re,Le[0].width,Le[0].height);for(let Y=0,me=Le.length;Y<me;Y++)ne=Le[Y],Fe?L&&t.texSubImage2D(s.TEXTURE_2D,Y,0,0,ne.width,ne.height,pe,xe,ne.data):t.texImage2D(s.TEXTURE_2D,Y,re,ne.width,ne.height,0,pe,xe,ne.data);_.generateMipmaps=!1}else Fe?(Ke&&t.texStorage2D(s.TEXTURE_2D,ie,re,K.width,K.height),L&&se(_,K,pe,xe)):t.texImage2D(s.TEXTURE_2D,0,re,K.width,K.height,0,pe,xe,K.data);else if(_.isCompressedTexture)if(_.isCompressedArrayTexture){Fe&&Ke&&t.texStorage3D(s.TEXTURE_2D_ARRAY,ie,re,Le[0].width,Le[0].height,K.depth);for(let Y=0,me=Le.length;Y<me;Y++)if(ne=Le[Y],_.format!==Zt)if(pe!==null)if(Fe){if(L)if(_.layerUpdates.size>0){const ae=Xl(ne.width,ne.height,_.format,_.type);for(const $ of _.layerUpdates){const ye=ne.data.subarray($*ae/ne.data.BYTES_PER_ELEMENT,($+1)*ae/ne.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,Y,0,0,$,ne.width,ne.height,1,pe,ye)}_.clearLayerUpdates()}else t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,Y,0,0,0,ne.width,ne.height,K.depth,pe,ne.data)}else t.compressedTexImage3D(s.TEXTURE_2D_ARRAY,Y,re,ne.width,ne.height,K.depth,0,ne.data,0,0);else Se("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Fe?L&&t.texSubImage3D(s.TEXTURE_2D_ARRAY,Y,0,0,0,ne.width,ne.height,K.depth,pe,xe,ne.data):t.texImage3D(s.TEXTURE_2D_ARRAY,Y,re,ne.width,ne.height,K.depth,0,pe,xe,ne.data)}else{Fe&&Ke&&t.texStorage2D(s.TEXTURE_2D,ie,re,Le[0].width,Le[0].height);for(let Y=0,me=Le.length;Y<me;Y++)ne=Le[Y],_.format!==Zt?pe!==null?Fe?L&&t.compressedTexSubImage2D(s.TEXTURE_2D,Y,0,0,ne.width,ne.height,pe,ne.data):t.compressedTexImage2D(s.TEXTURE_2D,Y,re,ne.width,ne.height,0,ne.data):Se("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Fe?L&&t.texSubImage2D(s.TEXTURE_2D,Y,0,0,ne.width,ne.height,pe,xe,ne.data):t.texImage2D(s.TEXTURE_2D,Y,re,ne.width,ne.height,0,pe,xe,ne.data)}else if(_.isDataArrayTexture)if(Fe){if(Ke&&t.texStorage3D(s.TEXTURE_2D_ARRAY,ie,re,K.width,K.height,K.depth),L)if(_.layerUpdates.size>0){const Y=Xl(K.width,K.height,_.format,_.type);for(const me of _.layerUpdates){const ae=K.data.subarray(me*Y/K.data.BYTES_PER_ELEMENT,(me+1)*Y/K.data.BYTES_PER_ELEMENT);t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,me,K.width,K.height,1,pe,xe,ae)}_.clearLayerUpdates()}else t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,K.width,K.height,K.depth,pe,xe,K.data)}else t.texImage3D(s.TEXTURE_2D_ARRAY,0,re,K.width,K.height,K.depth,0,pe,xe,K.data);else if(_.isData3DTexture)Fe?(Ke&&t.texStorage3D(s.TEXTURE_3D,ie,re,K.width,K.height,K.depth),L&&t.texSubImage3D(s.TEXTURE_3D,0,0,0,0,K.width,K.height,K.depth,pe,xe,K.data)):t.texImage3D(s.TEXTURE_3D,0,re,K.width,K.height,K.depth,0,pe,xe,K.data);else if(_.isFramebufferTexture){if(Ke)if(Fe)t.texStorage2D(s.TEXTURE_2D,ie,re,K.width,K.height);else{let Y=K.width,me=K.height;for(let ae=0;ae<ie;ae++)t.texImage2D(s.TEXTURE_2D,ae,re,Y,me,0,pe,xe,null),Y>>=1,me>>=1}}else if(_.isHTMLTexture){if("texElementImage2D"in s){const Y=s.canvas;if(Y.hasAttribute("layoutsubtree")||Y.setAttribute("layoutsubtree","true"),K.parentNode!==Y){Y.appendChild(K),d.add(_),Y.onpaint=Ie=>{const mt=Ie.changedElements;for(const nt of d)mt.includes(nt.image)&&(nt.needsUpdate=!0)},Y.requestPaint();return}const me=0,ae=s.RGBA,$=s.RGBA,ye=s.UNSIGNED_BYTE;s.texElementImage2D(s.TEXTURE_2D,me,ae,$,ye,K),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE)}}else if(Le.length>0){if(Fe&&Ke){const Y=ft(Le[0]);t.texStorage2D(s.TEXTURE_2D,ie,re,Y.width,Y.height)}for(let Y=0,me=Le.length;Y<me;Y++)ne=Le[Y],Fe?L&&t.texSubImage2D(s.TEXTURE_2D,Y,0,0,pe,xe,ne):t.texImage2D(s.TEXTURE_2D,Y,re,pe,xe,ne);_.generateMipmaps=!1}else if(Fe){if(Ke){const Y=ft(K);t.texStorage2D(s.TEXTURE_2D,ie,re,Y.width,Y.height)}L&&t.texSubImage2D(s.TEXTURE_2D,0,0,0,pe,xe,K)}else t.texImage2D(s.TEXTURE_2D,0,re,pe,xe,K);p(_)&&v(j),oe.__version=te.version,_.onUpdate&&_.onUpdate(_)}E.__version=_.version}function Pe(E,_,O){if(_.image.length!==6)return;const j=Z(E,_),J=_.source;t.bindTexture(s.TEXTURE_CUBE_MAP,E.__webglTexture,s.TEXTURE0+O);const te=n.get(J);if(J.version!==te.__version||j===!0){t.activeTexture(s.TEXTURE0+O);const oe=He.getPrimaries(He.workingColorSpace),q=_.colorSpace===Yn?null:He.getPrimaries(_.colorSpace),K=_.colorSpace===Yn||oe===q?s.NONE:s.BROWSER_DEFAULT_WEBGL;t.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,_.flipY),t.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),t.pixelStorei(s.UNPACK_ALIGNMENT,_.unpackAlignment),t.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,K);const pe=_.isCompressedTexture||_.image[0].isCompressedTexture,xe=_.image[0]&&_.image[0].isDataTexture,re=[];for(let $=0;$<6;$++)!pe&&!xe?re[$]=m(_.image[$],!0,i.maxCubemapSize):re[$]=xe?_.image[$].image:_.image[$],re[$]=le(_,re[$]);const ne=re[0],Le=r.convert(_.format,_.colorSpace),Fe=r.convert(_.type),Ke=b(_.internalFormat,Le,Fe,_.normalized,_.colorSpace),L=_.isVideoTexture!==!0,ie=te.__version===void 0||j===!0,Y=J.dataReady;let me=T(_,ne);Ue(s.TEXTURE_CUBE_MAP,_);let ae;if(pe){L&&ie&&t.texStorage2D(s.TEXTURE_CUBE_MAP,me,Ke,ne.width,ne.height);for(let $=0;$<6;$++){ae=re[$].mipmaps;for(let ye=0;ye<ae.length;ye++){const Ie=ae[ye];_.format!==Zt?Le!==null?L?Y&&t.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,ye,0,0,Ie.width,Ie.height,Le,Ie.data):t.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,ye,Ke,Ie.width,Ie.height,0,Ie.data):Se("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):L?Y&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,ye,0,0,Ie.width,Ie.height,Le,Fe,Ie.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,ye,Ke,Ie.width,Ie.height,0,Le,Fe,Ie.data)}}}else{if(ae=_.mipmaps,L&&ie){ae.length>0&&me++;const $=ft(re[0]);t.texStorage2D(s.TEXTURE_CUBE_MAP,me,Ke,$.width,$.height)}for(let $=0;$<6;$++)if(xe){L?Y&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,0,0,re[$].width,re[$].height,Le,Fe,re[$].data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,Ke,re[$].width,re[$].height,0,Le,Fe,re[$].data);for(let ye=0;ye<ae.length;ye++){const mt=ae[ye].image[$].image;L?Y&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,ye+1,0,0,mt.width,mt.height,Le,Fe,mt.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,ye+1,Ke,mt.width,mt.height,0,Le,Fe,mt.data)}}else{L?Y&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,0,0,Le,Fe,re[$]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,Ke,Le,Fe,re[$]);for(let ye=0;ye<ae.length;ye++){const Ie=ae[ye];L?Y&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,ye+1,0,0,Le,Fe,Ie.image[$]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+$,ye+1,Ke,Le,Fe,Ie.image[$])}}}p(_)&&v(s.TEXTURE_CUBE_MAP),te.__version=J.version,_.onUpdate&&_.onUpdate(_)}E.__version=_.version}function Re(E,_,O,j,J,te){const oe=r.convert(O.format,O.colorSpace),q=r.convert(O.type),K=b(O.internalFormat,oe,q,O.normalized,O.colorSpace),pe=n.get(_),xe=n.get(O);if(xe.__renderTarget=_,!pe.__hasExternalTextures){const re=Math.max(1,_.width>>te),ne=Math.max(1,_.height>>te);J===s.TEXTURE_3D||J===s.TEXTURE_2D_ARRAY?t.texImage3D(J,te,K,re,ne,_.depth,0,oe,q,null):t.texImage2D(J,te,K,re,ne,0,oe,q,null)}t.bindFramebuffer(s.FRAMEBUFFER,E),Xe(_)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,j,J,xe.__webglTexture,0,yt(_)):(J===s.TEXTURE_2D||J>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&J<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,j,J,xe.__webglTexture,te),t.bindFramebuffer(s.FRAMEBUFFER,null)}function ut(E,_,O){if(s.bindRenderbuffer(s.RENDERBUFFER,E),_.depthBuffer){const j=_.depthTexture,J=j&&j.isDepthTexture?j.type:null,te=A(_.stencilBuffer,J),oe=_.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;Xe(_)?o.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,yt(_),te,_.width,_.height):O?s.renderbufferStorageMultisample(s.RENDERBUFFER,yt(_),te,_.width,_.height):s.renderbufferStorage(s.RENDERBUFFER,te,_.width,_.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,oe,s.RENDERBUFFER,E)}else{const j=_.textures;for(let J=0;J<j.length;J++){const te=j[J],oe=r.convert(te.format,te.colorSpace),q=r.convert(te.type),K=b(te.internalFormat,oe,q,te.normalized,te.colorSpace);Xe(_)?o.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,yt(_),K,_.width,_.height):O?s.renderbufferStorageMultisample(s.RENDERBUFFER,yt(_),K,_.width,_.height):s.renderbufferStorage(s.RENDERBUFFER,K,_.width,_.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function We(E,_,O){const j=_.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(s.FRAMEBUFFER,E),!(_.depthTexture&&_.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const J=n.get(_.depthTexture);if(J.__renderTarget=_,(!J.__webglTexture||_.depthTexture.image.width!==_.width||_.depthTexture.image.height!==_.height)&&(_.depthTexture.image.width=_.width,_.depthTexture.image.height=_.height,_.depthTexture.needsUpdate=!0),j){if(J.__webglInit===void 0&&(J.__webglInit=!0,_.depthTexture.addEventListener("dispose",R)),J.__webglTexture===void 0){J.__webglTexture=s.createTexture(),t.bindTexture(s.TEXTURE_CUBE_MAP,J.__webglTexture),Ue(s.TEXTURE_CUBE_MAP,_.depthTexture);const pe=r.convert(_.depthTexture.format),xe=r.convert(_.depthTexture.type);let re;_.depthTexture.format===Un?re=s.DEPTH_COMPONENT24:_.depthTexture.format===ci&&(re=s.DEPTH24_STENCIL8);for(let ne=0;ne<6;ne++)s.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,re,_.width,_.height,0,pe,xe,null)}}else Q(_.depthTexture,0);const te=J.__webglTexture,oe=yt(_),q=j?s.TEXTURE_CUBE_MAP_POSITIVE_X+O:s.TEXTURE_2D,K=_.depthTexture.format===ci?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;if(_.depthTexture.format===Un)Xe(_)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,K,q,te,0,oe):s.framebufferTexture2D(s.FRAMEBUFFER,K,q,te,0);else if(_.depthTexture.format===ci)Xe(_)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,K,q,te,0,oe):s.framebufferTexture2D(s.FRAMEBUFFER,K,q,te,0);else throw new Error("Unknown depthTexture format")}function tt(E){const _=n.get(E),O=E.isWebGLCubeRenderTarget===!0;if(_.__boundDepthTexture!==E.depthTexture){const j=E.depthTexture;if(_.__depthDisposeCallback&&_.__depthDisposeCallback(),j){const J=()=>{delete _.__boundDepthTexture,delete _.__depthDisposeCallback,j.removeEventListener("dispose",J)};j.addEventListener("dispose",J),_.__depthDisposeCallback=J}_.__boundDepthTexture=j}if(E.depthTexture&&!_.__autoAllocateDepthBuffer)if(O)for(let j=0;j<6;j++)We(_.__webglFramebuffer[j],E,j);else{const j=E.texture.mipmaps;j&&j.length>0?We(_.__webglFramebuffer[0],E,0):We(_.__webglFramebuffer,E,0)}else if(O){_.__webglDepthbuffer=[];for(let j=0;j<6;j++)if(t.bindFramebuffer(s.FRAMEBUFFER,_.__webglFramebuffer[j]),_.__webglDepthbuffer[j]===void 0)_.__webglDepthbuffer[j]=s.createRenderbuffer(),ut(_.__webglDepthbuffer[j],E,!1);else{const J=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,te=_.__webglDepthbuffer[j];s.bindRenderbuffer(s.RENDERBUFFER,te),s.framebufferRenderbuffer(s.FRAMEBUFFER,J,s.RENDERBUFFER,te)}}else{const j=E.texture.mipmaps;if(j&&j.length>0?t.bindFramebuffer(s.FRAMEBUFFER,_.__webglFramebuffer[0]):t.bindFramebuffer(s.FRAMEBUFFER,_.__webglFramebuffer),_.__webglDepthbuffer===void 0)_.__webglDepthbuffer=s.createRenderbuffer(),ut(_.__webglDepthbuffer,E,!1);else{const J=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,te=_.__webglDepthbuffer;s.bindRenderbuffer(s.RENDERBUFFER,te),s.framebufferRenderbuffer(s.FRAMEBUFFER,J,s.RENDERBUFFER,te)}}t.bindFramebuffer(s.FRAMEBUFFER,null)}function ct(E,_,O){const j=n.get(E);_!==void 0&&Re(j.__webglFramebuffer,E,E.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),O!==void 0&&tt(E)}function Ve(E){const _=E.texture,O=n.get(E),j=n.get(_);E.addEventListener("dispose",M);const J=E.textures,te=E.isWebGLCubeRenderTarget===!0,oe=J.length>1;if(oe||(j.__webglTexture===void 0&&(j.__webglTexture=s.createTexture()),j.__version=_.version,a.memory.textures++),te){O.__webglFramebuffer=[];for(let q=0;q<6;q++)if(_.mipmaps&&_.mipmaps.length>0){O.__webglFramebuffer[q]=[];for(let K=0;K<_.mipmaps.length;K++)O.__webglFramebuffer[q][K]=s.createFramebuffer()}else O.__webglFramebuffer[q]=s.createFramebuffer()}else{if(_.mipmaps&&_.mipmaps.length>0){O.__webglFramebuffer=[];for(let q=0;q<_.mipmaps.length;q++)O.__webglFramebuffer[q]=s.createFramebuffer()}else O.__webglFramebuffer=s.createFramebuffer();if(oe)for(let q=0,K=J.length;q<K;q++){const pe=n.get(J[q]);pe.__webglTexture===void 0&&(pe.__webglTexture=s.createTexture(),a.memory.textures++)}if(E.samples>0&&Xe(E)===!1){O.__webglMultisampledFramebuffer=s.createFramebuffer(),O.__webglColorRenderbuffer=[],t.bindFramebuffer(s.FRAMEBUFFER,O.__webglMultisampledFramebuffer);for(let q=0;q<J.length;q++){const K=J[q];O.__webglColorRenderbuffer[q]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,O.__webglColorRenderbuffer[q]);const pe=r.convert(K.format,K.colorSpace),xe=r.convert(K.type),re=b(K.internalFormat,pe,xe,K.normalized,K.colorSpace,E.isXRRenderTarget===!0),ne=yt(E);s.renderbufferStorageMultisample(s.RENDERBUFFER,ne,re,E.width,E.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+q,s.RENDERBUFFER,O.__webglColorRenderbuffer[q])}s.bindRenderbuffer(s.RENDERBUFFER,null),E.depthBuffer&&(O.__webglDepthRenderbuffer=s.createRenderbuffer(),ut(O.__webglDepthRenderbuffer,E,!0)),t.bindFramebuffer(s.FRAMEBUFFER,null)}}if(te){t.bindTexture(s.TEXTURE_CUBE_MAP,j.__webglTexture),Ue(s.TEXTURE_CUBE_MAP,_);for(let q=0;q<6;q++)if(_.mipmaps&&_.mipmaps.length>0)for(let K=0;K<_.mipmaps.length;K++)Re(O.__webglFramebuffer[q][K],E,_,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+q,K);else Re(O.__webglFramebuffer[q],E,_,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+q,0);p(_)&&v(s.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(oe){for(let q=0,K=J.length;q<K;q++){const pe=J[q],xe=n.get(pe);let re=s.TEXTURE_2D;(E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(re=E.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),t.bindTexture(re,xe.__webglTexture),Ue(re,pe),Re(O.__webglFramebuffer,E,pe,s.COLOR_ATTACHMENT0+q,re,0),p(pe)&&v(re)}t.unbindTexture()}else{let q=s.TEXTURE_2D;if((E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(q=E.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),t.bindTexture(q,j.__webglTexture),Ue(q,_),_.mipmaps&&_.mipmaps.length>0)for(let K=0;K<_.mipmaps.length;K++)Re(O.__webglFramebuffer[K],E,_,s.COLOR_ATTACHMENT0,q,K);else Re(O.__webglFramebuffer,E,_,s.COLOR_ATTACHMENT0,q,0);p(_)&&v(q),t.unbindTexture()}E.depthBuffer&&tt(E)}function St(E){const _=E.textures;for(let O=0,j=_.length;O<j;O++){const J=_[O];if(p(J)){const te=S(E),oe=n.get(J).__webglTexture;t.bindTexture(te,oe),v(te),t.unbindTexture()}}}const dt=[],zt=[];function D(E){if(E.samples>0){if(Xe(E)===!1){const _=E.textures,O=E.width,j=E.height;let J=s.COLOR_BUFFER_BIT;const te=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,oe=n.get(E),q=_.length>1;if(q)for(let pe=0;pe<_.length;pe++)t.bindFramebuffer(s.FRAMEBUFFER,oe.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+pe,s.RENDERBUFFER,null),t.bindFramebuffer(s.FRAMEBUFFER,oe.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+pe,s.TEXTURE_2D,null,0);t.bindFramebuffer(s.READ_FRAMEBUFFER,oe.__webglMultisampledFramebuffer);const K=E.texture.mipmaps;K&&K.length>0?t.bindFramebuffer(s.DRAW_FRAMEBUFFER,oe.__webglFramebuffer[0]):t.bindFramebuffer(s.DRAW_FRAMEBUFFER,oe.__webglFramebuffer);for(let pe=0;pe<_.length;pe++){if(E.resolveDepthBuffer&&(E.depthBuffer&&(J|=s.DEPTH_BUFFER_BIT),E.stencilBuffer&&E.resolveStencilBuffer&&(J|=s.STENCIL_BUFFER_BIT)),q){s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,oe.__webglColorRenderbuffer[pe]);const xe=n.get(_[pe]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,xe,0)}s.blitFramebuffer(0,0,O,j,0,0,O,j,J,s.NEAREST),l===!0&&(dt.length=0,zt.length=0,dt.push(s.COLOR_ATTACHMENT0+pe),E.depthBuffer&&E.resolveDepthBuffer===!1&&(dt.push(te),zt.push(te),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,zt)),s.invalidateFramebuffer(s.READ_FRAMEBUFFER,dt))}if(t.bindFramebuffer(s.READ_FRAMEBUFFER,null),t.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),q)for(let pe=0;pe<_.length;pe++){t.bindFramebuffer(s.FRAMEBUFFER,oe.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+pe,s.RENDERBUFFER,oe.__webglColorRenderbuffer[pe]);const xe=n.get(_[pe]).__webglTexture;t.bindFramebuffer(s.FRAMEBUFFER,oe.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+pe,s.TEXTURE_2D,xe,0)}t.bindFramebuffer(s.DRAW_FRAMEBUFFER,oe.__webglMultisampledFramebuffer)}else if(E.depthBuffer&&E.resolveDepthBuffer===!1&&l){const _=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[_])}}}function yt(E){return Math.min(i.maxSamples,E.samples)}function Xe(E){const _=n.get(E);return E.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&_.__useRenderToTexture!==!1}function ot(E){const _=a.render.frame;h.get(E)!==_&&(h.set(E,_),E.update())}function le(E,_){const O=E.colorSpace,j=E.format,J=E.type;return E.isCompressedTexture===!0||E.isVideoTexture===!0||O!==Xt&&O!==Yn&&(He.getTransfer(O)===$e?(j!==Zt||J!==Wt)&&Se("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ae("WebGLTextures: Unsupported texture color space:",O)),_}function ft(E){return typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement?(c.width=E.naturalWidth||E.width,c.height=E.naturalHeight||E.height):typeof VideoFrame<"u"&&E instanceof VideoFrame?(c.width=E.displayWidth,c.height=E.displayHeight):(c.width=E.width,c.height=E.height),c}this.allocateTextureUnit=B,this.resetTextureUnits=G,this.getTextureUnits=W,this.setTextureUnits=N,this.setTexture2D=Q,this.setTexture2DArray=ee,this.setTexture3D=he,this.setTextureCube=ve,this.rebindTextures=ct,this.setupRenderTarget=Ve,this.updateRenderTargetMipmap=St,this.updateMultisampleRenderTarget=D,this.setupDepthRenderbuffer=tt,this.setupFrameBufferTexture=Re,this.useMultisampledRTT=Xe,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function px(s,e){function t(n,i=Yn){let r;const a=He.getTransfer(i);if(n===Wt)return s.UNSIGNED_BYTE;if(n===mo)return s.UNSIGNED_SHORT_4_4_4_4;if(n===go)return s.UNSIGNED_SHORT_5_5_5_1;if(n===Yc)return s.UNSIGNED_INT_5_9_9_9_REV;if(n===jc)return s.UNSIGNED_INT_10F_11F_11F_REV;if(n===Xc)return s.BYTE;if(n===qc)return s.SHORT;if(n===gs)return s.UNSIGNED_SHORT;if(n===po)return s.INT;if(n===xn)return s.UNSIGNED_INT;if(n===Kt)return s.FLOAT;if(n===Nn)return s.HALF_FLOAT;if(n===Kc)return s.ALPHA;if(n===Zc)return s.RGB;if(n===Zt)return s.RGBA;if(n===Un)return s.DEPTH_COMPONENT;if(n===ci)return s.DEPTH_STENCIL;if(n===xo)return s.RED;if(n===_o)return s.RED_INTEGER;if(n===di)return s.RG;if(n===vo)return s.RG_INTEGER;if(n===Mo)return s.RGBA_INTEGER;if(n===ir||n===sr||n===rr||n===ar)if(a===$e)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===ir)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===sr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===rr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===ar)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===ir)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===sr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===rr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===ar)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Ta||n===Ea||n===wa||n===Aa)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Ta)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Ea)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===wa)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Aa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Ra||n===Ca||n===La||n===Pa||n===Da||n===cr||n===Ia)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Ra||n===Ca)return a===$e?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===La)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Pa)return r.COMPRESSED_R11_EAC;if(n===Da)return r.COMPRESSED_SIGNED_R11_EAC;if(n===cr)return r.COMPRESSED_RG11_EAC;if(n===Ia)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Na||n===Ua||n===Fa||n===Oa||n===Ba||n===ka||n===za||n===Va||n===Ha||n===Ga||n===Wa||n===Xa||n===qa||n===Ya)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Na)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Ua)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Fa)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Oa)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Ba)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===ka)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===za)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Va)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Ha)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Ga)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Wa)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Xa)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===qa)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===Ya)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===ja||n===Ka||n===Za)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===ja)return a===$e?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Ka)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Za)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===$a||n===Ja||n===hr||n===Qa)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===$a)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Ja)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===hr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Qa)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===xs?s.UNSIGNED_INT_24_8:s[n]!==void 0?s[n]:null}return{convert:t}}const mx=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,gx=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class xx{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new ch(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new _n({vertexShader:mx,fragmentShader:gx,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new kt(new ys(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class _x extends fi{constructor(e,t){super();const n=this;let i=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,d=null,u=null,f=null,g=null;const x=typeof XRWebGLBinding<"u",m=new xx,p={},v=t.getContextAttributes();let S=null,b=null;const A=[],T=[],R=new qe;let M=null;const w=new Ut;w.viewport=new st;const P=new Ut;P.viewport=new st;const C=[w,P],F=new vf;let G=null,W=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Z){let fe=A[Z];return fe===void 0&&(fe=new Or,A[Z]=fe),fe.getTargetRaySpace()},this.getControllerGrip=function(Z){let fe=A[Z];return fe===void 0&&(fe=new Or,A[Z]=fe),fe.getGripSpace()},this.getHand=function(Z){let fe=A[Z];return fe===void 0&&(fe=new Or,A[Z]=fe),fe.getHandSpace()};function N(Z){const fe=T.indexOf(Z.inputSource);if(fe===-1)return;const se=A[fe];se!==void 0&&(se.update(Z.inputSource,Z.frame,c||a),se.dispatchEvent({type:Z.type,data:Z.inputSource}))}function B(){i.removeEventListener("select",N),i.removeEventListener("selectstart",N),i.removeEventListener("selectend",N),i.removeEventListener("squeeze",N),i.removeEventListener("squeezestart",N),i.removeEventListener("squeezeend",N),i.removeEventListener("end",B),i.removeEventListener("inputsourceschange",V);for(let Z=0;Z<A.length;Z++){const fe=T[Z];fe!==null&&(T[Z]=null,A[Z].disconnect(fe))}G=null,W=null,m.reset();for(const Z in p)delete p[Z];e.setRenderTarget(S),f=null,u=null,d=null,i=null,b=null,Ue.stop(),n.isPresenting=!1,e.setPixelRatio(M),e.setSize(R.width,R.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Z){r=Z,n.isPresenting===!0&&Se("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Z){o=Z,n.isPresenting===!0&&Se("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Z){c=Z},this.getBaseLayer=function(){return u!==null?u:f},this.getBinding=function(){return d===null&&x&&(d=new XRWebGLBinding(i,t)),d},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(Z){if(i=Z,i!==null){if(S=e.getRenderTarget(),i.addEventListener("select",N),i.addEventListener("selectstart",N),i.addEventListener("selectend",N),i.addEventListener("squeeze",N),i.addEventListener("squeezestart",N),i.addEventListener("squeezeend",N),i.addEventListener("end",B),i.addEventListener("inputsourceschange",V),v.xrCompatible!==!0&&await t.makeXRCompatible(),M=e.getPixelRatio(),e.getSize(R),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let se=null,we=null,Pe=null;v.depth&&(Pe=v.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,se=v.stencil?ci:Un,we=v.stencil?xs:xn);const Re={colorFormat:t.RGBA8,depthFormat:Pe,scaleFactor:r};d=this.getBinding(),u=d.createProjectionLayer(Re),i.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),b=new rn(u.textureWidth,u.textureHeight,{format:Zt,type:Wt,depthTexture:new zi(u.textureWidth,u.textureHeight,we,void 0,void 0,void 0,void 0,void 0,void 0,se),stencilBuffer:v.stencil,colorSpace:e.outputColorSpace,samples:v.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{const se={antialias:v.antialias,alpha:!0,depth:v.depth,stencil:v.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(i,t,se),i.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),b=new rn(f.framebufferWidth,f.framebufferHeight,{format:Zt,type:Wt,colorSpace:e.outputColorSpace,stencilBuffer:v.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}b.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await i.requestReferenceSpace(o),Ue.setContext(i),Ue.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function V(Z){for(let fe=0;fe<Z.removed.length;fe++){const se=Z.removed[fe],we=T.indexOf(se);we>=0&&(T[we]=null,A[we].disconnect(se))}for(let fe=0;fe<Z.added.length;fe++){const se=Z.added[fe];let we=T.indexOf(se);if(we===-1){for(let Re=0;Re<A.length;Re++)if(Re>=T.length){T.push(se),we=Re;break}else if(T[Re]===null){T[Re]=se,we=Re;break}if(we===-1)break}const Pe=A[we];Pe&&Pe.connect(se)}}const Q=new U,ee=new U;function he(Z,fe,se){Q.setFromMatrixPosition(fe.matrixWorld),ee.setFromMatrixPosition(se.matrixWorld);const we=Q.distanceTo(ee),Pe=fe.projectionMatrix.elements,Re=se.projectionMatrix.elements,ut=Pe[14]/(Pe[10]-1),We=Pe[14]/(Pe[10]+1),tt=(Pe[9]+1)/Pe[5],ct=(Pe[9]-1)/Pe[5],Ve=(Pe[8]-1)/Pe[0],St=(Re[8]+1)/Re[0],dt=ut*Ve,zt=ut*St,D=we/(-Ve+St),yt=D*-Ve;if(fe.matrixWorld.decompose(Z.position,Z.quaternion,Z.scale),Z.translateX(yt),Z.translateZ(D),Z.matrixWorld.compose(Z.position,Z.quaternion,Z.scale),Z.matrixWorldInverse.copy(Z.matrixWorld).invert(),Pe[10]===-1)Z.projectionMatrix.copy(fe.projectionMatrix),Z.projectionMatrixInverse.copy(fe.projectionMatrixInverse);else{const Xe=ut+D,ot=We+D,le=dt-yt,ft=zt+(we-yt),E=tt*We/ot*Xe,_=ct*We/ot*Xe;Z.projectionMatrix.makePerspective(le,ft,E,_,Xe,ot),Z.projectionMatrixInverse.copy(Z.projectionMatrix).invert()}}function ve(Z,fe){fe===null?Z.matrixWorld.copy(Z.matrix):Z.matrixWorld.multiplyMatrices(fe.matrixWorld,Z.matrix),Z.matrixWorldInverse.copy(Z.matrixWorld).invert()}this.updateCamera=function(Z){if(i===null)return;let fe=Z.near,se=Z.far;m.texture!==null&&(m.depthNear>0&&(fe=m.depthNear),m.depthFar>0&&(se=m.depthFar)),F.near=P.near=w.near=fe,F.far=P.far=w.far=se,(G!==F.near||W!==F.far)&&(i.updateRenderState({depthNear:F.near,depthFar:F.far}),G=F.near,W=F.far),F.layers.mask=Z.layers.mask|6,w.layers.mask=F.layers.mask&-5,P.layers.mask=F.layers.mask&-3;const we=Z.parent,Pe=F.cameras;ve(F,we);for(let Re=0;Re<Pe.length;Re++)ve(Pe[Re],we);Pe.length===2?he(F,w,P):F.projectionMatrix.copy(w.projectionMatrix),Te(Z,F,we)};function Te(Z,fe,se){se===null?Z.matrix.copy(fe.matrixWorld):(Z.matrix.copy(se.matrixWorld),Z.matrix.invert(),Z.matrix.multiply(fe.matrixWorld)),Z.matrix.decompose(Z.position,Z.quaternion,Z.scale),Z.updateMatrixWorld(!0),Z.projectionMatrix.copy(fe.projectionMatrix),Z.projectionMatrixInverse.copy(fe.projectionMatrixInverse),Z.isPerspectiveCamera&&(Z.fov=ki*2*Math.atan(1/Z.projectionMatrix.elements[5]),Z.zoom=1)}this.getCamera=function(){return F},this.getFoveation=function(){if(!(u===null&&f===null))return l},this.setFoveation=function(Z){l=Z,u!==null&&(u.fixedFoveation=Z),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Z)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(F)},this.getCameraTexture=function(Z){return p[Z]};let Ye=null;function et(Z,fe){if(h=fe.getViewerPose(c||a),g=fe,h!==null){const se=h.views;f!==null&&(e.setRenderTargetFramebuffer(b,f.framebuffer),e.setRenderTarget(b));let we=!1;se.length!==F.cameras.length&&(F.cameras.length=0,we=!0);for(let We=0;We<se.length;We++){const tt=se[We];let ct=null;if(f!==null)ct=f.getViewport(tt);else{const St=d.getViewSubImage(u,tt);ct=St.viewport,We===0&&(e.setRenderTargetTextures(b,St.colorTexture,St.depthStencilTexture),e.setRenderTarget(b))}let Ve=C[We];Ve===void 0&&(Ve=new Ut,Ve.layers.enable(We),Ve.viewport=new st,C[We]=Ve),Ve.matrix.fromArray(tt.transform.matrix),Ve.matrix.decompose(Ve.position,Ve.quaternion,Ve.scale),Ve.projectionMatrix.fromArray(tt.projectionMatrix),Ve.projectionMatrixInverse.copy(Ve.projectionMatrix).invert(),Ve.viewport.set(ct.x,ct.y,ct.width,ct.height),We===0&&(F.matrix.copy(Ve.matrix),F.matrix.decompose(F.position,F.quaternion,F.scale)),we===!0&&F.cameras.push(Ve)}const Pe=i.enabledFeatures;if(Pe&&Pe.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&x){d=n.getBinding();const We=d.getDepthInformation(se[0]);We&&We.isValid&&We.texture&&m.init(We,i.renderState)}if(Pe&&Pe.includes("camera-access")&&x){e.state.unbindTexture(),d=n.getBinding();for(let We=0;We<se.length;We++){const tt=se[We].camera;if(tt){let ct=p[tt];ct||(ct=new ch,p[tt]=ct);const Ve=d.getCameraImage(tt);ct.sourceTexture=Ve}}}}for(let se=0;se<A.length;se++){const we=T[se],Pe=A[se];we!==null&&Pe!==void 0&&Pe.update(we,fe,c||a)}Ye&&Ye(Z,fe),fe.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:fe}),g=null}const Ue=new gh;Ue.setAnimationLoop(et),this.setAnimationLoop=function(Z){Ye=Z},this.dispose=function(){}}}const vx=new ke,bh=new De;bh.set(-1,0,0,0,1,0,0,0,1);function Mx(s,e){function t(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,hh(s)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function i(m,p,v,S,b){p.isNodeMaterial?p.uniformsNeedUpdate=!1:p.isMeshBasicMaterial?r(m,p):p.isMeshLambertMaterial?(r(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(r(m,p),d(m,p)):p.isMeshPhongMaterial?(r(m,p),h(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(r(m,p),u(m,p),p.isMeshPhysicalMaterial&&f(m,p,b)):p.isMeshMatcapMaterial?(r(m,p),g(m,p)):p.isMeshDepthMaterial?r(m,p):p.isMeshDistanceMaterial?(r(m,p),x(m,p)):p.isMeshNormalMaterial?r(m,p):p.isLineBasicMaterial?(a(m,p),p.isLineDashedMaterial&&o(m,p)):p.isPointsMaterial?l(m,p,v,S):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,t(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===Bt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,t(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===Bt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,t(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,t(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);const v=e.get(p),S=v.envMap,b=v.envMapRotation;S&&(m.envMap.value=S,m.envMapRotation.value.setFromMatrix4(vx.makeRotationFromEuler(b)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(bh),m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,m.aoMapTransform))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform))}function o(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,v,S){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*v,m.scale.value=S*.5,p.map&&(m.map.value=p.map,t(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function h(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function d(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function u(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,v){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Bt&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=v.texture,m.transmissionSamplerSize.value.set(v.width,v.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function x(m,p){const v=e.get(p).light;m.referencePosition.value.setFromMatrixPosition(v.matrixWorld),m.nearDistance.value=v.shadow.camera.near,m.farDistance.value=v.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function Sx(s,e,t,n){let i={},r={},a=[];const o=s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS);function l(v,S){const b=S.program;n.uniformBlockBinding(v,b)}function c(v,S){let b=i[v.id];b===void 0&&(g(v),b=h(v),i[v.id]=b,v.addEventListener("dispose",m));const A=S.program;n.updateUBOMapping(v,A);const T=e.render.frame;r[v.id]!==T&&(u(v),r[v.id]=T)}function h(v){const S=d();v.__bindingPointIndex=S;const b=s.createBuffer(),A=v.__size,T=v.usage;return s.bindBuffer(s.UNIFORM_BUFFER,b),s.bufferData(s.UNIFORM_BUFFER,A,T),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,S,b),b}function d(){for(let v=0;v<o;v++)if(a.indexOf(v)===-1)return a.push(v),v;return Ae("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(v){const S=i[v.id],b=v.uniforms,A=v.__cache;s.bindBuffer(s.UNIFORM_BUFFER,S);for(let T=0,R=b.length;T<R;T++){const M=Array.isArray(b[T])?b[T]:[b[T]];for(let w=0,P=M.length;w<P;w++){const C=M[w];if(f(C,T,w,A)===!0){const F=C.__offset,G=Array.isArray(C.value)?C.value:[C.value];let W=0;for(let N=0;N<G.length;N++){const B=G[N],V=x(B);typeof B=="number"||typeof B=="boolean"?(C.__data[0]=B,s.bufferSubData(s.UNIFORM_BUFFER,F+W,C.__data)):B.isMatrix3?(C.__data[0]=B.elements[0],C.__data[1]=B.elements[1],C.__data[2]=B.elements[2],C.__data[3]=0,C.__data[4]=B.elements[3],C.__data[5]=B.elements[4],C.__data[6]=B.elements[5],C.__data[7]=0,C.__data[8]=B.elements[6],C.__data[9]=B.elements[7],C.__data[10]=B.elements[8],C.__data[11]=0):ArrayBuffer.isView(B)?C.__data.set(new B.constructor(B.buffer,B.byteOffset,C.__data.length)):(B.toArray(C.__data,W),W+=V.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,F,C.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function f(v,S,b,A){const T=v.value,R=S+"_"+b;if(A[R]===void 0)return typeof T=="number"||typeof T=="boolean"?A[R]=T:ArrayBuffer.isView(T)?A[R]=T.slice():A[R]=T.clone(),!0;{const M=A[R];if(typeof T=="number"||typeof T=="boolean"){if(M!==T)return A[R]=T,!0}else{if(ArrayBuffer.isView(T))return!0;if(M.equals(T)===!1)return M.copy(T),!0}}return!1}function g(v){const S=v.uniforms;let b=0;const A=16;for(let R=0,M=S.length;R<M;R++){const w=Array.isArray(S[R])?S[R]:[S[R]];for(let P=0,C=w.length;P<C;P++){const F=w[P],G=Array.isArray(F.value)?F.value:[F.value];for(let W=0,N=G.length;W<N;W++){const B=G[W],V=x(B),Q=b%A,ee=Q%V.boundary,he=Q+ee;b+=ee,he!==0&&A-he<V.storage&&(b+=A-he),F.__data=new Float32Array(V.storage/Float32Array.BYTES_PER_ELEMENT),F.__offset=b,b+=V.storage}}}const T=b%A;return T>0&&(b+=A-T),v.__size=b,v.__cache={},this}function x(v){const S={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(S.boundary=4,S.storage=4):v.isVector2?(S.boundary=8,S.storage=8):v.isVector3||v.isColor?(S.boundary=16,S.storage=12):v.isVector4?(S.boundary=16,S.storage=16):v.isMatrix3?(S.boundary=48,S.storage=48):v.isMatrix4?(S.boundary=64,S.storage=64):v.isTexture?Se("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(S.boundary=16,S.storage=v.byteLength):Se("WebGLRenderer: Unsupported uniform value type.",v),S}function m(v){const S=v.target;S.removeEventListener("dispose",m);const b=a.indexOf(S.__bindingPointIndex);a.splice(b,1),s.deleteBuffer(i[S.id]),delete i[S.id],delete r[S.id]}function p(){for(const v in i)s.deleteBuffer(i[v]);a=[],i={},r={}}return{bind:l,update:c,dispose:p}}const yx=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let hn=null;function bx(){return hn===null&&(hn=new Ao(yx,16,16,di,Nn),hn.name="DFG_LUT",hn.minFilter=Tt,hn.magFilter=Tt,hn.wrapS=fn,hn.wrapT=fn,hn.generateMipmaps=!1,hn.needsUpdate=!0),hn}class Tx{constructor(e={}){const{canvas:t=Wu(),context:n=null,depth:i=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:u=!1,outputBufferType:f=Wt}=e;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=a;const x=f,m=new Set([Mo,vo,_o]),p=new Set([Wt,xn,gs,xs,mo,go]),v=new Uint32Array(4),S=new Int32Array(4),b=new U;let A=null,T=null;const R=[],M=[];let w=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=mn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const P=this;let C=!1,F=null;this._outputColorSpace=Ct;let G=0,W=0,N=null,B=-1,V=null;const Q=new st,ee=new st;let he=null;const ve=new Ce(0);let Te=0,Ye=t.width,et=t.height,Ue=1,Z=null,fe=null;const se=new st(0,0,Ye,et),we=new st(0,0,Ye,et);let Pe=!1;const Re=new Co;let ut=!1,We=!1;const tt=new ke,ct=new U,Ve=new st,St={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let dt=!1;function zt(){return N===null?Ue:1}let D=n;function yt(y,I){return t.getContext(y,I)}try{const y={alpha:!0,depth:i,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${fo}`),t.addEventListener("webglcontextlost",$,!1),t.addEventListener("webglcontextrestored",ye,!1),t.addEventListener("webglcontextcreationerror",Ie,!1),D===null){const I="webgl2";if(D=yt(I,y),D===null)throw yt(I)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(y){throw Ae("WebGLRenderer: "+y.message),y}let Xe,ot,le,ft,E,_,O,j,J,te,oe,q,K,pe,xe,re,ne,Le,Fe,Ke,L,ie,Y;function me(){Xe=new bg(D),Xe.init(),L=new px(D,Xe),ot=new mg(D,Xe,e,L),le=new dx(D,Xe),ot.reversedDepthBuffer&&u&&le.buffers.depth.setReversed(!0),ft=new wg(D),E=new J0,_=new fx(D,Xe,le,E,ot,L,ft),O=new yg(P),j=new Lf(D),ie=new fg(D,j),J=new Tg(D,j,ft,ie),te=new Rg(D,J,j,ie,ft),Le=new Ag(D,ot,_),xe=new gg(E),oe=new $0(P,O,Xe,ot,ie,xe),q=new Mx(P,E),K=new ex,pe=new ax(Xe),ne=new dg(P,O,le,te,g,l),re=new ux(P,te,ot),Y=new Sx(D,ft,ot,le),Fe=new pg(D,Xe,ft),Ke=new Eg(D,Xe,ft),ft.programs=oe.programs,P.capabilities=ot,P.extensions=Xe,P.properties=E,P.renderLists=K,P.shadowMap=re,P.state=le,P.info=ft}me(),x!==Wt&&(w=new Lg(x,t.width,t.height,i,r));const ae=new _x(P,D);this.xr=ae,this.getContext=function(){return D},this.getContextAttributes=function(){return D.getContextAttributes()},this.forceContextLoss=function(){const y=Xe.get("WEBGL_lose_context");y&&y.loseContext()},this.forceContextRestore=function(){const y=Xe.get("WEBGL_lose_context");y&&y.restoreContext()},this.getPixelRatio=function(){return Ue},this.setPixelRatio=function(y){y!==void 0&&(Ue=y,this.setSize(Ye,et,!1))},this.getSize=function(y){return y.set(Ye,et)},this.setSize=function(y,I,H=!0){if(ae.isPresenting){Se("WebGLRenderer: Can't change size while VR device is presenting.");return}Ye=y,et=I,t.width=Math.floor(y*Ue),t.height=Math.floor(I*Ue),H===!0&&(t.style.width=y+"px",t.style.height=I+"px"),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,y,I)},this.getDrawingBufferSize=function(y){return y.set(Ye*Ue,et*Ue).floor()},this.setDrawingBufferSize=function(y,I,H){Ye=y,et=I,Ue=H,t.width=Math.floor(y*H),t.height=Math.floor(I*H),this.setViewport(0,0,y,I)},this.setEffects=function(y){if(x===Wt){Ae("THREE.WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(y){for(let I=0;I<y.length;I++)if(y[I].isOutputPass===!0){Se("THREE.WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}w.setEffects(y||[])},this.getCurrentViewport=function(y){return y.copy(Q)},this.getViewport=function(y){return y.copy(se)},this.setViewport=function(y,I,H,k){y.isVector4?se.set(y.x,y.y,y.z,y.w):se.set(y,I,H,k),le.viewport(Q.copy(se).multiplyScalar(Ue).round())},this.getScissor=function(y){return y.copy(we)},this.setScissor=function(y,I,H,k){y.isVector4?we.set(y.x,y.y,y.z,y.w):we.set(y,I,H,k),le.scissor(ee.copy(we).multiplyScalar(Ue).round())},this.getScissorTest=function(){return Pe},this.setScissorTest=function(y){le.setScissorTest(Pe=y)},this.setOpaqueSort=function(y){Z=y},this.setTransparentSort=function(y){fe=y},this.getClearColor=function(y){return y.copy(ne.getClearColor())},this.setClearColor=function(){ne.setClearColor(...arguments)},this.getClearAlpha=function(){return ne.getClearAlpha()},this.setClearAlpha=function(){ne.setClearAlpha(...arguments)},this.clear=function(y=!0,I=!0,H=!0){let k=0;if(y){let z=!1;if(N!==null){const de=N.texture.format;z=m.has(de)}if(z){const de=N.texture.type,_e=p.has(de),ue=ne.getClearColor(),Me=ne.getClearAlpha(),be=ue.r,Ne=ue.g,Be=ue.b;_e?(v[0]=be,v[1]=Ne,v[2]=Be,v[3]=Me,D.clearBufferuiv(D.COLOR,0,v)):(S[0]=be,S[1]=Ne,S[2]=Be,S[3]=Me,D.clearBufferiv(D.COLOR,0,S))}else k|=D.COLOR_BUFFER_BIT}I&&(k|=D.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),H&&(k|=D.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),k!==0&&D.clear(k)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(y){y.setRenderer(this),F=y},this.dispose=function(){t.removeEventListener("webglcontextlost",$,!1),t.removeEventListener("webglcontextrestored",ye,!1),t.removeEventListener("webglcontextcreationerror",Ie,!1),ne.dispose(),K.dispose(),pe.dispose(),E.dispose(),O.dispose(),te.dispose(),ie.dispose(),Y.dispose(),oe.dispose(),ae.dispose(),ae.removeEventListener("sessionstart",Ho),ae.removeEventListener("sessionend",Go),Jn.stop()};function $(y){y.preventDefault(),dr("WebGLRenderer: Context Lost."),C=!0}function ye(){dr("WebGLRenderer: Context Restored."),C=!1;const y=ft.autoReset,I=re.enabled,H=re.autoUpdate,k=re.needsUpdate,z=re.type;me(),ft.autoReset=y,re.enabled=I,re.autoUpdate=H,re.needsUpdate=k,re.type=z}function Ie(y){Ae("WebGLRenderer: A WebGL context could not be created. Reason: ",y.statusMessage)}function mt(y){const I=y.target;I.removeEventListener("dispose",mt),nt(I)}function nt(y){yn(y),E.remove(y)}function yn(y){const I=E.get(y).programs;I!==void 0&&(I.forEach(function(H){oe.releaseProgram(H)}),y.isShaderMaterial&&oe.releaseShaderCache(y))}this.renderBufferDirect=function(y,I,H,k,z,de){I===null&&(I=St);const _e=z.isMesh&&z.matrixWorld.determinant()<0,ue=kh(y,I,H,k,z);le.setMaterial(k,_e);let Me=H.index,be=1;if(k.wireframe===!0){if(Me=J.getWireframeAttribute(H),Me===void 0)return;be=2}const Ne=H.drawRange,Be=H.attributes.position;let Ee=Ne.start*be,it=(Ne.start+Ne.count)*be;de!==null&&(Ee=Math.max(Ee,de.start*be),it=Math.min(it,(de.start+de.count)*be)),Me!==null?(Ee=Math.max(Ee,0),it=Math.min(it,Me.count)):Be!=null&&(Ee=Math.max(Ee,0),it=Math.min(it,Be.count));const gt=it-Ee;if(gt<0||gt===1/0)return;ie.setup(z,k,ue,H,Me);let pt,rt=Fe;if(Me!==null&&(pt=j.get(Me),rt=Ke,rt.setIndex(pt)),z.isMesh)k.wireframe===!0?(le.setLineWidth(k.wireframeLinewidth*zt()),rt.setMode(D.LINES)):rt.setMode(D.TRIANGLES);else if(z.isLine){let Lt=k.linewidth;Lt===void 0&&(Lt=1),le.setLineWidth(Lt*zt()),z.isLineSegments?rt.setMode(D.LINES):z.isLineLoop?rt.setMode(D.LINE_LOOP):rt.setMode(D.LINE_STRIP)}else z.isPoints?rt.setMode(D.POINTS):z.isSprite&&rt.setMode(D.TRIANGLES);if(z.isBatchedMesh)if(Xe.get("WEBGL_multi_draw"))rt.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{const Lt=z._multiDrawStarts,ge=z._multiDrawCounts,Vt=z._multiDrawCount,je=Me?j.get(Me).bytesPerElement:1,qt=E.get(k).currentProgram.getUniforms();for(let ln=0;ln<Vt;ln++)qt.setValue(D,"_gl_DrawID",ln),rt.render(Lt[ln]/je,ge[ln])}else if(z.isInstancedMesh)rt.renderInstances(Ee,gt,z.count);else if(H.isInstancedBufferGeometry){const Lt=H._maxInstanceCount!==void 0?H._maxInstanceCount:1/0,ge=Math.min(H.instanceCount,Lt);rt.renderInstances(Ee,gt,ge)}else rt.render(Ee,gt)};function on(y,I,H){y.transparent===!0&&y.side===en&&y.forceSinglePass===!1?(y.side=Bt,y.needsUpdate=!0,Es(y,I,H),y.side=In,y.needsUpdate=!0,Es(y,I,H),y.side=en):Es(y,I,H)}this.compile=function(y,I,H=null){H===null&&(H=y),T=pe.get(H),T.init(I),M.push(T),H.traverseVisible(function(z){z.isLight&&z.layers.test(I.layers)&&(T.pushLight(z),z.castShadow&&T.pushShadow(z))}),y!==H&&y.traverseVisible(function(z){z.isLight&&z.layers.test(I.layers)&&(T.pushLight(z),z.castShadow&&T.pushShadow(z))}),T.setupLights();const k=new Set;return y.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;const de=z.material;if(de)if(Array.isArray(de))for(let _e=0;_e<de.length;_e++){const ue=de[_e];on(ue,H,z),k.add(ue)}else on(de,H,z),k.add(de)}),T=M.pop(),k},this.compileAsync=function(y,I,H=null){const k=this.compile(y,I,H);return new Promise(z=>{function de(){if(k.forEach(function(_e){E.get(_e).currentProgram.isReady()&&k.delete(_e)}),k.size===0){z(y);return}setTimeout(de,10)}Xe.get("KHR_parallel_shader_compile")!==null?de():setTimeout(de,10)})};let Tr=null;function Oh(y){Tr&&Tr(y)}function Ho(){Jn.stop()}function Go(){Jn.start()}const Jn=new gh;Jn.setAnimationLoop(Oh),typeof self<"u"&&Jn.setContext(self),this.setAnimationLoop=function(y){Tr=y,ae.setAnimationLoop(y),y===null?Jn.stop():Jn.start()},ae.addEventListener("sessionstart",Ho),ae.addEventListener("sessionend",Go),this.render=function(y,I){if(I!==void 0&&I.isCamera!==!0){Ae("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(C===!0)return;F!==null&&F.renderStart(y,I);const H=ae.enabled===!0&&ae.isPresenting===!0,k=w!==null&&(N===null||H)&&w.begin(P,N);if(y.matrixWorldAutoUpdate===!0&&y.updateMatrixWorld(),I.parent===null&&I.matrixWorldAutoUpdate===!0&&I.updateMatrixWorld(),ae.enabled===!0&&ae.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(ae.cameraAutoUpdate===!0&&ae.updateCamera(I),I=ae.getCamera()),y.isScene===!0&&y.onBeforeRender(P,y,I,N),T=pe.get(y,M.length),T.init(I),T.state.textureUnits=_.getTextureUnits(),M.push(T),tt.multiplyMatrices(I.projectionMatrix,I.matrixWorldInverse),Re.setFromProjectionMatrix(tt,pn,I.reversedDepth),We=this.localClippingEnabled,ut=xe.init(this.clippingPlanes,We),A=K.get(y,R.length),A.init(),R.push(A),ae.enabled===!0&&ae.isPresenting===!0){const _e=P.xr.getDepthSensingMesh();_e!==null&&Er(_e,I,-1/0,P.sortObjects)}Er(y,I,0,P.sortObjects),A.finish(),P.sortObjects===!0&&A.sort(Z,fe),dt=ae.enabled===!1||ae.isPresenting===!1||ae.hasDepthSensing()===!1,dt&&ne.addToRenderList(A,y),this.info.render.frame++,ut===!0&&xe.beginShadows();const z=T.state.shadowsArray;if(re.render(z,y,I),ut===!0&&xe.endShadows(),this.info.autoReset===!0&&this.info.reset(),(k&&w.hasRenderPass())===!1){const _e=A.opaque,ue=A.transmissive;if(T.setupLights(),I.isArrayCamera){const Me=I.cameras;if(ue.length>0)for(let be=0,Ne=Me.length;be<Ne;be++){const Be=Me[be];Xo(_e,ue,y,Be)}dt&&ne.render(y);for(let be=0,Ne=Me.length;be<Ne;be++){const Be=Me[be];Wo(A,y,Be,Be.viewport)}}else ue.length>0&&Xo(_e,ue,y,I),dt&&ne.render(y),Wo(A,y,I)}N!==null&&W===0&&(_.updateMultisampleRenderTarget(N),_.updateRenderTargetMipmap(N)),k&&w.end(P),y.isScene===!0&&y.onAfterRender(P,y,I),ie.resetDefaultState(),B=-1,V=null,M.pop(),M.length>0?(T=M[M.length-1],_.setTextureUnits(T.state.textureUnits),ut===!0&&xe.setGlobalState(P.clippingPlanes,T.state.camera)):T=null,R.pop(),R.length>0?A=R[R.length-1]:A=null,F!==null&&F.renderEnd()};function Er(y,I,H,k){if(y.visible===!1)return;if(y.layers.test(I.layers)){if(y.isGroup)H=y.renderOrder;else if(y.isLOD)y.autoUpdate===!0&&y.update(I);else if(y.isLightProbeGrid)T.pushLightProbeGrid(y);else if(y.isLight)T.pushLight(y),y.castShadow&&T.pushShadow(y);else if(y.isSprite){if(!y.frustumCulled||Re.intersectsSprite(y)){k&&Ve.setFromMatrixPosition(y.matrixWorld).applyMatrix4(tt);const _e=te.update(y),ue=y.material;ue.visible&&A.push(y,_e,ue,H,Ve.z,null)}}else if((y.isMesh||y.isLine||y.isPoints)&&(!y.frustumCulled||Re.intersectsObject(y))){const _e=te.update(y),ue=y.material;if(k&&(y.boundingSphere!==void 0?(y.boundingSphere===null&&y.computeBoundingSphere(),Ve.copy(y.boundingSphere.center)):(_e.boundingSphere===null&&_e.computeBoundingSphere(),Ve.copy(_e.boundingSphere.center)),Ve.applyMatrix4(y.matrixWorld).applyMatrix4(tt)),Array.isArray(ue)){const Me=_e.groups;for(let be=0,Ne=Me.length;be<Ne;be++){const Be=Me[be],Ee=ue[Be.materialIndex];Ee&&Ee.visible&&A.push(y,_e,Ee,H,Ve.z,Be)}}else ue.visible&&A.push(y,_e,ue,H,Ve.z,null)}}const de=y.children;for(let _e=0,ue=de.length;_e<ue;_e++)Er(de[_e],I,H,k)}function Wo(y,I,H,k){const{opaque:z,transmissive:de,transparent:_e}=y;T.setupLightsView(H),ut===!0&&xe.setGlobalState(P.clippingPlanes,H),k&&le.viewport(Q.copy(k)),z.length>0&&Ts(z,I,H),de.length>0&&Ts(de,I,H),_e.length>0&&Ts(_e,I,H),le.buffers.depth.setTest(!0),le.buffers.depth.setMask(!0),le.buffers.color.setMask(!0),le.setPolygonOffset(!1)}function Xo(y,I,H,k){if((H.isScene===!0?H.overrideMaterial:null)!==null)return;if(T.state.transmissionRenderTarget[k.id]===void 0){const Ee=Xe.has("EXT_color_buffer_half_float")||Xe.has("EXT_color_buffer_float");T.state.transmissionRenderTarget[k.id]=new rn(1,1,{generateMipmaps:!0,type:Ee?Nn:Wt,minFilter:Cn,samples:Math.max(4,ot.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:He.workingColorSpace})}const de=T.state.transmissionRenderTarget[k.id],_e=k.viewport||Q;de.setSize(_e.z*P.transmissionResolutionScale,_e.w*P.transmissionResolutionScale);const ue=P.getRenderTarget(),Me=P.getActiveCubeFace(),be=P.getActiveMipmapLevel();P.setRenderTarget(de),P.getClearColor(ve),Te=P.getClearAlpha(),Te<1&&P.setClearColor(16777215,.5),P.clear(),dt&&ne.render(H);const Ne=P.toneMapping;P.toneMapping=mn;const Be=k.viewport;if(k.viewport!==void 0&&(k.viewport=void 0),T.setupLightsView(k),ut===!0&&xe.setGlobalState(P.clippingPlanes,k),Ts(y,H,k),_.updateMultisampleRenderTarget(de),_.updateRenderTargetMipmap(de),Xe.has("WEBGL_multisampled_render_to_texture")===!1){let Ee=!1;for(let it=0,gt=I.length;it<gt;it++){const pt=I[it],{object:rt,geometry:Lt,material:ge,group:Vt}=pt;if(ge.side===en&&rt.layers.test(k.layers)){const je=ge.side;ge.side=Bt,ge.needsUpdate=!0,qo(rt,H,k,Lt,ge,Vt),ge.side=je,ge.needsUpdate=!0,Ee=!0}}Ee===!0&&(_.updateMultisampleRenderTarget(de),_.updateRenderTargetMipmap(de))}P.setRenderTarget(ue,Me,be),P.setClearColor(ve,Te),Be!==void 0&&(k.viewport=Be),P.toneMapping=Ne}function Ts(y,I,H){const k=I.isScene===!0?I.overrideMaterial:null;for(let z=0,de=y.length;z<de;z++){const _e=y[z],{object:ue,geometry:Me,group:be}=_e;let Ne=_e.material;Ne.allowOverride===!0&&k!==null&&(Ne=k),ue.layers.test(H.layers)&&qo(ue,I,H,Me,Ne,be)}}function qo(y,I,H,k,z,de){y.onBeforeRender(P,I,H,k,z,de),y.modelViewMatrix.multiplyMatrices(H.matrixWorldInverse,y.matrixWorld),y.normalMatrix.getNormalMatrix(y.modelViewMatrix),z.onBeforeRender(P,I,H,k,y,de),z.transparent===!0&&z.side===en&&z.forceSinglePass===!1?(z.side=Bt,z.needsUpdate=!0,P.renderBufferDirect(H,I,k,z,y,de),z.side=In,z.needsUpdate=!0,P.renderBufferDirect(H,I,k,z,y,de),z.side=en):P.renderBufferDirect(H,I,k,z,y,de),y.onAfterRender(P,I,H,k,z,de)}function Es(y,I,H){I.isScene!==!0&&(I=St);const k=E.get(y),z=T.state.lights,de=T.state.shadowsArray,_e=z.state.version,ue=oe.getParameters(y,z.state,de,I,H,T.state.lightProbeGridArray),Me=oe.getProgramCacheKey(ue);let be=k.programs;k.environment=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?I.environment:null,k.fog=I.fog;const Ne=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap;k.envMap=O.get(y.envMap||k.environment,Ne),k.envMapRotation=k.environment!==null&&y.envMap===null?I.environmentRotation:y.envMapRotation,be===void 0&&(y.addEventListener("dispose",mt),be=new Map,k.programs=be);let Be=be.get(Me);if(Be!==void 0){if(k.currentProgram===Be&&k.lightsStateVersion===_e)return jo(y,ue),Be}else ue.uniforms=oe.getUniforms(y),F!==null&&y.isNodeMaterial&&F.build(y,H,ue),y.onBeforeCompile(ue,P),Be=oe.acquireProgram(ue,Me),be.set(Me,Be),k.uniforms=ue.uniforms;const Ee=k.uniforms;return(!y.isShaderMaterial&&!y.isRawShaderMaterial||y.clipping===!0)&&(Ee.clippingPlanes=xe.uniform),jo(y,ue),k.needsLights=Vh(y),k.lightsStateVersion=_e,k.needsLights&&(Ee.ambientLightColor.value=z.state.ambient,Ee.lightProbe.value=z.state.probe,Ee.directionalLights.value=z.state.directional,Ee.directionalLightShadows.value=z.state.directionalShadow,Ee.spotLights.value=z.state.spot,Ee.spotLightShadows.value=z.state.spotShadow,Ee.rectAreaLights.value=z.state.rectArea,Ee.ltc_1.value=z.state.rectAreaLTC1,Ee.ltc_2.value=z.state.rectAreaLTC2,Ee.pointLights.value=z.state.point,Ee.pointLightShadows.value=z.state.pointShadow,Ee.hemisphereLights.value=z.state.hemi,Ee.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Ee.spotLightMatrix.value=z.state.spotLightMatrix,Ee.spotLightMap.value=z.state.spotLightMap,Ee.pointShadowMatrix.value=z.state.pointShadowMatrix),k.lightProbeGrid=T.state.lightProbeGridArray.length>0,k.currentProgram=Be,k.uniformsList=null,Be}function Yo(y){if(y.uniformsList===null){const I=y.currentProgram.getUniforms();y.uniformsList=or.seqWithValue(I.seq,y.uniforms)}return y.uniformsList}function jo(y,I){const H=E.get(y);H.outputColorSpace=I.outputColorSpace,H.batching=I.batching,H.batchingColor=I.batchingColor,H.instancing=I.instancing,H.instancingColor=I.instancingColor,H.instancingMorph=I.instancingMorph,H.skinning=I.skinning,H.morphTargets=I.morphTargets,H.morphNormals=I.morphNormals,H.morphColors=I.morphColors,H.morphTargetsCount=I.morphTargetsCount,H.numClippingPlanes=I.numClippingPlanes,H.numIntersection=I.numClipIntersection,H.vertexAlphas=I.vertexAlphas,H.vertexTangents=I.vertexTangents,H.toneMapping=I.toneMapping}function Bh(y,I){if(y.length===0)return null;if(y.length===1)return y[0].texture!==null?y[0]:null;b.setFromMatrixPosition(I.matrixWorld);for(let H=0,k=y.length;H<k;H++){const z=y[H];if(z.texture!==null&&z.boundingBox.containsPoint(b))return z}return null}function kh(y,I,H,k,z){I.isScene!==!0&&(I=St),_.resetTextureUnits();const de=I.fog,_e=k.isMeshStandardMaterial||k.isMeshLambertMaterial||k.isMeshPhongMaterial?I.environment:null,ue=N===null?P.outputColorSpace:N.isXRRenderTarget===!0?N.texture.colorSpace:He.workingColorSpace,Me=k.isMeshStandardMaterial||k.isMeshLambertMaterial&&!k.envMap||k.isMeshPhongMaterial&&!k.envMap,be=O.get(k.envMap||_e,Me),Ne=k.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,Be=!!H.attributes.tangent&&(!!k.normalMap||k.anisotropy>0),Ee=!!H.morphAttributes.position,it=!!H.morphAttributes.normal,gt=!!H.morphAttributes.color;let pt=mn;k.toneMapped&&(N===null||N.isXRRenderTarget===!0)&&(pt=P.toneMapping);const rt=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,Lt=rt!==void 0?rt.length:0,ge=E.get(k),Vt=T.state.lights;if(ut===!0&&(We===!0||y!==V)){const lt=y===V&&k.id===B;xe.setState(k,y,lt)}let je=!1;k.version===ge.__version?(ge.needsLights&&ge.lightsStateVersion!==Vt.state.version||ge.outputColorSpace!==ue||z.isBatchedMesh&&ge.batching===!1||!z.isBatchedMesh&&ge.batching===!0||z.isBatchedMesh&&ge.batchingColor===!0&&z.colorTexture===null||z.isBatchedMesh&&ge.batchingColor===!1&&z.colorTexture!==null||z.isInstancedMesh&&ge.instancing===!1||!z.isInstancedMesh&&ge.instancing===!0||z.isSkinnedMesh&&ge.skinning===!1||!z.isSkinnedMesh&&ge.skinning===!0||z.isInstancedMesh&&ge.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&ge.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&ge.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&ge.instancingMorph===!1&&z.morphTexture!==null||ge.envMap!==be||k.fog===!0&&ge.fog!==de||ge.numClippingPlanes!==void 0&&(ge.numClippingPlanes!==xe.numPlanes||ge.numIntersection!==xe.numIntersection)||ge.vertexAlphas!==Ne||ge.vertexTangents!==Be||ge.morphTargets!==Ee||ge.morphNormals!==it||ge.morphColors!==gt||ge.toneMapping!==pt||ge.morphTargetsCount!==Lt||!!ge.lightProbeGrid!=T.state.lightProbeGridArray.length>0)&&(je=!0):(je=!0,ge.__version=k.version);let qt=ge.currentProgram;je===!0&&(qt=Es(k,I,z),F&&k.isNodeMaterial&&F.onUpdateProgram(k,qt,ge));let ln=!1,On=!1,pi=!1;const at=qt.getUniforms(),xt=ge.uniforms;if(le.useProgram(qt.program)&&(ln=!0,On=!0,pi=!0),k.id!==B&&(B=k.id,On=!0),ge.needsLights){const lt=Bh(T.state.lightProbeGridArray,z);ge.lightProbeGrid!==lt&&(ge.lightProbeGrid=lt,On=!0)}if(ln||V!==y){le.buffers.depth.getReversed()&&y.reversedDepth!==!0&&(y._reversedDepth=!0,y.updateProjectionMatrix()),at.setValue(D,"projectionMatrix",y.projectionMatrix),at.setValue(D,"viewMatrix",y.matrixWorldInverse);const kn=at.map.cameraPosition;kn!==void 0&&kn.setValue(D,ct.setFromMatrixPosition(y.matrixWorld)),ot.logarithmicDepthBuffer&&at.setValue(D,"logDepthBufFC",2/(Math.log(y.far+1)/Math.LN2)),(k.isMeshPhongMaterial||k.isMeshToonMaterial||k.isMeshLambertMaterial||k.isMeshBasicMaterial||k.isMeshStandardMaterial||k.isShaderMaterial)&&at.setValue(D,"isOrthographic",y.isOrthographicCamera===!0),V!==y&&(V=y,On=!0,pi=!0)}if(ge.needsLights&&(Vt.state.directionalShadowMap.length>0&&at.setValue(D,"directionalShadowMap",Vt.state.directionalShadowMap,_),Vt.state.spotShadowMap.length>0&&at.setValue(D,"spotShadowMap",Vt.state.spotShadowMap,_),Vt.state.pointShadowMap.length>0&&at.setValue(D,"pointShadowMap",Vt.state.pointShadowMap,_)),z.isSkinnedMesh){at.setOptional(D,z,"bindMatrix"),at.setOptional(D,z,"bindMatrixInverse");const lt=z.skeleton;lt&&(lt.boneTexture===null&&lt.computeBoneTexture(),at.setValue(D,"boneTexture",lt.boneTexture,_))}z.isBatchedMesh&&(at.setOptional(D,z,"batchingTexture"),at.setValue(D,"batchingTexture",z._matricesTexture,_),at.setOptional(D,z,"batchingIdTexture"),at.setValue(D,"batchingIdTexture",z._indirectTexture,_),at.setOptional(D,z,"batchingColorTexture"),z._colorsTexture!==null&&at.setValue(D,"batchingColorTexture",z._colorsTexture,_));const Bn=H.morphAttributes;if((Bn.position!==void 0||Bn.normal!==void 0||Bn.color!==void 0)&&Le.update(z,H,qt),(On||ge.receiveShadow!==z.receiveShadow)&&(ge.receiveShadow=z.receiveShadow,at.setValue(D,"receiveShadow",z.receiveShadow)),(k.isMeshStandardMaterial||k.isMeshLambertMaterial||k.isMeshPhongMaterial)&&k.envMap===null&&I.environment!==null&&(xt.envMapIntensity.value=I.environmentIntensity),xt.dfgLUT!==void 0&&(xt.dfgLUT.value=bx()),On){if(at.setValue(D,"toneMappingExposure",P.toneMappingExposure),ge.needsLights&&zh(xt,pi),de&&k.fog===!0&&q.refreshFogUniforms(xt,de),q.refreshMaterialUniforms(xt,k,Ue,et,T.state.transmissionRenderTarget[y.id]),ge.needsLights&&ge.lightProbeGrid){const lt=ge.lightProbeGrid;xt.probesSH.value=lt.texture,xt.probesMin.value.copy(lt.boundingBox.min),xt.probesMax.value.copy(lt.boundingBox.max),xt.probesResolution.value.copy(lt.resolution)}or.upload(D,Yo(ge),xt,_)}if(k.isShaderMaterial&&k.uniformsNeedUpdate===!0&&(or.upload(D,Yo(ge),xt,_),k.uniformsNeedUpdate=!1),k.isSpriteMaterial&&at.setValue(D,"center",z.center),at.setValue(D,"modelViewMatrix",z.modelViewMatrix),at.setValue(D,"normalMatrix",z.normalMatrix),at.setValue(D,"modelMatrix",z.matrixWorld),k.uniformsGroups!==void 0){const lt=k.uniformsGroups;for(let kn=0,mi=lt.length;kn<mi;kn++){const Ko=lt[kn];Y.update(Ko,qt),Y.bind(Ko,qt)}}return qt}function zh(y,I){y.ambientLightColor.needsUpdate=I,y.lightProbe.needsUpdate=I,y.directionalLights.needsUpdate=I,y.directionalLightShadows.needsUpdate=I,y.pointLights.needsUpdate=I,y.pointLightShadows.needsUpdate=I,y.spotLights.needsUpdate=I,y.spotLightShadows.needsUpdate=I,y.rectAreaLights.needsUpdate=I,y.hemisphereLights.needsUpdate=I}function Vh(y){return y.isMeshLambertMaterial||y.isMeshToonMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isShadowMaterial||y.isShaderMaterial&&y.lights===!0}this.getActiveCubeFace=function(){return G},this.getActiveMipmapLevel=function(){return W},this.getRenderTarget=function(){return N},this.setRenderTargetTextures=function(y,I,H){const k=E.get(y);k.__autoAllocateDepthBuffer=y.resolveDepthBuffer===!1,k.__autoAllocateDepthBuffer===!1&&(k.__useRenderToTexture=!1),E.get(y.texture).__webglTexture=I,E.get(y.depthTexture).__webglTexture=k.__autoAllocateDepthBuffer?void 0:H,k.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(y,I){const H=E.get(y);H.__webglFramebuffer=I,H.__useDefaultFramebuffer=I===void 0};const Hh=D.createFramebuffer();this.setRenderTarget=function(y,I=0,H=0){N=y,G=I,W=H;let k=null,z=!1,de=!1;if(y){const ue=E.get(y);if(ue.__useDefaultFramebuffer!==void 0){le.bindFramebuffer(D.FRAMEBUFFER,ue.__webglFramebuffer),Q.copy(y.viewport),ee.copy(y.scissor),he=y.scissorTest,le.viewport(Q),le.scissor(ee),le.setScissorTest(he),B=-1;return}else if(ue.__webglFramebuffer===void 0)_.setupRenderTarget(y);else if(ue.__hasExternalTextures)_.rebindTextures(y,E.get(y.texture).__webglTexture,E.get(y.depthTexture).__webglTexture);else if(y.depthBuffer){const Ne=y.depthTexture;if(ue.__boundDepthTexture!==Ne){if(Ne!==null&&E.has(Ne)&&(y.width!==Ne.image.width||y.height!==Ne.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");_.setupDepthRenderbuffer(y)}}const Me=y.texture;(Me.isData3DTexture||Me.isDataArrayTexture||Me.isCompressedArrayTexture)&&(de=!0);const be=E.get(y).__webglFramebuffer;y.isWebGLCubeRenderTarget?(Array.isArray(be[I])?k=be[I][H]:k=be[I],z=!0):y.samples>0&&_.useMultisampledRTT(y)===!1?k=E.get(y).__webglMultisampledFramebuffer:Array.isArray(be)?k=be[H]:k=be,Q.copy(y.viewport),ee.copy(y.scissor),he=y.scissorTest}else Q.copy(se).multiplyScalar(Ue).floor(),ee.copy(we).multiplyScalar(Ue).floor(),he=Pe;if(H!==0&&(k=Hh),le.bindFramebuffer(D.FRAMEBUFFER,k)&&le.drawBuffers(y,k),le.viewport(Q),le.scissor(ee),le.setScissorTest(he),z){const ue=E.get(y.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_CUBE_MAP_POSITIVE_X+I,ue.__webglTexture,H)}else if(de){const ue=I;for(let Me=0;Me<y.textures.length;Me++){const be=E.get(y.textures[Me]);D.framebufferTextureLayer(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0+Me,be.__webglTexture,H,ue)}}else if(y!==null&&H!==0){const ue=E.get(y.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,ue.__webglTexture,H)}B=-1},this.readRenderTargetPixels=function(y,I,H,k,z,de,_e,ue=0){if(!(y&&y.isWebGLRenderTarget)){Ae("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Me=E.get(y).__webglFramebuffer;if(y.isWebGLCubeRenderTarget&&_e!==void 0&&(Me=Me[_e]),Me){le.bindFramebuffer(D.FRAMEBUFFER,Me);try{const be=y.textures[ue],Ne=be.format,Be=be.type;if(y.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+ue),!ot.textureFormatReadable(Ne)){Ae("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!ot.textureTypeReadable(Be)){Ae("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}I>=0&&I<=y.width-k&&H>=0&&H<=y.height-z&&D.readPixels(I,H,k,z,L.convert(Ne),L.convert(Be),de)}finally{const be=N!==null?E.get(N).__webglFramebuffer:null;le.bindFramebuffer(D.FRAMEBUFFER,be)}}},this.readRenderTargetPixelsAsync=async function(y,I,H,k,z,de,_e,ue=0){if(!(y&&y.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Me=E.get(y).__webglFramebuffer;if(y.isWebGLCubeRenderTarget&&_e!==void 0&&(Me=Me[_e]),Me)if(I>=0&&I<=y.width-k&&H>=0&&H<=y.height-z){le.bindFramebuffer(D.FRAMEBUFFER,Me);const be=y.textures[ue],Ne=be.format,Be=be.type;if(y.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+ue),!ot.textureFormatReadable(Ne))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!ot.textureTypeReadable(Be))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Ee=D.createBuffer();D.bindBuffer(D.PIXEL_PACK_BUFFER,Ee),D.bufferData(D.PIXEL_PACK_BUFFER,de.byteLength,D.STREAM_READ),D.readPixels(I,H,k,z,L.convert(Ne),L.convert(Be),0);const it=N!==null?E.get(N).__webglFramebuffer:null;le.bindFramebuffer(D.FRAMEBUFFER,it);const gt=D.fenceSync(D.SYNC_GPU_COMMANDS_COMPLETE,0);return D.flush(),await Xu(D,gt,4),D.bindBuffer(D.PIXEL_PACK_BUFFER,Ee),D.getBufferSubData(D.PIXEL_PACK_BUFFER,0,de),D.deleteBuffer(Ee),D.deleteSync(gt),de}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(y,I=null,H=0){const k=Math.pow(2,-H),z=Math.floor(y.image.width*k),de=Math.floor(y.image.height*k),_e=I!==null?I.x:0,ue=I!==null?I.y:0;_.setTexture2D(y,0),D.copyTexSubImage2D(D.TEXTURE_2D,H,0,0,_e,ue,z,de),le.unbindTexture()};const Gh=D.createFramebuffer(),Wh=D.createFramebuffer();this.copyTextureToTexture=function(y,I,H=null,k=null,z=0,de=0){let _e,ue,Me,be,Ne,Be,Ee,it,gt;const pt=y.isCompressedTexture?y.mipmaps[de]:y.image;if(H!==null)_e=H.max.x-H.min.x,ue=H.max.y-H.min.y,Me=H.isBox3?H.max.z-H.min.z:1,be=H.min.x,Ne=H.min.y,Be=H.isBox3?H.min.z:0;else{const xt=Math.pow(2,-z);_e=Math.floor(pt.width*xt),ue=Math.floor(pt.height*xt),y.isDataArrayTexture?Me=pt.depth:y.isData3DTexture?Me=Math.floor(pt.depth*xt):Me=1,be=0,Ne=0,Be=0}k!==null?(Ee=k.x,it=k.y,gt=k.z):(Ee=0,it=0,gt=0);const rt=L.convert(I.format),Lt=L.convert(I.type);let ge;I.isData3DTexture?(_.setTexture3D(I,0),ge=D.TEXTURE_3D):I.isDataArrayTexture||I.isCompressedArrayTexture?(_.setTexture2DArray(I,0),ge=D.TEXTURE_2D_ARRAY):(_.setTexture2D(I,0),ge=D.TEXTURE_2D),le.activeTexture(D.TEXTURE0),le.pixelStorei(D.UNPACK_FLIP_Y_WEBGL,I.flipY),le.pixelStorei(D.UNPACK_PREMULTIPLY_ALPHA_WEBGL,I.premultiplyAlpha),le.pixelStorei(D.UNPACK_ALIGNMENT,I.unpackAlignment);const Vt=le.getParameter(D.UNPACK_ROW_LENGTH),je=le.getParameter(D.UNPACK_IMAGE_HEIGHT),qt=le.getParameter(D.UNPACK_SKIP_PIXELS),ln=le.getParameter(D.UNPACK_SKIP_ROWS),On=le.getParameter(D.UNPACK_SKIP_IMAGES);le.pixelStorei(D.UNPACK_ROW_LENGTH,pt.width),le.pixelStorei(D.UNPACK_IMAGE_HEIGHT,pt.height),le.pixelStorei(D.UNPACK_SKIP_PIXELS,be),le.pixelStorei(D.UNPACK_SKIP_ROWS,Ne),le.pixelStorei(D.UNPACK_SKIP_IMAGES,Be);const pi=y.isDataArrayTexture||y.isData3DTexture,at=I.isDataArrayTexture||I.isData3DTexture;if(y.isDepthTexture){const xt=E.get(y),Bn=E.get(I),lt=E.get(xt.__renderTarget),kn=E.get(Bn.__renderTarget);le.bindFramebuffer(D.READ_FRAMEBUFFER,lt.__webglFramebuffer),le.bindFramebuffer(D.DRAW_FRAMEBUFFER,kn.__webglFramebuffer);for(let mi=0;mi<Me;mi++)pi&&(D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,E.get(y).__webglTexture,z,Be+mi),D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,E.get(I).__webglTexture,de,gt+mi)),D.blitFramebuffer(be,Ne,_e,ue,Ee,it,_e,ue,D.DEPTH_BUFFER_BIT,D.NEAREST);le.bindFramebuffer(D.READ_FRAMEBUFFER,null),le.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else if(z!==0||y.isRenderTargetTexture||E.has(y)){const xt=E.get(y),Bn=E.get(I);le.bindFramebuffer(D.READ_FRAMEBUFFER,Gh),le.bindFramebuffer(D.DRAW_FRAMEBUFFER,Wh);for(let lt=0;lt<Me;lt++)pi?D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,xt.__webglTexture,z,Be+lt):D.framebufferTexture2D(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,xt.__webglTexture,z),at?D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,Bn.__webglTexture,de,gt+lt):D.framebufferTexture2D(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,Bn.__webglTexture,de),z!==0?D.blitFramebuffer(be,Ne,_e,ue,Ee,it,_e,ue,D.COLOR_BUFFER_BIT,D.NEAREST):at?D.copyTexSubImage3D(ge,de,Ee,it,gt+lt,be,Ne,_e,ue):D.copyTexSubImage2D(ge,de,Ee,it,be,Ne,_e,ue);le.bindFramebuffer(D.READ_FRAMEBUFFER,null),le.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else at?y.isDataTexture||y.isData3DTexture?D.texSubImage3D(ge,de,Ee,it,gt,_e,ue,Me,rt,Lt,pt.data):I.isCompressedArrayTexture?D.compressedTexSubImage3D(ge,de,Ee,it,gt,_e,ue,Me,rt,pt.data):D.texSubImage3D(ge,de,Ee,it,gt,_e,ue,Me,rt,Lt,pt):y.isDataTexture?D.texSubImage2D(D.TEXTURE_2D,de,Ee,it,_e,ue,rt,Lt,pt.data):y.isCompressedTexture?D.compressedTexSubImage2D(D.TEXTURE_2D,de,Ee,it,pt.width,pt.height,rt,pt.data):D.texSubImage2D(D.TEXTURE_2D,de,Ee,it,_e,ue,rt,Lt,pt);le.pixelStorei(D.UNPACK_ROW_LENGTH,Vt),le.pixelStorei(D.UNPACK_IMAGE_HEIGHT,je),le.pixelStorei(D.UNPACK_SKIP_PIXELS,qt),le.pixelStorei(D.UNPACK_SKIP_ROWS,ln),le.pixelStorei(D.UNPACK_SKIP_IMAGES,On),de===0&&I.generateMipmaps&&D.generateMipmap(ge),le.unbindTexture()},this.initRenderTarget=function(y){E.get(y).__webglFramebuffer===void 0&&_.setupRenderTarget(y)},this.initTexture=function(y){y.isCubeTexture?_.setTextureCube(y,0):y.isData3DTexture?_.setTexture3D(y,0):y.isDataArrayTexture||y.isCompressedArrayTexture?_.setTexture2DArray(y,0):_.setTexture2D(y,0),le.unbindTexture()},this.resetState=function(){G=0,W=0,N=null,le.reset(),ie.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return pn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=He._getDrawingBufferColorSpace(e),t.unpackColorSpace=He._getUnpackColorSpace()}}function mc(s,e){if(e===Iu)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),s;if(e===eo||e===$c){let t=s.getIndex();if(t===null){const a=[],o=s.getAttribute("position");if(o!==void 0){for(let l=0;l<o.count;l++)a.push(l);s.setIndex(a),t=s.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),s}const n=t.count-2,i=[];if(e===eo)for(let a=1;a<=n;a++)i.push(t.getX(0)),i.push(t.getX(a)),i.push(t.getX(a+1));else for(let a=0;a<n;a++)a%2===0?(i.push(t.getX(a)),i.push(t.getX(a+1)),i.push(t.getX(a+2))):(i.push(t.getX(a+2)),i.push(t.getX(a+1)),i.push(t.getX(a)));i.length/3!==n&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const r=s.clone();return r.setIndex(i),r.clearGroups(),r}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),s}function Ex(s){const e=new Map,t=new Map,n=s.clone();return Th(s,n,function(i,r){e.set(r,i),t.set(i,r)}),n.traverse(function(i){if(!i.isSkinnedMesh)return;const r=i,a=e.get(i),o=a.skeleton.bones;r.skeleton=a.skeleton.clone(),r.bindMatrix.copy(a.bindMatrix),r.skeleton.bones=o.map(function(l){return t.get(l)}),r.bind(r.skeleton,r.bindMatrix)}),n}function Th(s,e,t){t(s,e);for(let n=0;n<s.children.length;n++)Th(s.children[n],e.children[n],t)}class wx extends Ki{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new Px(t)}),this.register(function(t){return new Dx(t)}),this.register(function(t){return new Vx(t)}),this.register(function(t){return new Hx(t)}),this.register(function(t){return new Gx(t)}),this.register(function(t){return new Nx(t)}),this.register(function(t){return new Ux(t)}),this.register(function(t){return new Fx(t)}),this.register(function(t){return new Ox(t)}),this.register(function(t){return new Lx(t)}),this.register(function(t){return new Bx(t)}),this.register(function(t){return new Ix(t)}),this.register(function(t){return new zx(t)}),this.register(function(t){return new kx(t)}),this.register(function(t){return new Rx(t)}),this.register(function(t){return new gc(t,ze.EXT_MESHOPT_COMPRESSION)}),this.register(function(t){return new gc(t,ze.KHR_MESHOPT_COMPRESSION)}),this.register(function(t){return new Wx(t)})}load(e,t,n,i){const r=this;let a;if(this.resourcePath!=="")a=this.resourcePath;else if(this.path!==""){const c=ms.extractUrlBase(e);a=ms.resolveURL(c,this.path)}else a=ms.extractUrlBase(e);this.manager.itemStart(e);const o=function(c){i?i(c):console.error(c),r.manager.itemError(e),r.manager.itemEnd(e)},l=new fh(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{r.parse(c,a,function(h){t(h),r.manager.itemEnd(e)},o)}catch(h){o(h)}},n,o)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,n,i){let r;const a={},o={},l=new TextDecoder;if(typeof e=="string")r=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===Eh){try{a[ze.KHR_BINARY_GLTF]=new Xx(e)}catch(d){i&&i(d);return}r=JSON.parse(a[ze.KHR_BINARY_GLTF].content)}else r=JSON.parse(l.decode(e));else r=e;if(r.asset===void 0||r.asset.version[0]<2){i&&i(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const c=new s_(r,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let h=0;h<this.pluginCallbacks.length;h++){const d=this.pluginCallbacks[h](c);d.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),o[d.name]=d,a[d.name]=!0}if(r.extensionsUsed)for(let h=0;h<r.extensionsUsed.length;++h){const d=r.extensionsUsed[h],u=r.extensionsRequired||[];switch(d){case ze.KHR_MATERIALS_UNLIT:a[d]=new Cx;break;case ze.KHR_DRACO_MESH_COMPRESSION:a[d]=new qx(r,this.dracoLoader);break;case ze.KHR_TEXTURE_TRANSFORM:a[d]=new Yx;break;case ze.KHR_MESH_QUANTIZATION:a[d]=new jx;break;default:u.indexOf(d)>=0&&o[d]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+d+'".')}}c.setExtensions(a),c.setPlugins(o),c.parse(n,i)}parseAsync(e,t){const n=this;return new Promise(function(i,r){n.parse(e,t,i,r)})}}function Ax(){let s={};return{get:function(e){return s[e]},add:function(e,t){s[e]=t},remove:function(e){delete s[e]},removeAll:function(){s={}}}}function _t(s,e,t){const n=s.json.materials[e];return n.extensions&&n.extensions[t]?n.extensions[t]:null}const ze={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};class Rx{constructor(e){this.parser=e,this.name=ze.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){const e=this.parser,t=this.parser.json.nodes||[];for(let n=0,i=t.length;n<i;n++){const r=t[n];r.extensions&&r.extensions[this.name]&&r.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,r.extensions[this.name].light)}}_loadLight(e){const t=this.parser,n="light:"+e;let i=t.cache.get(n);if(i)return i;const r=t.json,l=((r.extensions&&r.extensions[this.name]||{}).lights||[])[e];let c;const h=new Ce(16777215);l.color!==void 0&&h.setRGB(l.color[0],l.color[1],l.color[2],Xt);const d=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new mh(h),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new pf(h),c.distance=d;break;case"spot":c=new df(h),c.distance=d,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),un(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),i=Promise.resolve(c),t.cache.add(n,i),i}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){const t=this,n=this.parser,r=n.json.nodes[e],o=(r.extensions&&r.extensions[this.name]||{}).light;return o===void 0?null:this._loadLight(o).then(function(l){return n._getNodeRef(t.cache,o,l)})}}class Cx{constructor(){this.name=ze.KHR_MATERIALS_UNLIT}getMaterialType(){return Kn}extendParams(e,t,n){const i=[];e.color=new Ce(1,1,1),e.opacity=1;const r=t.pbrMetallicRoughness;if(r){if(Array.isArray(r.baseColorFactor)){const a=r.baseColorFactor;e.color.setRGB(a[0],a[1],a[2],Xt),e.opacity=a[3]}r.baseColorTexture!==void 0&&i.push(n.assignTexture(e,"map",r.baseColorTexture,Ct))}return Promise.all(i)}}class Lx{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);return n===null||n.emissiveStrength!==void 0&&(t.emissiveIntensity=n.emissiveStrength),Promise.resolve()}}class Px{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Sn:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];if(n.clearcoatFactor!==void 0&&(t.clearcoat=n.clearcoatFactor),n.clearcoatTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatMap",n.clearcoatTexture)),n.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=n.clearcoatRoughnessFactor),n.clearcoatRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatRoughnessMap",n.clearcoatRoughnessTexture)),n.clearcoatNormalTexture!==void 0&&(i.push(this.parser.assignTexture(t,"clearcoatNormalMap",n.clearcoatNormalTexture)),n.clearcoatNormalTexture.scale!==void 0)){const r=n.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new qe(r,r)}return Promise.all(i)}}class Dx{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_DISPERSION}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Sn:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);return n===null||(t.dispersion=n.dispersion!==void 0?n.dispersion:0),Promise.resolve()}}class Ix{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Sn:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return n.iridescenceFactor!==void 0&&(t.iridescence=n.iridescenceFactor),n.iridescenceTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceMap",n.iridescenceTexture)),n.iridescenceIor!==void 0&&(t.iridescenceIOR=n.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),n.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=n.iridescenceThicknessMinimum),n.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=n.iridescenceThicknessMaximum),n.iridescenceThicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceThicknessMap",n.iridescenceThicknessTexture)),Promise.all(i)}}class Nx{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_SHEEN}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Sn:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];if(t.sheenColor=new Ce(0,0,0),t.sheenRoughness=0,t.sheen=1,n.sheenColorFactor!==void 0){const r=n.sheenColorFactor;t.sheenColor.setRGB(r[0],r[1],r[2],Xt)}return n.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=n.sheenRoughnessFactor),n.sheenColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenColorMap",n.sheenColorTexture,Ct)),n.sheenRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenRoughnessMap",n.sheenRoughnessTexture)),Promise.all(i)}}class Ux{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Sn:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return n.transmissionFactor!==void 0&&(t.transmission=n.transmissionFactor),n.transmissionTexture!==void 0&&i.push(this.parser.assignTexture(t,"transmissionMap",n.transmissionTexture)),Promise.all(i)}}class Fx{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_VOLUME}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Sn:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];t.thickness=n.thicknessFactor!==void 0?n.thicknessFactor:0,n.thicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"thicknessMap",n.thicknessTexture)),t.attenuationDistance=n.attenuationDistance||1/0;const r=n.attenuationColor||[1,1,1];return t.attenuationColor=new Ce().setRGB(r[0],r[1],r[2],Xt),Promise.all(i)}}class Ox{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_IOR}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Sn:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);return n===null||(t.ior=n.ior!==void 0?n.ior:1.5,t.ior===0&&(t.ior=1e3)),Promise.resolve()}}class Bx{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_SPECULAR}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Sn:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];t.specularIntensity=n.specularFactor!==void 0?n.specularFactor:1,n.specularTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularIntensityMap",n.specularTexture));const r=n.specularColorFactor||[1,1,1];return t.specularColor=new Ce().setRGB(r[0],r[1],r[2],Xt),n.specularColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularColorMap",n.specularColorTexture,Ct)),Promise.all(i)}}class kx{constructor(e){this.parser=e,this.name=ze.EXT_MATERIALS_BUMP}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Sn:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return t.bumpScale=n.bumpFactor!==void 0?n.bumpFactor:1,n.bumpTexture!==void 0&&i.push(this.parser.assignTexture(t,"bumpMap",n.bumpTexture)),Promise.all(i)}}class zx{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Sn:null}extendMaterialParams(e,t){const n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();const i=[];return n.anisotropyStrength!==void 0&&(t.anisotropy=n.anisotropyStrength),n.anisotropyRotation!==void 0&&(t.anisotropyRotation=n.anisotropyRotation),n.anisotropyTexture!==void 0&&i.push(this.parser.assignTexture(t,"anisotropyMap",n.anisotropyTexture)),Promise.all(i)}}class Vx{constructor(e){this.parser=e,this.name=ze.KHR_TEXTURE_BASISU}loadTexture(e){const t=this.parser,n=t.json,i=n.textures[e];if(!i.extensions||!i.extensions[this.name])return null;const r=i.extensions[this.name],a=t.options.ktx2Loader;if(!a){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,r.source,a)}}class Hx{constructor(e){this.parser=e,this.name=ze.EXT_TEXTURE_WEBP}loadTexture(e){const t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;const a=r.extensions[t],o=i.images[a.source];let l=n.textureLoader;if(o.uri){const c=n.options.manager.getHandler(o.uri);c!==null&&(l=c)}return n.loadTextureImage(e,a.source,l)}}class Gx{constructor(e){this.parser=e,this.name=ze.EXT_TEXTURE_AVIF}loadTexture(e){const t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;const a=r.extensions[t],o=i.images[a.source];let l=n.textureLoader;if(o.uri){const c=n.options.manager.getHandler(o.uri);c!==null&&(l=c)}return n.loadTextureImage(e,a.source,l)}}class gc{constructor(e,t){this.name=t,this.parser=e}loadBufferView(e){const t=this.parser.json,n=t.bufferViews[e];if(n.extensions&&n.extensions[this.name]){const i=n.extensions[this.name],r=this.parser.getDependency("buffer",i.buffer),a=this.parser.options.meshoptDecoder;if(!a||!a.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return r.then(function(o){const l=i.byteOffset||0,c=i.byteLength||0,h=i.count,d=i.byteStride,u=new Uint8Array(o,l,c);return a.decodeGltfBufferAsync?a.decodeGltfBufferAsync(h,d,u,i.mode,i.filter).then(function(f){return f.buffer}):a.ready.then(function(){const f=new ArrayBuffer(h*d);return a.decodeGltfBuffer(new Uint8Array(f),h,d,u,i.mode,i.filter),f})})}else return null}}class Wx{constructor(e){this.name=ze.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){const t=this.parser.json,n=t.nodes[e];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;const i=t.meshes[n.mesh];for(const c of i.primitives)if(c.mode!==jt.TRIANGLES&&c.mode!==jt.TRIANGLE_STRIP&&c.mode!==jt.TRIANGLE_FAN&&c.mode!==void 0)return null;const a=n.extensions[this.name].attributes,o=[],l={};for(const c in a)o.push(this.parser.getDependency("accessor",a[c]).then(h=>(l[c]=h,l[c])));return o.length<1?null:(o.push(this.parser.createNodeMesh(e)),Promise.all(o).then(c=>{const h=c.pop(),d=h.isGroup?h.children:[h],u=c[0].count,f=[];for(const g of d){const x=new ke,m=new U,p=new Fn,v=new U(1,1,1),S=new rh(g.geometry,g.material,u);for(let b=0;b<u;b++)l.TRANSLATION&&m.fromBufferAttribute(l.TRANSLATION,b),l.ROTATION&&p.fromBufferAttribute(l.ROTATION,b),l.SCALE&&v.fromBufferAttribute(l.SCALE,b),S.setMatrixAt(b,x.compose(m,p,v));for(const b in l)if(b==="_COLOR_0"){const A=l[b];S.instanceColor=new so(A.array,A.itemSize,A.normalized)}else b!=="TRANSLATION"&&b!=="ROTATION"&&b!=="SCALE"&&g.geometry.setAttribute(b,l[b]);ht.prototype.copy.call(S,g),this.parser.assignFinalMaterial(S),f.push(S)}return h.isGroup?(h.clear(),h.add(...f),h):f[0]}))}}const Eh="glTF",ls=12,xc={JSON:1313821514,BIN:5130562};class Xx{constructor(e){this.name=ze.KHR_BINARY_GLTF,this.content=null,this.body=null;const t=new DataView(e,0,ls),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Eh)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const i=this.header.length-ls,r=new DataView(e,ls);let a=0;for(;a<i;){const o=r.getUint32(a,!0);a+=4;const l=r.getUint32(a,!0);if(a+=4,l===xc.JSON){const c=new Uint8Array(e,ls+a,o);this.content=n.decode(c)}else if(l===xc.BIN){const c=ls+a;this.body=e.slice(c,c+o)}a+=o}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}}class qx{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=ze.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){const n=this.json,i=this.dracoLoader,r=e.extensions[this.name].bufferView,a=e.extensions[this.name].attributes,o={},l={},c={};for(const h in a){const d=lo[h]||h.toLowerCase();o[d]=a[h]}for(const h in e.attributes){const d=lo[h]||h.toLowerCase();if(a[h]!==void 0){const u=n.accessors[e.attributes[h]],f=Ui[u.componentType];c[d]=f.name,l[d]=u.normalized===!0}}return t.getDependency("bufferView",r).then(function(h){return new Promise(function(d,u){i.decodeDracoFile(h,function(f){for(const g in f.attributes){const x=f.attributes[g],m=l[g];m!==void 0&&(x.normalized=m)}d(f)},o,c,Xt,u)})})}}class Yx{constructor(){this.name=ze.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}}class jx{constructor(){this.name=ze.KHR_MESH_QUANTIZATION}}class wh extends qi{constructor(e,t,n,i){super(e,t,n,i)}copySampleValue_(e){const t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i*3+i;for(let a=0;a!==i;a++)t[a]=n[r+a];return t}interpolate_(e,t,n,i){const r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=o*2,c=o*3,h=i-t,d=(n-t)/h,u=d*d,f=u*d,g=e*c,x=g-c,m=-2*f+3*u,p=f-u,v=1-m,S=p-u+d;for(let b=0;b!==o;b++){const A=a[x+b+o],T=a[x+b+l]*h,R=a[g+b+o],M=a[g+b]*h;r[b]=v*A+S*T+m*R+p*M}return r}}const Kx=new Fn;class Zx extends wh{interpolate_(e,t,n,i){const r=super.interpolate_(e,t,n,i);return Kx.fromArray(r).normalize().toArray(r),r}}const jt={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},Ui={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},_c={9728:bt,9729:Tt,9984:Wc,9985:nr,9986:us,9987:Cn},vc={33071:fn,33648:lr,10497:ui},ua={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},lo={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},qn={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},$x={CUBICSPLINE:void 0,LINEAR:vs,STEP:_s},da={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function Jx(s){return s.DefaultMaterial===void 0&&(s.DefaultMaterial=new Mr({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:In})),s.DefaultMaterial}function ii(s,e,t){for(const n in t.extensions)s[n]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[n]=t.extensions[n])}function un(s,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(s.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function Qx(s,e,t){let n=!1,i=!1,r=!1;for(let c=0,h=e.length;c<h;c++){const d=e[c];if(d.POSITION!==void 0&&(n=!0),d.NORMAL!==void 0&&(i=!0),d.COLOR_0!==void 0&&(r=!0),n&&i&&r)break}if(!n&&!i&&!r)return Promise.resolve(s);const a=[],o=[],l=[];for(let c=0,h=e.length;c<h;c++){const d=e[c];if(n){const u=d.POSITION!==void 0?t.getDependency("accessor",d.POSITION):s.attributes.position;a.push(u)}if(i){const u=d.NORMAL!==void 0?t.getDependency("accessor",d.NORMAL):s.attributes.normal;o.push(u)}if(r){const u=d.COLOR_0!==void 0?t.getDependency("accessor",d.COLOR_0):s.attributes.color;l.push(u)}}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l)]).then(function(c){const h=c[0],d=c[1],u=c[2];return n&&(s.morphAttributes.position=h),i&&(s.morphAttributes.normal=d),r&&(s.morphAttributes.color=u),s.morphTargetsRelative=!0,s})}function e_(s,e){if(s.updateMorphTargets(),e.weights!==void 0)for(let t=0,n=e.weights.length;t<n;t++)s.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){const t=e.extras.targetNames;if(s.morphTargetInfluences.length===t.length){s.morphTargetDictionary={};for(let n=0,i=t.length;n<i;n++)s.morphTargetDictionary[t[n]]=n}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function t_(s){let e;const t=s.extensions&&s.extensions[ze.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+fa(t.attributes):e=s.indices+":"+fa(s.attributes)+":"+s.mode,s.targets!==void 0)for(let n=0,i=s.targets.length;n<i;n++)e+=":"+fa(s.targets[n]);return e}function fa(s){let e="";const t=Object.keys(s).sort();for(let n=0,i=t.length;n<i;n++)e+=t[n]+":"+s[t[n]]+";";return e}function co(s){switch(s){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function n_(s){return s.search(/\.jpe?g($|\?)/i)>0||s.search(/^data\:image\/jpeg/)===0?"image/jpeg":s.search(/\.webp($|\?)/i)>0||s.search(/^data\:image\/webp/)===0?"image/webp":s.search(/\.ktx2($|\?)/i)>0||s.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}const i_=new ke;class s_{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new Ax,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,i=-1,r=!1,a=-1;if(typeof navigator<"u"&&typeof navigator.userAgent<"u"){const o=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(o)===!0;const l=o.match(/Version\/(\d+)/);i=n&&l?parseInt(l[1],10):-1,r=o.indexOf("Firefox")>-1,a=r?o.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||n&&i<17||r&&a<98?this.textureLoader=new cf(this.options.manager):this.textureLoader=new xf(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new fh(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){const n=this,i=this.json,r=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(a){return a._markDefs&&a._markDefs()}),Promise.all(this._invokeAll(function(a){return a.beforeRoot&&a.beforeRoot()})).then(function(){return Promise.all([n.getDependencies("scene"),n.getDependencies("animation"),n.getDependencies("camera")])}).then(function(a){const o={scene:a[0][i.scene||0],scenes:a[0],animations:a[1],cameras:a[2],asset:i.asset,parser:n,userData:{}};return ii(r,o,i),un(o,i),Promise.all(n._invokeAll(function(l){return l.afterRoot&&l.afterRoot(o)})).then(function(){for(const l of o.scenes)l.updateMatrixWorld();e(o)})}).catch(t)}_markDefs(){const e=this.json.nodes||[],t=this.json.skins||[],n=this.json.meshes||[];for(let i=0,r=t.length;i<r;i++){const a=t[i].joints;for(let o=0,l=a.length;o<l;o++)e[a[o]].isBone=!0}for(let i=0,r=e.length;i<r;i++){const a=e[i];a.mesh!==void 0&&(this._addNodeRef(this.meshCache,a.mesh),a.skin!==void 0&&(n[a.mesh].isSkinnedMesh=!0)),a.camera!==void 0&&this._addNodeRef(this.cameraCache,a.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,n){if(e.refs[t]<=1)return n;const i=n.clone(),r=(a,o)=>{const l=this.associations.get(a);l!=null&&this.associations.set(o,l);for(const[c,h]of a.children.entries())r(h,o.children[c])};return r(n,i),i.name+="_instance_"+e.uses[t]++,i}_invokeOne(e){const t=Object.values(this.plugins);t.push(this);for(let n=0;n<t.length;n++){const i=e(t[n]);if(i)return i}return null}_invokeAll(e){const t=Object.values(this.plugins);t.unshift(this);const n=[];for(let i=0;i<t.length;i++){const r=e(t[i]);r&&n.push(r)}return n}getDependency(e,t){const n=e+":"+t;let i=this.cache.get(n);if(!i){switch(e){case"scene":i=this.loadScene(t);break;case"node":i=this._invokeOne(function(r){return r.loadNode&&r.loadNode(t)});break;case"mesh":i=this._invokeOne(function(r){return r.loadMesh&&r.loadMesh(t)});break;case"accessor":i=this.loadAccessor(t);break;case"bufferView":i=this._invokeOne(function(r){return r.loadBufferView&&r.loadBufferView(t)});break;case"buffer":i=this.loadBuffer(t);break;case"material":i=this._invokeOne(function(r){return r.loadMaterial&&r.loadMaterial(t)});break;case"texture":i=this._invokeOne(function(r){return r.loadTexture&&r.loadTexture(t)});break;case"skin":i=this.loadSkin(t);break;case"animation":i=this._invokeOne(function(r){return r.loadAnimation&&r.loadAnimation(t)});break;case"camera":i=this.loadCamera(t);break;default:if(i=this._invokeOne(function(r){return r!=this&&r.getDependency&&r.getDependency(e,t)}),!i)throw new Error("Unknown type: "+e);break}this.cache.add(n,i)}return i}getDependencies(e){let t=this.cache.get(e);if(!t){const n=this,i=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(i.map(function(r,a){return n.getDependency(e,a)})),this.cache.add(e,t)}return t}loadBuffer(e){const t=this.json.buffers[e],n=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[ze.KHR_BINARY_GLTF].body);const i=this.options;return new Promise(function(r,a){n.load(ms.resolveURL(t.uri,i.path),r,void 0,function(){a(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){const t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(n){const i=t.byteLength||0,r=t.byteOffset||0;return n.slice(r,r+i)})}loadAccessor(e){const t=this,n=this.json,i=this.json.accessors[e];if(i.bufferView===void 0&&i.sparse===void 0){const a=ua[i.type],o=Ui[i.componentType],l=i.normalized===!0,c=new o(i.count*a);return Promise.resolve(new Ft(c,a,l))}const r=[];return i.bufferView!==void 0?r.push(this.getDependency("bufferView",i.bufferView)):r.push(null),i.sparse!==void 0&&(r.push(this.getDependency("bufferView",i.sparse.indices.bufferView)),r.push(this.getDependency("bufferView",i.sparse.values.bufferView))),Promise.all(r).then(function(a){const o=a[0],l=ua[i.type],c=Ui[i.componentType],h=c.BYTES_PER_ELEMENT,d=h*l,u=i.byteOffset||0,f=i.bufferView!==void 0?n.bufferViews[i.bufferView].byteStride:void 0,g=i.normalized===!0;let x,m;if(f&&f!==d){const p=Math.floor(u/f),v="InterleavedBuffer:"+i.bufferView+":"+i.componentType+":"+p+":"+i.count;let S=t.cache.get(v);S||(x=new c(o,p*f,i.count*f/h),S=new Ad(x,f/h),t.cache.add(v,S)),m=new wo(S,l,u%f/h,g)}else o===null?x=new c(i.count*l):x=new c(o,u,i.count*l),m=new Ft(x,l,g);if(i.sparse!==void 0){const p=ua.SCALAR,v=Ui[i.sparse.indices.componentType],S=i.sparse.indices.byteOffset||0,b=i.sparse.values.byteOffset||0,A=new v(a[1],S,i.sparse.count*p),T=new c(a[2],b,i.sparse.count*l);o!==null&&(m=new Ft(m.array.slice(),m.itemSize,m.normalized)),m.normalized=!1;for(let R=0,M=A.length;R<M;R++){const w=A[R];if(m.setX(w,T[R*l]),l>=2&&m.setY(w,T[R*l+1]),l>=3&&m.setZ(w,T[R*l+2]),l>=4&&m.setW(w,T[R*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}m.normalized=g}return m})}loadTexture(e){const t=this.json,n=this.options,r=t.textures[e].source,a=t.images[r];let o=this.textureLoader;if(a.uri){const l=n.manager.getHandler(a.uri);l!==null&&(o=l)}return this.loadTextureImage(e,r,o)}loadTextureImage(e,t,n){const i=this,r=this.json,a=r.textures[e],o=r.images[t],l=(o.uri||o.bufferView)+":"+a.sampler;if(this.textureCache[l])return this.textureCache[l];const c=this.loadImageSource(t,n).then(function(h){h.flipY=!1,h.name=a.name||o.name||"",h.name===""&&typeof o.uri=="string"&&o.uri.startsWith("data:image/")===!1&&(h.name=o.uri);const u=(r.samplers||{})[a.sampler]||{};return h.magFilter=_c[u.magFilter]||Tt,h.minFilter=_c[u.minFilter]||Cn,h.wrapS=vc[u.wrapS]||ui,h.wrapT=vc[u.wrapT]||ui,h.generateMipmaps=!h.isCompressedTexture&&h.minFilter!==bt&&h.minFilter!==Tt,i.associations.set(h,{textures:e}),h}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){const n=this,i=this.json,r=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(d=>d.clone());const a=i.images[e],o=self.URL||self.webkitURL;let l=a.uri||"",c=!1;if(a.bufferView!==void 0)l=n.getDependency("bufferView",a.bufferView).then(function(d){c=!0;const u=new Blob([d],{type:a.mimeType});return l=o.createObjectURL(u),l});else if(a.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");const h=Promise.resolve(l).then(function(d){return new Promise(function(u,f){let g=u;t.isImageBitmapLoader===!0&&(g=function(x){const m=new Et(x);m.needsUpdate=!0,u(m)}),t.load(ms.resolveURL(d,r.path),g,void 0,f)})}).then(function(d){return c===!0&&o.revokeObjectURL(l),un(d,a),d.userData.mimeType=a.mimeType||n_(a.uri),d}).catch(function(d){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),d});return this.sourceCache[e]=h,h}assignTexture(e,t,n,i){const r=this;return this.getDependency("texture",n.index).then(function(a){if(!a)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(a=a.clone(),a.channel=n.texCoord),r.extensions[ze.KHR_TEXTURE_TRANSFORM]){const o=n.extensions!==void 0?n.extensions[ze.KHR_TEXTURE_TRANSFORM]:void 0;if(o){const l=r.associations.get(a);a=r.extensions[ze.KHR_TEXTURE_TRANSFORM].extendTexture(a,o),r.associations.set(a,l)}}return i!==void 0&&(a.colorSpace=i),e[t]=a,a})}assignFinalMaterial(e){const t=e.geometry;let n=e.material;const i=t.attributes.tangent===void 0,r=t.attributes.color!==void 0,a=t.attributes.normal===void 0;if(e.isPoints){const o="PointsMaterial:"+n.uuid;let l=this.cache.get(o);l||(l=new oh,gn.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,l.sizeAttenuation=!1,this.cache.add(o,l)),n=l}else if(e.isLine){const o="LineBasicMaterial:"+n.uuid;let l=this.cache.get(o);l||(l=new ah,gn.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,this.cache.add(o,l)),n=l}if(i||r||a){let o="ClonedMaterial:"+n.uuid+":";i&&(o+="derivative-tangents:"),r&&(o+="vertex-colors:"),a&&(o+="flat-shading:");let l=this.cache.get(o);l||(l=n.clone(),r&&(l.vertexColors=!0),a&&(l.flatShading=!0),i&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(o,l),this.associations.set(l,this.associations.get(n))),n=l}e.material=n}getMaterialType(){return Mr}loadMaterial(e){const t=this,n=this.json,i=this.extensions,r=n.materials[e];let a;const o={},l=r.extensions||{},c=[];if(l[ze.KHR_MATERIALS_UNLIT]){const d=i[ze.KHR_MATERIALS_UNLIT];a=d.getMaterialType(),c.push(d.extendParams(o,r,t))}else{const d=r.pbrMetallicRoughness||{};if(o.color=new Ce(1,1,1),o.opacity=1,Array.isArray(d.baseColorFactor)){const u=d.baseColorFactor;o.color.setRGB(u[0],u[1],u[2],Xt),o.opacity=u[3]}d.baseColorTexture!==void 0&&c.push(t.assignTexture(o,"map",d.baseColorTexture,Ct)),o.metalness=d.metallicFactor!==void 0?d.metallicFactor:1,o.roughness=d.roughnessFactor!==void 0?d.roughnessFactor:1,d.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(o,"metalnessMap",d.metallicRoughnessTexture)),c.push(t.assignTexture(o,"roughnessMap",d.metallicRoughnessTexture))),a=this._invokeOne(function(u){return u.getMaterialType&&u.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(u){return u.extendMaterialParams&&u.extendMaterialParams(e,o)})))}r.doubleSided===!0&&(o.side=en);const h=r.alphaMode||da.OPAQUE;if(h===da.BLEND?(o.transparent=!0,o.depthWrite=!1):(o.transparent=!1,h===da.MASK&&(o.alphaTest=r.alphaCutoff!==void 0?r.alphaCutoff:.5)),r.normalTexture!==void 0&&a!==Kn&&(c.push(t.assignTexture(o,"normalMap",r.normalTexture)),o.normalScale=new qe(1,1),r.normalTexture.scale!==void 0)){const d=r.normalTexture.scale;o.normalScale.set(d,d)}if(r.occlusionTexture!==void 0&&a!==Kn&&(c.push(t.assignTexture(o,"aoMap",r.occlusionTexture)),r.occlusionTexture.strength!==void 0&&(o.aoMapIntensity=r.occlusionTexture.strength)),r.emissiveFactor!==void 0&&a!==Kn){const d=r.emissiveFactor;o.emissive=new Ce().setRGB(d[0],d[1],d[2],Xt)}return r.emissiveTexture!==void 0&&a!==Kn&&c.push(t.assignTexture(o,"emissiveMap",r.emissiveTexture,Ct)),Promise.all(c).then(function(){const d=new a(o);return r.name&&(d.name=r.name),un(d,r),t.associations.set(d,{materials:e}),r.extensions&&ii(i,d,r),d})}createUniqueName(e){const t=Qe.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){const t=this,n=this.extensions,i=this.primitiveCache;function r(o){return n[ze.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(o,t).then(function(l){return Mc(l,o,t)})}const a=[];for(let o=0,l=e.length;o<l;o++){const c=e[o],h=t_(c),d=i[h];if(d)a.push(d.promise);else{let u;c.extensions&&c.extensions[ze.KHR_DRACO_MESH_COMPRESSION]?u=r(c):u=Mc(new Ot,c,t),i[h]={primitive:c,promise:u},a.push(u)}}return Promise.all(a)}loadMesh(e){const t=this,n=this.json,i=this.extensions,r=n.meshes[e],a=r.primitives,o=[];for(let l=0,c=a.length;l<c;l++){const h=a[l].material===void 0?Jx(this.cache):this.getDependency("material",a[l].material);o.push(h)}return o.push(t.loadGeometries(a)),Promise.all(o).then(function(l){const c=l.slice(0,l.length-1),h=l[l.length-1],d=[];for(let f=0,g=h.length;f<g;f++){const x=h[f],m=a[f];let p;const v=c[f];if(m.mode===jt.TRIANGLES||m.mode===jt.TRIANGLE_STRIP||m.mode===jt.TRIANGLE_FAN||m.mode===void 0)p=r.isSkinnedMesh===!0?new Pd(x,v):new kt(x,v),p.isSkinnedMesh===!0&&p.normalizeSkinWeights(),m.mode===jt.TRIANGLE_STRIP?p.geometry=mc(p.geometry,$c):m.mode===jt.TRIANGLE_FAN&&(p.geometry=mc(p.geometry,eo));else if(m.mode===jt.LINES)p=new Od(x,v);else if(m.mode===jt.LINE_STRIP)p=new Lo(x,v);else if(m.mode===jt.LINE_LOOP)p=new Bd(x,v);else if(m.mode===jt.POINTS)p=new kd(x,v);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+m.mode);Object.keys(p.geometry.morphAttributes).length>0&&e_(p,r),p.name=t.createUniqueName(r.name||"mesh_"+e),un(p,r),m.extensions&&ii(i,p,m),t.assignFinalMaterial(p),d.push(p)}for(let f=0,g=d.length;f<g;f++)t.associations.set(d[f],{meshes:e,primitives:f});if(d.length===1)return r.extensions&&ii(i,d[0],r),d[0];const u=new jn;r.extensions&&ii(i,u,r),t.associations.set(u,{meshes:e});for(let f=0,g=d.length;f<g;f++)u.add(d[f]);return u})}loadCamera(e){let t;const n=this.json.cameras[e],i=n[n.type];if(!i){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return n.type==="perspective"?t=new Ut(cd.radToDeg(i.yfov),i.aspectRatio||1,i.znear||1,i.zfar||2e6):n.type==="orthographic"&&(t=new Sr(-i.xmag,i.xmag,i.ymag,-i.ymag,i.znear,i.zfar)),n.name&&(t.name=this.createUniqueName(n.name)),un(t,n),Promise.resolve(t)}loadSkin(e){const t=this.json.skins[e],n=[];for(let i=0,r=t.joints.length;i<r;i++)n.push(this._loadNodeShallow(t.joints[i]));return t.inverseBindMatrices!==void 0?n.push(this.getDependency("accessor",t.inverseBindMatrices)):n.push(null),Promise.all(n).then(function(i){const r=i.pop(),a=i,o=[],l=[];for(let c=0,h=a.length;c<h;c++){const d=a[c];if(d){o.push(d);const u=new ke;r!==null&&u.fromArray(r.array,c*16),l.push(u)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Ro(o,l)})}loadAnimation(e){const t=this.json,n=this,i=t.animations[e],r=i.name?i.name:"animation_"+e,a=[],o=[],l=[],c=[],h=[];for(let d=0,u=i.channels.length;d<u;d++){const f=i.channels[d],g=i.samplers[f.sampler],x=f.target,m=x.node,p=i.parameters!==void 0?i.parameters[g.input]:g.input,v=i.parameters!==void 0?i.parameters[g.output]:g.output;x.node!==void 0&&(a.push(this.getDependency("node",m)),o.push(this.getDependency("accessor",p)),l.push(this.getDependency("accessor",v)),c.push(g),h.push(x))}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l),Promise.all(c),Promise.all(h)]).then(function(d){const u=d[0],f=d[1],g=d[2],x=d[3],m=d[4],p=[];for(let S=0,b=u.length;S<b;S++){const A=u[S],T=f[S],R=g[S],M=x[S],w=m[S];if(A===void 0)continue;A.updateMatrix&&A.updateMatrix();const P=n._createAnimationTracks(A,T,R,M,w);if(P)for(let C=0;C<P.length;C++)p.push(P[C])}const v=new tf(r,void 0,p);return un(v,i),v})}createNodeMesh(e){const t=this.json,n=this,i=t.nodes[e];return i.mesh===void 0?null:n.getDependency("mesh",i.mesh).then(function(r){const a=n._getNodeRef(n.meshCache,i.mesh,r);return i.weights!==void 0&&a.traverse(function(o){if(o.isMesh)for(let l=0,c=i.weights.length;l<c;l++)o.morphTargetInfluences[l]=i.weights[l]}),a})}loadNode(e){const t=this.json,n=this,i=t.nodes[e],r=n._loadNodeShallow(e),a=[],o=i.children||[];for(let c=0,h=o.length;c<h;c++)a.push(n.getDependency("node",o[c]));const l=i.skin===void 0?Promise.resolve(null):n.getDependency("skin",i.skin);return Promise.all([r,Promise.all(a),l]).then(function(c){const h=c[0],d=c[1],u=c[2];u!==null&&h.traverse(function(f){f.isSkinnedMesh&&f.bind(u,i_)});for(let f=0,g=d.length;f<g;f++)h.add(d[f]);if(h.userData.pivot!==void 0&&d.length>0){const f=h.userData.pivot,g=d[0];h.pivot=new U().fromArray(f),h.position.x-=f[0],h.position.y-=f[1],h.position.z-=f[2],g.position.set(0,0,0),delete h.userData.pivot}return h})}_loadNodeShallow(e){const t=this.json,n=this.extensions,i=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];const r=t.nodes[e],a=r.name?i.createUniqueName(r.name):"",o=[],l=i._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&o.push(l),r.camera!==void 0&&o.push(i.getDependency("camera",r.camera).then(function(c){return i._getNodeRef(i.cameraCache,r.camera,c)})),i._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){o.push(c)}),this.nodeCache[e]=Promise.all(o).then(function(c){let h;if(r.isBone===!0?h=new sh:c.length>1?h=new jn:c.length===1?h=c[0]:h=new ht,h!==c[0])for(let d=0,u=c.length;d<u;d++)h.add(c[d]);if(r.name&&(h.userData.name=r.name,h.name=a),un(h,r),r.extensions&&ii(n,h,r),r.matrix!==void 0){const d=new ke;d.fromArray(r.matrix),h.applyMatrix4(d)}else r.translation!==void 0&&h.position.fromArray(r.translation),r.rotation!==void 0&&h.quaternion.fromArray(r.rotation),r.scale!==void 0&&h.scale.fromArray(r.scale);if(!i.associations.has(h))i.associations.set(h,{});else if(r.mesh!==void 0&&i.meshCache.refs[r.mesh]>1){const d=i.associations.get(h);i.associations.set(h,{...d})}return i.associations.get(h).nodes=e,h}),this.nodeCache[e]}loadScene(e){const t=this.extensions,n=this.json.scenes[e],i=this,r=new jn;n.name&&(r.name=i.createUniqueName(n.name)),un(r,n),n.extensions&&ii(t,r,n);const a=n.nodes||[],o=[];for(let l=0,c=a.length;l<c;l++)o.push(i.getDependency("node",a[l]));return Promise.all(o).then(function(l){for(let h=0,d=l.length;h<d;h++){const u=l[h];u.parent!==null?r.add(Ex(u)):r.add(u)}const c=h=>{const d=new Map;for(const[u,f]of i.associations)(u instanceof gn||u instanceof Et)&&d.set(u,f);return h.traverse(u=>{const f=i.associations.get(u);f!=null&&d.set(u,f)}),d};return i.associations=c(r),r})}_createAnimationTracks(e,t,n,i,r){const a=[],o=e.name?e.name:e.uuid,l=[];function c(f){f.morphTargetInfluences&&l.push(f.name?f.name:f.uuid)}qn[r.path]===qn.weights?(c(e),e.isGroup&&e.children.forEach(c)):l.push(o);let h;switch(qn[r.path]){case qn.weights:h=Hi;break;case qn.rotation:h=Gi;break;case qn.translation:case qn.scale:h=Wi;break;default:switch(n.itemSize){case 1:h=Hi;break;case 2:case 3:default:h=Wi;break}break}const d=i.interpolation!==void 0?$x[i.interpolation]:vs,u=this._getArrayFromAccessor(n);for(let f=0,g=l.length;f<g;f++){const x=new h(l[f]+"."+qn[r.path],t.array,u,d);i.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(x),a.push(x)}return a}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){const n=co(t.constructor),i=new Float32Array(t.length);for(let r=0,a=t.length;r<a;r++)i[r]=t[r]*n;t=i}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(n){const i=this instanceof Gi?Zx:wh;return new i(this.times,this.values,this.getValueSize()/3,n)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}function r_(s,e,t){const n=e.attributes,i=new vn;if(n.POSITION!==void 0){const o=t.json.accessors[n.POSITION],l=o.min,c=o.max;if(l!==void 0&&c!==void 0){if(i.set(new U(l[0],l[1],l[2]),new U(c[0],c[1],c[2])),o.normalized){const h=co(Ui[o.componentType]);i.min.multiplyScalar(h),i.max.multiplyScalar(h)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const r=e.targets;if(r!==void 0){const o=new U,l=new U;for(let c=0,h=r.length;c<h;c++){const d=r[c];if(d.POSITION!==void 0){const u=t.json.accessors[d.POSITION],f=u.min,g=u.max;if(f!==void 0&&g!==void 0){if(l.setX(Math.max(Math.abs(f[0]),Math.abs(g[0]))),l.setY(Math.max(Math.abs(f[1]),Math.abs(g[1]))),l.setZ(Math.max(Math.abs(f[2]),Math.abs(g[2]))),u.normalized){const x=co(Ui[u.componentType]);l.multiplyScalar(x)}o.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}i.expandByVector(o)}s.boundingBox=i;const a=new Mn;i.getCenter(a.center),a.radius=i.min.distanceTo(i.max)/2,s.boundingSphere=a}function Mc(s,e,t){const n=e.attributes,i=[];function r(a,o){return t.getDependency("accessor",a).then(function(l){s.setAttribute(o,l)})}for(const a in n){const o=lo[a]||a.toLowerCase();o in s.attributes||i.push(r(n[a],o))}if(e.indices!==void 0&&!s.index){const a=t.getDependency("accessor",e.indices).then(function(o){s.setIndex(o)});i.push(a)}return He.workingColorSpace!==Xt&&"COLOR_0"in n&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${He.workingColorSpace}" not supported.`),un(s,e),r_(s,e,t),Promise.all(i).then(function(){return e.targets!==void 0?Qx(s,e.targets,t):s})}const a_={success:[{frequency:523.25,duration:.07},{frequency:659.25,duration:.08,delay:.06},{frequency:783.99,duration:.1,delay:.13}],failure:[{frequency:246.94,duration:.11},{frequency:185,duration:.16,delay:.1}],victory:[{frequency:523.25,duration:.08},{frequency:659.25,duration:.08,delay:.07},{frequency:783.99,duration:.08,delay:.14},{frequency:1046.5,duration:.16,delay:.21}],defeat:[{frequency:220,duration:.1},{frequency:164.81,duration:.12,delay:.09},{frequency:130.81,duration:.18,delay:.19}]};function o_(s){let e=null;const t=()=>{try{const r=s();return{enabled:r.enabled,volumePercent:h_(r.volumePercent??50,0,100)}}catch{return{enabled:!1,volumePercent:0}}},n=r=>{var o,l;const a=l_(r);try{const c=(l=(o=a==null?void 0:a.pluginAPI)==null?void 0:o.audioContext)==null?void 0:l.call(o);if(c)return c}catch(c){console.warn("Unable to access jsPsych audio context.",c)}return typeof window>"u"||typeof window.AudioContext>"u"?null:(e??(e=new AudioContext),e)},i=(r,a)=>{const o=t();if(!o.enabled||o.volumePercent<=0)return;const l=n(a);if(!l)return;Sc(l);const c=o.volumePercent/100*.18,h=l.currentTime+.01;a_[r].forEach(d=>c_(l,d,h,c))};return{PrepareAudioFeedback(r){const a=t();!a.enabled||a.volumePercent<=0||Sc(n(r))},PlaySuccessSound(r){i("success",r)},PlayFailureSound(r){i("failure",r)},PlayGameEndSound(r,a){r==="Victory"&&i("victory",a),r==="Defeat"&&i("defeat",a)}}}function l_(s){const t=(s==null?void 0:s.current)??s;return!t||typeof t!="object"?null:t}function Sc(s){!s||s.state==="running"||s.resume().catch(()=>{})}function c_(s,e,t,n){const i=s.createOscillator(),r=s.createGain(),a=t+(e.delay??0),o=a+e.duration;i.type="sine",i.frequency.setValueAtTime(e.frequency,a),r.gain.setValueAtTime(1e-4,a),r.gain.exponentialRampToValueAtTime(Math.max(1e-4,n),a+.015),r.gain.exponentialRampToValueAtTime(1e-4,o),i.connect(r),r.connect(s.destination),i.start(a),i.stop(o+.02)}function h_(s,e,t){return Number.isFinite(s)?Math.min(t,Math.max(e,s)):e}const{PrepareAudioFeedback:u_,PlaySuccessSound:d_,PlayFailureSound:f_,PlayGameEndSound:p_}=o_(()=>({enabled:!0,volumePercent:50})),si={playSuccess:d_,playFailure:f_,playEnd:p_,prepare:u_},ri={beginner:{hazardTimeoutMs:5200,hazardLeadDistance:40,minHazardInterval:50,maxHazardInterval:90},intermediate:{hazardTimeoutMs:3200,hazardLeadDistance:30,minHazardInterval:35,maxHazardInterval:65},advanced:{hazardTimeoutMs:1800,hazardLeadDistance:22,minHazardInterval:25,maxHazardInterval:50}},m_=[{id:"wrong-way-driver"}],g_=121.5618,Ah=25.0345,x_=60,__=178,Rh=111320,v_=Rh*Math.cos(Ah*Math.PI/180),yc=1,M_=3.2;function ho(s,e){return{x:x_+(s-g_)*v_*yc,z:__-(e-Ah)*Rh*yc}}function $i(s,e=1.2){return s*M_+e}const Ch=$i(6,2.4),Lh=$i(8,2.8),Ph=$i(6,2.4),Dh=$i(4,1.8),mr=$i(4,1.8),Ih=$i(6,2),bc="rehabtrainerhub.vision.driving.lastRouteId",Fi=Ch,uo=Lh,pa=Ph,Nh=Dh;let Tc=null;function S_(s){if(s.name.includes("Xinyi Road")){const e=s.laneCount>=4?8:6;return{roadWidth:e===8?Lh:Ch,laneCount:e,oneWay:!1}}return s.name.includes("Keelung Road")?{roadWidth:Ph,laneCount:6,oneWay:!1}:s.name.includes("City Hall Road")?{roadWidth:Dh,laneCount:4,oneWay:!1}:s.name.includes("Songzhi Road")?{roadWidth:Ih,laneCount:6,oneWay:!1}:s.name.includes("Songshou Road")?{roadWidth:mr,laneCount:4,oneWay:!1}:{roadWidth:s.roadWidth,laneCount:s.laneCount,oneWay:!1}}const y_=[{lon:121.5576717,lat:25.0297961,roadWidth:pa,laneCount:3,oneWay:!0,name:"Keelung Road Section 2"},{lon:121.5589772,lat:25.0318959,roadWidth:pa,laneCount:3,oneWay:!0,name:"Keelung Road Section 2"},{lon:121.5590422,lat:25.0320558,roadWidth:pa,laneCount:3,oneWay:!0,name:"Keelung Road Section 2"},{lon:121.5596234,lat:25.0329882,roadWidth:Fi,laneCount:3,oneWay:!0,name:"Xinyi Road Section 5"},{lon:121.5597077,lat:25.0331059,roadWidth:Fi,laneCount:3,oneWay:!0,name:"Xinyi Road Section 5"},{lon:121.5599064,lat:25.0330834,roadWidth:Fi,laneCount:3,oneWay:!0,name:"Xinyi Road Section 5"},{lon:121.5654166,lat:25.032958,roadWidth:uo,laneCount:4,oneWay:!0,name:"Xinyi Road Section 5"},{lon:121.568228,lat:25.0327688,roadWidth:uo,laneCount:4,oneWay:!0,name:"Xinyi Road Section 5"}],b_=[{lon:121.5596234,lat:25.0329882,roadWidth:Fi,laneCount:3,oneWay:!0,name:"Xinyi Road Section 5"},{lon:121.5599064,lat:25.0330834,roadWidth:Fi,laneCount:3,oneWay:!0,name:"Xinyi Road Section 5"},{lon:121.5654166,lat:25.032958,roadWidth:uo,laneCount:4,oneWay:!0,name:"Xinyi Road Section 5"},{lon:121.5654166,lat:25.032958,roadWidth:Ih,laneCount:6,oneWay:!1,name:"Songzhi Road"},{lon:121.5654635,lat:25.0358704,roadWidth:mr,laneCount:4,oneWay:!1,name:"Songshou Road"},{lon:121.5635641,lat:25.035905,roadWidth:Nh,laneCount:2,oneWay:!0,name:"City Hall Road"}],T_=[{lon:121.5654635,lat:25.0358704,roadWidth:mr,laneCount:4,oneWay:!1,name:"Songshou Road"},{lon:121.5635641,lat:25.035905,roadWidth:mr,laneCount:4,oneWay:!1,name:"Songshou Road"},{lon:121.5636052,lat:25.0357702,roadWidth:Nh,laneCount:2,oneWay:!0,name:"City Hall Road"},{lon:121.5635362,lat:25.0330043,roadWidth:Fi,laneCount:3,oneWay:!0,name:"Xinyi Road Section 5"}],Di=[{id:"keelung-to-xinyi-east",label:"Keelung to Xinyi east",points:y_},{id:"songzhi-north-delivery",label:"Songzhi north delivery",points:b_},{id:"songshou-to-city-hall",label:"Songshou to City Hall",points:T_}];function E_(s){const e=[];for(let t=0;t<s.length-1;t+=1){const n=ho(s[t].lon,s[t].lat),i=ho(s[t+1].lon,s[t+1].lat),r=S_(s[t]),a=i.x-n.x,o=i.z-n.z,l=Math.hypot(a,o);l<.5||e.push({start:n,dir:{x:a/l,z:o/l},length:l,roadWidth:r.roadWidth,laneCount:r.laneCount,oneWay:r.oneWay,name:s[t].name})}return A_(e)}function Ec(s,e){const t=Math.cos(e),n=Math.sin(e);return{x:s.x*t-s.z*n,z:s.x*n+s.z*t}}function w_(s){const e=Math.hypot(s.x,s.z)||1;return{x:s.x/e,z:s.z/e}}function A_(s){const e=s[0];if(!e)return s;const t=e.start,i=-Math.atan2(e.dir.x,-e.dir.z);return s.map(r=>({...r,start:Ec({x:r.start.x-t.x,z:r.start.z-t.z},i),dir:w_(Ec(r.dir,i))}))}function Uh(s){return E_(s.points)}function R_(){var i,r;let s=null;try{typeof window<"u"&&(s=(i=window.localStorage)==null?void 0:i.getItem(bc))}catch{s=null}const e=Tc??s,t=Di.length>1?Di.filter(a=>a.id!==e):Di,n=t[Math.floor(Math.random()*t.length)]??Di[0];Tc=n.id;try{typeof window<"u"&&((r=window.localStorage)==null||r.setItem(bc,n.id))}catch{}return n}const C_=Uh(Di[0]),wc={AmbientLight:gf,Box3:vn,BoxGeometry:Xi,CanvasTexture:zd,Color:Ce,ConeGeometry:Po,CylinderGeometry:vr,DirectionalLight:mh,DoubleSide:en,Fog:Eo,Group:jn,HemisphereLight:hf,InstancedMesh:rh,Mesh:kt,MeshBasicMaterial:Kn,MeshStandardMaterial:Mr,Object3D:ht,PerspectiveCamera:Ut,PlaneGeometry:ys,RepeatWrapping:ui,Scene:bd,SphereGeometry:Do,SRGBColorSpace:Ct,TorusGeometry:Io,Vector3:U,Vector4:st,WebGLRenderer:Tx,WebGLRenderTarget:rn},Ac=.45,L_=2.05,Rc=35,P_=1.65,D_=68,Cc=9,I_=3.35,Lc=10.5,N_=1.45,U_=65;function F_({vehicleX:s,vehicleZ:e,vehicleHeading:t,mode:n}){const i=Math.sin(t),r=-Math.cos(t);return n==="third-person"?{position:{x:s-i*Cc,y:I_,z:e-r*Cc},lookAt:{x:s+i*Lc,y:N_,z:e+r*Lc},up:{x:0,y:1,z:0},fov:U_}:{position:{x:s+i*Ac,y:L_,z:e+r*Ac},lookAt:{x:s+i*Rc,y:P_,z:e+r*Rc},up:{x:0,y:1,z:0},fov:D_}}const O_={low:{level:"low",pixelRatioCap:1,antialias:!1,cameraFar:420,fogNear:120,fogFar:360,roadTextureSize:256,roadNoiseSamples:650,vehicleTextureSize:512,useReferenceVehicleModel:!1,useOsmCity:!1,osmRoadSegmentLimit:0,osmBuildingLimit:0,ambientTrafficCount:10},medium:{level:"medium",pixelRatioCap:1.5,antialias:!0,cameraFar:650,fogNear:180,fogFar:560,roadTextureSize:512,roadNoiseSamples:1200,vehicleTextureSize:512,useReferenceVehicleModel:!0,useOsmCity:!1,osmRoadSegmentLimit:150,osmBuildingLimit:72,ambientTrafficCount:14},high:{level:"high",pixelRatioCap:1.5,antialias:!0,cameraFar:900,fogNear:260,fogFar:780,roadTextureSize:512,roadNoiseSamples:1800,vehicleTextureSize:1024,useReferenceVehicleModel:!0,useOsmCity:!1,osmRoadSegmentLimit:230,osmBuildingLimit:120,ambientTrafficCount:18}};function B_(s){return s==="low"||s==="medium"||s==="high"}function Pc(s){const e=B_(s)?s:"high";return{...O_[e]}}function Fh(s,e,t,n){const i=Math.max(1,Math.round(Number.isFinite(s)?s:1)),r=Math.max(1,Math.round(Number.isFinite(e)?e:1)),a=Number.isFinite(t)&&t>0?t:1,o=Number.isFinite(n)&&n>0?n:1,l=Math.max(.5,Math.min(a,o));return{cssWidth:i,cssHeight:r,aspect:i/r,pixelRatio:l,bufferWidth:Math.max(1,Math.floor(i*l)),bufferHeight:Math.max(1,Math.floor(r*l))}}function k_(s,e){return!!s&&(s==null?void 0:s.cssWidth)===e.cssWidth&&s.cssHeight===e.cssHeight&&Math.abs(s.pixelRatio-e.pixelRatio)<1e-4}class z_{constructor(e){X(this,"metrics",null);X(this,"resizeObserver",null);X(this,"handleResize",()=>this.sync());this.options=e}start(){var e;this.sync(!0),window.addEventListener("resize",this.handleResize),(e=window.visualViewport)==null||e.addEventListener("resize",this.handleResize),typeof ResizeObserver<"u"&&(this.resizeObserver=new ResizeObserver(this.handleResize),this.resizeObserver.observe(this.options.root))}sync(e=!1){const{root:t,renderer:n,camera:i,pixelRatioCap:r,onLayoutChange:a}=this.options,o=t.getBoundingClientRect(),l=t.clientWidth||o.width,c=t.clientHeight||o.height,h=Fh(l,c,window.devicePixelRatio||1,r);if(!e&&k_(this.metrics,h))return this.metrics;const d=!this.metrics||Math.abs(i.aspect-h.aspect)>1e-6;return(!this.metrics||Math.abs(this.metrics.pixelRatio-h.pixelRatio)>1e-4)&&n.setPixelRatio(h.pixelRatio),n.setSize(h.cssWidth,h.cssHeight,!1),d&&(i.aspect=h.aspect,i.updateProjectionMatrix()),this.metrics=h,t.dataset.drivingViewport=`${h.cssWidth}x${h.cssHeight}`,t.dataset.drivingAspect=h.aspect.toFixed(6),n.domElement.dataset.drivingPixelRatio=String(h.pixelRatio),a==null||a(),h}prepareMainRender(){const e=Math.max(.5,Math.min(window.devicePixelRatio||1,this.options.pixelRatioCap)),t=!this.metrics||Math.abs(this.metrics.pixelRatio-e)>1e-4?this.sync():this.metrics,{renderer:n}=this.options;return n.setRenderTarget(null),n.setScissorTest(!1),t}stop(){var e,t;window.removeEventListener("resize",this.handleResize),(e=window.visualViewport)==null||e.removeEventListener("resize",this.handleResize),(t=this.resizeObserver)==null||t.disconnect(),this.resizeObserver=null,this.metrics=null}}function V_(s,e){var r,a;const t=((r=s.getRenderTarget)==null?void 0:r.call(s))??null;if(t!==null)throw new Error("Driving auxiliary passes must be entered from the main framebuffer.");const n=e(),i=e();return s.getViewport(n),s.getScissor(i),{renderTarget:t,viewport:n,scissor:i,scissorTest:!!((a=s.getScissorTest)!=null&&a.call(s))}}function H_(s,e){s.setViewport(e.viewport),s.setScissor(e.scissor),s.setScissorTest(e.scissorTest),s.setRenderTarget(e.renderTarget)}function G_(s,e,t=1e3){const n=Number.isFinite(e)?Math.max(0,e):0,i=Number.isFinite(t)?Math.max(0,t):1e3;return!Number.isFinite(s)||s<=0||s>n||n-s>i?n:s}function W_(s,e,t=1e3/120,n=250){const i=Number.isFinite(s)?Math.max(0,s):0,r=Number.isFinite(e)?Math.max(0,e):0,a=Number.isFinite(t)&&t>0?t:1e3/120,o=Number.isFinite(n)&&n>0?n:250,l=Math.min(r,o),c=i+l,h=Math.floor((c+1e-6)/a),d=h*a;return{stepCount:h,nextAccumulatorMs:Math.max(0,c-d),simulatedMs:d,droppedMs:Math.max(0,r-l)}}function Dc(s,e,t){if(!Number.isFinite(t)||t<=0)return e;const n=Math.max(0,e-s);return s+Math.max(1,Math.ceil(n/t))*t}function X_(s,e,t){const n=Math.max(0,e-s);if(!Number.isFinite(t)||t<=0)return{rtMs:Math.round(n),rawRtMs:n,frameCount:0};const i=n>0?Math.max(1,Math.round(n/t)):0;return{rtMs:Math.round(i*t),rawRtMs:n,frameCount:i}}function q_(s){const e=s.filter(r=>Number.isFinite(r)).sort((r,a)=>r-a);if(e.length===0)return{averageMs:0,medianMs:0};const t=Math.round(e.reduce((r,a)=>r+a,0)/e.length),n=Math.floor(e.length/2),i=e.length%2===1?e[n]:Math.round((e[n-1]+e[n])/2);return{averageMs:t,medianMs:i}}const Ic={zh:{controllerConnected:"已連接控制器：{id}",controllerDisconnected:"方向盤已中斷，請重新連接後繼續",inputPausedTitle:"控制裝置已中斷，訓練已暫停",inputPausedDetail:"重新連接並校正過的方向盤後，計時與事件會從暫停處繼續。按 Esc 可離開訓練。",taskDelivery:"任務：A 點送貨至 B 點",watchRoad:"保持車道並注意突發事件",navigation:"導航",straight:"直行",straightToDestination:"直行抵達目的地",turnAfterMeters:"{dist}m 後{instruction}",upcomingTurn:"導航：前方路口請{instruction} {arrow}",noValidRt:"無有效 RT",collision:"碰撞",dodged:"閃避通過",stopped:"已煞停",brakeReaction:"{label}：反應時間 {rt} ms",hazardResult:"{label}：{outcome} / {rtText}",redLightViolation:"闖紅燈",redLightViolationMessage:"闖紅燈：已記錄一次事件",turnLeft:"左轉",turnRight:"右轉",deliveryTarget:"A 點送貨至 B 點",hazardLabels:{"child-crossing":"小孩突然衝出馬路","plane-crash":"飛機墜落於前方道路","drunk-driver":"醉酒駕駛車輛開上分隔島","elder-stopped":"老人走到路中間停下","wrong-way-driver":"毒駕車輛逆向衝來"}},en:{controllerConnected:"Controller connected: {id}",controllerDisconnected:"Steering wheel disconnected; reconnect it to continue",inputPausedTitle:"Control device disconnected — training paused",inputPausedDetail:"Reconnect the calibrated steering wheel to resume timing and events. Press Escape to leave training.",taskDelivery:"Task: deliver from point A to point B",watchRoad:"Stay in lane and watch for hazards",navigation:"Navigation",straight:"Straight",straightToDestination:"Straight to destination",turnAfterMeters:"in {dist}m {instruction}",upcomingTurn:"Navigation: {instruction} at the upcoming intersection {arrow}",noValidRt:"No valid RT",collision:"Collision",dodged:"Dodged",stopped:"Stopped",brakeReaction:"{label}: reaction time {rt} ms",hazardResult:"{label}: {outcome} / {rtText}",redLightViolation:"Red light violation",redLightViolationMessage:"Red light violation recorded",turnLeft:"turn left",turnRight:"turn right",deliveryTarget:"Delivery from point A to point B",hazardLabels:{"child-crossing":"Child suddenly runs into the road","plane-crash":"Plane crashes onto the road ahead","drunk-driver":"Drunk driver vehicle mounts the median","elder-stopped":"Older pedestrian stops in the road","wrong-way-driver":"Drug-impaired driver approaches the wrong way"}}},Y_={name:"three-driving-rehab",version:"3.0.0",parameters:{red_flash_enabled:{type:Ze.BOOL,default:!0},driving_difficulty:{type:Ze.STRING,default:"beginner"},control_mode:{type:Ze.STRING,default:"arrow"},wheel_calibration:{type:Ze.COMPLEX,default:null},render_quality:{type:Ze.STRING,default:"high"},driving_duration_sec:{type:Ze.INT,default:80},language:{type:Ze.STRING,default:"zh"}},data:{rt:{type:Ze.INT},correct:{type:Ze.BOOL},target:{type:Ze.STRING},response:{type:Ze.STRING},duration_ms:{type:Ze.INT},average_rt:{type:Ze.INT},median_rt:{type:Ze.INT},valid_event_count:{type:Ze.INT},reaction_event_count:{type:Ze.INT},successful_avoidance_count:{type:Ze.INT},event_count:{type:Ze.INT},collisions:{type:Ze.INT},lane_deviations:{type:Ze.INT},average_fps:{type:Ze.INT},display_refresh_hz:{type:Ze.FLOAT},display_refresh_ms:{type:Ze.FLOAT},refresh_sample_count:{type:Ze.INT},refresh_measurement_valid:{type:Ze.BOOL},rendering_quality:{type:Ze.STRING},control_mode:{type:Ze.STRING},route_progress:{type:Ze.FLOAT},driving_events:{type:Ze.COMPLEX}}};class j_{constructor(e){X(this,"renderer",null);X(this,"scene",null);X(this,"camera",null);X(this,"vehicleRoot",null);X(this,"vehicleModel",null);X(this,"fallbackVehicle",null);X(this,"vehicleBlobShadow",null);X(this,"blobShadowTexture",null);X(this,"wheelBindings",[]);X(this,"raf",0);X(this,"unregisterRuntimeDisposer",null);X(this,"finished",!1);X(this,"routeLength",0);X(this,"routeSegmentStarts",[]);X(this,"miniMapRouteSamples",[]);X(this,"lastFrameTime",0);X(this,"trialStartTime",0);X(this,"simulationTime",0);X(this,"simulationAccumulatorMs",0);X(this,"fpsSamples",[]);X(this,"activeHazards",[]);X(this,"eventResults",[]);X(this,"lastBrakePressed",!1);X(this,"pendingBrakeTimestamp",null);X(this,"ambientTrafficActors",[]);X(this,"renderQuality",Pc("high"));X(this,"viewportController",null);X(this,"displayRefreshMs",1e3/60);X(this,"displayRefreshHz",60);X(this,"refreshSampleCount",0);X(this,"refreshMeasured",!1);X(this,"selectedRouteVariant",null);X(this,"vehicleX",0);X(this,"vehicleZ",0);X(this,"vehicleHeading",0);X(this,"vehicleSpeed",0);X(this,"steeringInput",0);X(this,"lastResponseSteering",0);X(this,"frontWheelAngle",0);X(this,"lastYawRate",0);X(this,"progress",0);X(this,"previousProgress",0);X(this,"lateralOffset",0);X(this,"laneDeviationCount",0);X(this,"laneDeviationActive",!1);X(this,"laneMarkingViolationActive",!1);X(this,"navigationDeviationActive",!1);X(this,"lastCollisionEventTime",0);X(this,"laneDepartureStartTime",null);X(this,"lastInLanePose",null);X(this,"laneDeparturePose",null);X(this,"laneResetActive",!1);X(this,"laneResetBlackoutTimer",null);X(this,"laneResetClearTimer",null);X(this,"needsFirstFrameCameraSnap",!1);X(this,"cameraMode","first-person");X(this,"wheelSpin",0);X(this,"intersections",[]);X(this,"difficultyPreset",ri.beginner);X(this,"miniMapCanvas",null);X(this,"miniMapCtx",null);X(this,"rearviewMirrorCanvases",{});X(this,"rearviewRenderTargets",{});X(this,"rearviewPixelBuffers",{});X(this,"rearviewImageData",new WeakMap);X(this,"rearviewCamera",null);X(this,"rearviewLookAt",null);X(this,"rearviewLastUpdateTime",0);X(this,"sideRearviewMirrorsEnabled",!0);X(this,"rearviewQualityLevel","high");X(this,"miniMapLastUpdateTime",0);X(this,"miniMapLastDirectionText","");X(this,"asphaltTexture",null);X(this,"asphaltMaterials",new Map);X(this,"signTextureCache",new Map);X(this,"miniMapDirectionLabel",null);X(this,"cockpitSteeringWheel",null);X(this,"cockpitSpeedNeedle",null);X(this,"cockpitSpeedText",null);X(this,"keyState",{left:!1,right:!1,up:!1,down:!1});X(this,"keydownListener",null);X(this,"keyupListener",null);X(this,"touchControlsRoot",null);X(this,"inputPauseOverlay",null);X(this,"inputPausedAt",0);X(this,"visibilityPausedAt",null);X(this,"visibilityChangeListener",null);X(this,"gamepadConnectedListener",null);X(this,"gamepadDisconnectedListener",null);X(this,"gamepadConnected",!1);X(this,"controlMode","arrow");X(this,"wheelCalibration",null);X(this,"language","zh");X(this,"text",Ic.zh);X(this,"hud",null);X(this,"roadCollisionBoxes",[]);X(this,"buildingCollisionBoxes",[]);X(this,"defaultRoadWidth",10.95);X(this,"defaultLaneWidth",3.2);X(this,"vehicleHalfWidth",1);X(this,"vehicleHalfLength",2.25);X(this,"wheelBase",2.72);X(this,"maxVehicleSpeed",18);X(this,"fixedSimulationStepMs",1e3/120);X(this,"maxSimulationCatchUpMs",250);X(this,"baseCameraFov",68);X(this,"initialRouteDistance",18);X(this,"routeTurnBlendDistance",14);X(this,"referenceVehicleModelYawOffset",Math.PI);X(this,"sidewalkWidth",3);X(this,"buildingRoadGap",1.2);X(this,"buildingRoadMargin",.35);X(this,"buildingIntersectionClearance",24);X(this,"roadMarkingIntersectionClearance",30);X(this,"minLaneDeviationLimit",5.4);X(this,"laneDeviationGraceMs",500);X(this,"laneResetBlackoutMs",90);X(this,"laneResetHoldMs",120);X(this,"stopLineSetback",10.5);X(this,"minIntersectionSpacing",70);X(this,"trafficGreenMs",6400);X(this,"trafficYellowMs",1800);X(this,"trafficRedMs",5400);X(this,"referenceVehicleUrls",Zh(void 0,"game-assets/rehabtrainerhub/vision/reference-car/v1/car.glb",new URL(""+new URL("car-Bzns4QWc.glb",import.meta.url).href,import.meta.url).href));X(this,"taipeiOsmUrl",new URL(""+new URL("taipei-xinyi-osm-CpFD8qr_.json",import.meta.url).href,import.meta.url).href);X(this,"route",[...C_]);X(this,"hazardTemplates",[...m_]);this.jsPsych=e,this.route=this.ensureRoute(this.route),this.updateRouteMetrics()}updateRouteMetrics(){this.routeSegmentStarts=[];let e=0;for(const t of this.route)this.routeSegmentStarts.push(e),e+=t.length;this.routeLength=e,this.miniMapRouteSamples=this.createMiniMapRouteSamples()}configureInitialRearviewQuality(){this.rearviewQualityLevel=this.renderQuality.level}trial(e,t){e.replaceChildren(),this.resetTrialState(t),this.unregisterRuntimeDisposer=Yh(()=>{this.finished||(this.finished=!0,this.detachGlobalListeners(),this.cleanupRenderResources())}),si.prepare();const n=document.createElement("div");n.className="driving-rehab-root",n.tabIndex=0,n.setAttribute("aria-busy","true"),Object.assign(n.style,{position:"relative",width:"100%",height:"100%",overflow:"hidden",background:"#0f1720",color:"#fff",fontFamily:cs.fontFamily,userSelect:"none"}),e.appendChild(n);const i=this.createLoadingOverlay(n);(async()=>{if(!(this.finished||this.renderer))try{if(console.info("[DrivingRehab] selected render quality",{level:this.renderQuality.level}),this.initScene(n),this.initHud(n,t.red_flash_enabled??!0),this.initTouchControls(n),this.initInputPauseOverlay(n),this.renderQuality.useReferenceVehicleModel&&await this.loadReferenceVehicleModel(),this.finished)return;if(!e.isConnected){this.finishTrial(e,"aborted");return}this.updateVehicleVisual(0),this.updateTrafficLights(0),this.renderFirstFrameBeforeReveal(performance.now());const a=await iu({sampleCount:48,minimumSampleCount:12,minSampleMs:1,maxSampleMs:100,timeoutMs:2e3});if(this.displayRefreshMs=a.refreshMs,this.displayRefreshHz=a.refreshHz,this.refreshSampleCount=a.sampleCount,this.refreshMeasured=a.measured,n.dataset.drivingRefreshHz=this.refreshMeasured?this.displayRefreshHz.toFixed(3):"fallback",n.dataset.drivingRefreshSamples=String(this.refreshSampleCount),this.finished)return;if(!e.isConnected){this.finishTrial(e,"aborted");return}this.trialStartTime=performance.now(),this.simulationTime=this.trialStartTime,this.simulationAccumulatorMs=0,this.lastFrameTime=this.trialStartTime;const o=this.readInput();this.updateVehicleFree(o,0,this.trialStartTime),this.updateVehicleVisual(0),this.updateTrafficLights(this.trialStartTime),this.lastBrakePressed=o.brake>.35,this.renderFirstFrameBeforeReveal(this.trialStartTime),n.setAttribute("aria-busy","false"),i.remove(),n.focus(),this.attachVisibilityPauseListener(),this.attachKeyboardListeners(e),this.attachGamepadListeners(),this.raf=requestAnimationFrame(l=>this.loop(l,t,e))}catch(a){console.error(a),this.finishTrial(e,"load-error")}})()}createLoadingOverlay(e){const t=document.createElement("div");t.setAttribute("role","status"),t.setAttribute("aria-live","polite"),Object.assign(t.style,{position:"absolute",inset:"0",zIndex:"50",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255, 255, 255, 0.88)",cursor:"wait",pointerEvents:"auto"}),t.setAttribute("aria-label",this.language==="en"?"Loading driving environment...":"正在載入駕駛場景...");const n=document.createElement("div");return n.setAttribute("aria-hidden","true"),Object.assign(n.style,{width:"34px",height:"34px",border:"4px solid rgba(23, 32, 51, 0.2)",borderTopColor:"#172033",borderRadius:"50%",boxSizing:"border-box"}),n.animate([{transform:"rotate(0deg)"},{transform:"rotate(360deg)"}],{duration:850,iterations:1/0}),t.append(n),e.appendChild(t),t}resetTrialState(e){var d;this.cleanupRenderResources(),this.selectedRouteVariant=R_(),this.route=this.ensureRoute(Uh(this.selectedRouteVariant)),this.updateRouteMetrics(),this.finished=!1;const t=this.getInitialRouteDistance(),n=this.getSurfacePoint(t),i=this.getHeadingFromDirection(n.dir),r=this.getDrivingLaneOffset(t),a=this.getRouteLateralPoint(n,r);this.vehicleX=a.x,this.vehicleZ=a.z,this.vehicleHeading=i,this.vehicleSpeed=0,this.steeringInput=0,this.frontWheelAngle=0,this.lastYawRate=0,this.progress=t,this.previousProgress=t,this.lateralOffset=r,this.cameraMode="first-person",this.wheelSpin=0,this.trialStartTime=0,this.simulationTime=0,this.simulationAccumulatorMs=0,this.lastFrameTime=0,this.laneDeviationCount=0,this.laneDeviationActive=!1,this.laneMarkingViolationActive=!1,this.navigationDeviationActive=!1,this.lastCollisionEventTime=0,this.laneDepartureStartTime=null,this.lastInLanePose={x:this.vehicleX,z:this.vehicleZ,progress:this.progress,lateral:this.lateralOffset},this.laneDeparturePose=null,this.laneResetActive=!1,this.clearLaneResetTimers(),this.needsFirstFrameCameraSnap=!0,this.lastBrakePressed=!1,this.pendingBrakeTimestamp=null,this.fpsSamples=[],this.displayRefreshMs=1e3/60,this.displayRefreshHz=60,this.refreshSampleCount=0,this.refreshMeasured=!1,this.activeHazards=[],this.eventResults=[],this.lastResponseSteering=0,this.ambientTrafficActors=[],this.roadCollisionBoxes=[],this.buildingCollisionBoxes=[],this.keyState={left:!1,right:!1,up:!1,down:!1},this.miniMapCanvas=null,this.miniMapCtx=null,this.rearviewMirrorCanvases={},this.rearviewRenderTargets={},this.rearviewPixelBuffers={},this.rearviewImageData=new WeakMap,this.rearviewCamera=null,this.rearviewLookAt=null,this.rearviewLastUpdateTime=0,this.sideRearviewMirrorsEnabled=!0,this.rearviewQualityLevel="high",this.miniMapLastUpdateTime=0,this.miniMapLastDirectionText="",this.asphaltTexture=null,this.asphaltMaterials=new Map,this.signTextureCache=new Map,this.miniMapDirectionLabel=null,this.cockpitSteeringWheel=null,this.cockpitSpeedNeedle=null,this.cockpitSpeedText=null,this.gamepadConnected=ws(((d=navigator.getGamepads)==null?void 0:d.call(navigator))??[])!==null,this.controlMode=this.getControlMode(e==null?void 0:e.control_mode),this.wheelCalibration=jh(e==null?void 0:e.wheel_calibration),this.language=this.getLanguage(e==null?void 0:e.language),this.text=Ic[this.language],this.renderQuality=Pc(e==null?void 0:e.render_quality),this.configureInitialRearviewQuality();const o=(e==null?void 0:e.driving_difficulty)??"beginner";this.difficultyPreset=ri[o]??ri.beginner,this.intersections=[];let l=null;const c=()=>{l&&this.intersections.push(l),l=null};let h=0;for(let u=0;u<this.route.length;u++)if(h+=this.route[u].length,u<this.route.length-1){const f=this.getRouteTurn(this.route[u].dir,this.route[u+1].dir),g={distance:h,segmentIndex:u,instruction:this.getTurnInstruction(f),turnDir:f,entered:!1,announced:!1,trafficSignalState:"green",trafficSignalOffsetMs:u*2600,redLightChecked:!1};!l||g.distance-l.distance>=this.minIntersectionSpacing?(c(),l=g):!l.turnDir&&g.turnDir&&(l=g)}c()}attachKeyboardListeners(e){this.keydownListener=t=>{this.shouldPreventKeyDefault(t.code)&&t.preventDefault(),this.setKeyboardInput(t.code,!0,t.timeStamp),(t.code==="KeyC"||t.code==="KeyV")&&(t.preventDefault(),this.cycleCameraMode()),t.code==="Escape"&&this.finishTrial(e,"aborted")},this.keyupListener=t=>{this.setKeyboardInput(t.code,!1,t.timeStamp)},window.addEventListener("keydown",this.keydownListener),window.addEventListener("keyup",this.keyupListener)}initTouchControls(e){var u;if((u=this.touchControlsRoot)==null||u.remove(),this.touchControlsRoot=null,this.inputPauseOverlay=null,this.inputPausedAt=0,this.visibilityPausedAt=null,!this.isTouchControlEnabled())return;const t=document.createElement("div");t.className="driving-touch-controls",Object.assign(t.style,{position:"absolute",inset:"0",zIndex:"12",pointerEvents:"none",touchAction:"none",userSelect:"none",WebkitUserSelect:"none"});const n=document.createElement("div");n.dataset.drivingControlGroup="steering",Object.assign(n.style,{position:"absolute",left:"max(14px, env(safe-area-inset-left))",bottom:"max(14px, env(safe-area-inset-bottom))",width:"140px",height:"140px",pointerEvents:"auto"});const i=document.createElement("div");i.dataset.drivingControlGroup="pedals",Object.assign(i.style,{position:"absolute",right:"max(14px, env(safe-area-inset-right))",bottom:"max(14px, env(safe-area-inset-bottom))",display:"flex",gap:"8px",pointerEvents:"auto"});const r=Nc("CAM","Switch camera view");r.dataset.drivingControlGroup="camera",Object.assign(r.style,{position:"absolute",left:"50%",bottom:"max(14px, env(safe-area-inset-bottom))",minWidth:"64px",height:"44px",transform:"translateX(-50%)",pointerEvents:"auto",fontSize:"13px"}),r.addEventListener("click",f=>{f.preventDefault(),f.stopPropagation(),this.cycleCameraMode()});const a=document.createElement("div");a.dataset.drivingControlVisual="wheel",Object.assign(a.style,{position:"absolute",inset:"0",background:"var(--accent)",mask:`url(${new URL("data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'%20standalone='no'?%3e%3c!--%20Created%20with%20Inkscape%20(http://www.inkscape.org/)%20--%3e%3csvg%20xmlns:dc='http://purl.org/dc/elements/1.1/'%20xmlns:cc='http://creativecommons.org/ns%23'%20xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns%23'%20xmlns:svg='http://www.w3.org/2000/svg'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:sodipodi='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd'%20xmlns:inkscape='http://www.inkscape.org/namespaces/inkscape'%20width='372.04724'%20height='524.40942'%20id='svg2985'%20version='1.1'%20inkscape:version='0.48.5%20r10040'%20sodipodi:docname='steering_wheel-011.png'%3e%3cdefs%20id='defs2987'%20/%3e%3csodipodi:namedview%20id='base'%20pagecolor='%23ffffff'%20bordercolor='%23666666'%20borderopacity='1.0'%20inkscape:pageopacity='0.0'%20inkscape:pageshadow='2'%20inkscape:zoom='1.375'%20inkscape:cx='172.9985'%20inkscape:cy='235.63636'%20inkscape:current-layer='layer1'%20showgrid='true'%20inkscape:document-units='px'%20inkscape:grid-bbox='true'%20inkscape:window-width='1280'%20inkscape:window-height='962'%20inkscape:window-x='-8'%20inkscape:window-y='-8'%20inkscape:window-maximized='1'%3e%3cinkscape:grid%20type='xygrid'%20id='grid2993'%20empspacing='5'%20visible='true'%20enabled='true'%20snapvisiblegridlinesonly='true'%20/%3e%3c/sodipodi:namedview%3e%3cmetadata%20id='metadata2990'%3e%3crdf:RDF%3e%3ccc:Work%20rdf:about=''%3e%3cdc:format%3eimage/svg+xml%3c/dc:format%3e%3cdc:type%20rdf:resource='http://purl.org/dc/dcmitype/StillImage'%20/%3e%3cdc:title%3e%3c/dc:title%3e%3c/cc:Work%3e%3c/rdf:RDF%3e%3c/metadata%3e%3cg%20id='layer1'%20inkscape:label='Layer%201'%20inkscape:groupmode='layer'%20transform='translate(0,460.40947)'%3e%3cpath%20sodipodi:type='arc'%20style='fill:none;stroke:%23000000;stroke-width:4.02492237;stroke-linejoin:round;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none;stroke-dashoffset:0'%20id='path3009'%20sodipodi:cx='22.5'%20sodipodi:cy='26.5'%20sodipodi:rx='22.5'%20sodipodi:ry='22.5'%20d='m%2045,26.5%20a%2022.5,22.5%200%201%201%20-45,0%2022.5,22.5%200%201%201%2045,0%20z'%20transform='matrix(4.652648,0,0,-4.8888888,75.315421,-106.44449)'%20/%3e%3cpath%20style='fill:none;stroke:%23000000;stroke-width:17.52354813;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none'%20d='m%2081.858207,-236.00007%20196.283583,0%200,0%200,0'%20id='path3952'%20inkscape:connector-curvature='0'%20/%3e%3cpath%20sodipodi:type='arc'%20style='fill:%23ffffff;stroke:%23000000;stroke-width:4;stroke-linejoin:round;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none;stroke-dashoffset:0'%20id='path3954'%20sodipodi:cx='-25'%20sodipodi:cy='29'%20sodipodi:rx='5'%20sodipodi:ry='5'%20d='m%20-20,29%20a%205,5%200%201%201%20-10,0%205,5%200%201%201%2010,0%20z'%20transform='matrix(4.3618574,0,0,4.4,289.04644,-363.60007)'%20/%3e%3cpath%20style='fill:none;stroke:%23000000;stroke-width:17.52354813;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none'%20d='m%20180,-126.00007%200,-88'%20id='path3956'%20inkscape:connector-curvature='0'%20/%3e%3c/g%3e%3c/svg%3e",import.meta.url).href}) center / contain no-repeat`,WebkitMask:`url(${new URL("data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'%20standalone='no'?%3e%3c!--%20Created%20with%20Inkscape%20(http://www.inkscape.org/)%20--%3e%3csvg%20xmlns:dc='http://purl.org/dc/elements/1.1/'%20xmlns:cc='http://creativecommons.org/ns%23'%20xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns%23'%20xmlns:svg='http://www.w3.org/2000/svg'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:sodipodi='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd'%20xmlns:inkscape='http://www.inkscape.org/namespaces/inkscape'%20width='372.04724'%20height='524.40942'%20id='svg2985'%20version='1.1'%20inkscape:version='0.48.5%20r10040'%20sodipodi:docname='steering_wheel-011.png'%3e%3cdefs%20id='defs2987'%20/%3e%3csodipodi:namedview%20id='base'%20pagecolor='%23ffffff'%20bordercolor='%23666666'%20borderopacity='1.0'%20inkscape:pageopacity='0.0'%20inkscape:pageshadow='2'%20inkscape:zoom='1.375'%20inkscape:cx='172.9985'%20inkscape:cy='235.63636'%20inkscape:current-layer='layer1'%20showgrid='true'%20inkscape:document-units='px'%20inkscape:grid-bbox='true'%20inkscape:window-width='1280'%20inkscape:window-height='962'%20inkscape:window-x='-8'%20inkscape:window-y='-8'%20inkscape:window-maximized='1'%3e%3cinkscape:grid%20type='xygrid'%20id='grid2993'%20empspacing='5'%20visible='true'%20enabled='true'%20snapvisiblegridlinesonly='true'%20/%3e%3c/sodipodi:namedview%3e%3cmetadata%20id='metadata2990'%3e%3crdf:RDF%3e%3ccc:Work%20rdf:about=''%3e%3cdc:format%3eimage/svg+xml%3c/dc:format%3e%3cdc:type%20rdf:resource='http://purl.org/dc/dcmitype/StillImage'%20/%3e%3cdc:title%3e%3c/dc:title%3e%3c/cc:Work%3e%3c/rdf:RDF%3e%3c/metadata%3e%3cg%20id='layer1'%20inkscape:label='Layer%201'%20inkscape:groupmode='layer'%20transform='translate(0,460.40947)'%3e%3cpath%20sodipodi:type='arc'%20style='fill:none;stroke:%23000000;stroke-width:4.02492237;stroke-linejoin:round;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none;stroke-dashoffset:0'%20id='path3009'%20sodipodi:cx='22.5'%20sodipodi:cy='26.5'%20sodipodi:rx='22.5'%20sodipodi:ry='22.5'%20d='m%2045,26.5%20a%2022.5,22.5%200%201%201%20-45,0%2022.5,22.5%200%201%201%2045,0%20z'%20transform='matrix(4.652648,0,0,-4.8888888,75.315421,-106.44449)'%20/%3e%3cpath%20style='fill:none;stroke:%23000000;stroke-width:17.52354813;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none'%20d='m%2081.858207,-236.00007%20196.283583,0%200,0%200,0'%20id='path3952'%20inkscape:connector-curvature='0'%20/%3e%3cpath%20sodipodi:type='arc'%20style='fill:%23ffffff;stroke:%23000000;stroke-width:4;stroke-linejoin:round;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none;stroke-dashoffset:0'%20id='path3954'%20sodipodi:cx='-25'%20sodipodi:cy='29'%20sodipodi:rx='5'%20sodipodi:ry='5'%20d='m%20-20,29%20a%205,5%200%201%201%20-10,0%205,5%200%201%201%2010,0%20z'%20transform='matrix(4.3618574,0,0,4.4,289.04644,-363.60007)'%20/%3e%3cpath%20style='fill:none;stroke:%23000000;stroke-width:17.52354813;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none'%20d='m%20180,-126.00007%200,-88'%20id='path3956'%20inkscape:connector-curvature='0'%20/%3e%3c/g%3e%3c/svg%3e",import.meta.url).href}) center / contain no-repeat`,filter:"drop-shadow(0 4px 8px var(--bg-overlay))",pointerEvents:"none",transition:"transform 120ms ease-out"});const o=this.createDrivingPressButton("","Steer left",["left"]),l=this.createDrivingPressButton("","Steer right",["right"]),c=this.createDrivingPressButton("","Throttle",["up"]),h=this.createDrivingPressButton("","Brake",["down"]);for(const f of[o,l])Object.assign(f.style,{position:"absolute",top:"0",bottom:"0",minWidth:"0",width:"50%",height:"100%",padding:"0",border:"0",borderRadius:"50%",background:"transparent",boxShadow:"none"});o.style.left="0",l.style.right="0";const d=()=>{a.style.transform=`rotate(${this.keyState.left?-28:this.keyState.right?28:0}deg) scale(${this.keyState.left||this.keyState.right?.96:1})`};for(const f of[o,l])f.addEventListener("pointerdown",d),f.addEventListener("pointerup",d),f.addEventListener("pointercancel",d),f.addEventListener("lostpointercapture",d);Object.assign(c.style,{minWidth:"88px",width:"88px",height:"64px",padding:"9px 24px",borderRadius:"18px",background:"color-mix(in srgb, var(--success) 72%, transparent)",backgroundImage:`url(${new URL(""+new URL("car-pedals-BXQENW7T.svg",import.meta.url).href,import.meta.url).href})`,backgroundPosition:"25% 52%",backgroundRepeat:"no-repeat",backgroundSize:"650% auto",color:"var(--text-on-accent)",transformOrigin:"bottom",transition:"transform 90ms ease-out, filter 90ms ease-out"}),Object.assign(h.style,{minWidth:"88px",width:"88px",height:"64px",padding:"12px 10px",borderRadius:"18px",background:"color-mix(in srgb, var(--error) 76%, transparent)",backgroundImage:`url(${new URL(""+new URL("car-pedals-BXQENW7T.svg",import.meta.url).href,import.meta.url).href})`,backgroundPosition:"59% 54%",backgroundRepeat:"no-repeat",backgroundSize:"650% auto",color:"var(--text-on-accent)",transformOrigin:"bottom",transition:"transform 90ms ease-out, filter 90ms ease-out"});for(const[f,g]of[[h,"down"],[c,"up"]]){const x=()=>{const m=this.keyState[g];f.style.transform=m?"perspective(120px) rotateX(-14deg) translateY(7px)":"none"};f.addEventListener("pointerdown",x),f.addEventListener("pointerup",x),f.addEventListener("pointercancel",x),f.addEventListener("lostpointercapture",x)}n.append(a,o,l),i.append(h,c),t.append(n,i,r),e.appendChild(t),this.touchControlsRoot=t,this.syncTouchControlsLayout()}createDrivingPressButton(e,t,n){const i=Nc(e,t),r=o=>{for(const l of n)this.keyState[l]=o},a=o=>{o.preventDefault(),r(!1),this.captureSteeringInputTimestamp(o.timeStamp)};return i.addEventListener("pointerdown",o=>{o.preventDefault(),o.stopPropagation(),i.setPointerCapture(o.pointerId),n.includes("down")&&!this.keyState.down&&this.captureBrakeInputTimestamp(o.timeStamp),r(!0),this.captureSteeringInputTimestamp(o.timeStamp)}),i.addEventListener("pointerup",a),i.addEventListener("pointercancel",a),i.addEventListener("lostpointercapture",a),i.addEventListener("contextmenu",o=>o.preventDefault()),i}initInputPauseOverlay(e){var a;(a=this.inputPauseOverlay)==null||a.remove();const t=document.createElement("div");t.setAttribute("role","alert"),t.setAttribute("aria-live","assertive"),Object.assign(t.style,{position:"absolute",inset:"0",zIndex:"60",display:"none",placeItems:"center",padding:"24px",background:"var(--bg-overlay)",color:"var(--text-primary)",textAlign:"center",pointerEvents:"auto"});const n=document.createElement("div");Object.assign(n.style,{width:"min(520px, 100%)",padding:"22px",border:"1px solid var(--border-hover)",borderRadius:"var(--radius-l)",background:"var(--bg-card)"});const i=document.createElement("strong");i.textContent=this.text.inputPausedTitle,Object.assign(i.style,{display:"block",fontSize:"22px",lineHeight:"1.3"});const r=document.createElement("p");r.textContent=this.text.inputPausedDetail,Object.assign(r.style,{margin:"10px 0 0",fontSize:"15px",lineHeight:"1.55"}),n.append(i,r),t.append(n),e.appendChild(t),this.inputPauseOverlay=t}shouldPreventKeyDefault(e){return e==="Space"?!0:this.controlMode==="arrow"?["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e):this.controlMode==="wasd"?["KeyA","KeyD","KeyW","KeyS"].includes(e):!1}setKeyboardInput(e,t,n){if(this.controlMode==="arrow"){e==="ArrowLeft"&&(this.keyState.left=t),e==="ArrowRight"&&(this.keyState.right=t),e==="ArrowUp"&&(this.keyState.up=t),e==="ArrowDown"&&(t&&!this.keyState.down&&this.captureBrakeInputTimestamp(n),this.keyState.down=t),this.captureSteeringInputTimestamp(n);return}this.controlMode==="wasd"&&(e==="KeyA"&&(this.keyState.left=t),e==="KeyD"&&(this.keyState.right=t),e==="KeyW"&&(this.keyState.up=t),e==="KeyS"&&(t&&!this.keyState.down&&this.captureBrakeInputTimestamp(n),this.keyState.down=t),this.captureSteeringInputTimestamp(n))}attachGamepadListeners(){this.gamepadConnectedListener=e=>{var t;this.controlMode!=="wheel"||!Kh(e.gamepad)||(this.gamepadConnected=!0,(t=this.hud)!=null&&t.event&&(this.hud.event.textContent=this.format(this.text.controllerConnected,{id:e.gamepad.id})))},this.gamepadDisconnectedListener=()=>{var e,t;this.controlMode==="wheel"&&(this.gamepadConnected=ws(((e=navigator.getGamepads)==null?void 0:e.call(navigator))??[])!==null,(t=this.hud)!=null&&t.event&&!this.gamepadConnected&&(this.hud.event.textContent=this.text.controllerDisconnected))},window.addEventListener("gamepadconnected",this.gamepadConnectedListener),window.addEventListener("gamepaddisconnected",this.gamepadDisconnectedListener)}initScene(e){const t=this.requireThree();this.scene=new t.Scene,this.scene.background=new t.Color(14281457),this.scene.fog=new t.Fog(13359065,this.renderQuality.fogNear,this.renderQuality.fogFar);const n=Fh(e.clientWidth,e.clientHeight,window.devicePixelRatio||1,this.renderQuality.pixelRatioCap);this.camera=new t.PerspectiveCamera(this.baseCameraFov,n.aspect,.1,this.renderQuality.cameraFar),this.rearviewCamera=new t.PerspectiveCamera(66,3.2,.1,Math.min(this.renderQuality.cameraFar,360)),this.rearviewLookAt=new t.Vector3,this.renderer=new t.WebGLRenderer({antialias:this.renderQuality.antialias,alpha:!1,powerPreference:"high-performance"}),this.renderer.shadowMap.enabled=!1,this.renderer.outputColorSpace=t.SRGBColorSpace,this.renderer.domElement.style.width="100%",this.renderer.domElement.style.height="100%",this.renderer.domElement.style.display="block",e.appendChild(this.renderer.domElement),this.viewportController=new z_({renderer:this.renderer,camera:this.camera,root:e,pixelRatioCap:this.renderQuality.pixelRatioCap,onLayoutChange:()=>this.syncMobileHudLayout()}),this.viewportController.start(),this.createSceneEnvironment(),this.buildWorld(),this.createVehicleVisual(),this.createAmbientTraffic(),this.preloadHazardEvents(),this.renderQuality.useOsmCity&&this.loadTaipeiOsmCity()}isTouchLandscape(){return this.isTouchControlEnabled()?typeof window.matchMedia=="function"?window.matchMedia("(orientation: landscape)").matches:window.innerWidth>=window.innerHeight:!1}isTouchControlEnabled(){return this.controlMode==="touch"&&navigator.maxTouchPoints>0}syncTouchControlsLayout(){var x,m;const e=this.touchControlsRoot;if(!e)return;const t=e.clientWidth||((x=e.parentElement)==null?void 0:x.clientWidth)||window.innerWidth,n=e.clientHeight||((m=e.parentElement)==null?void 0:m.clientHeight)||window.innerHeight,i=t<420||n>t,r=t<240,a=e.querySelector('[data-driving-control-group="steering"]'),o=e.querySelector('[data-driving-control-group="pedals"]'),l=e.querySelector('[data-driving-control-group="camera"]'),c=(o==null?void 0:o.querySelectorAll("button"))??[],h=i?Math.max(92,Math.min(116,Math.floor(t*.3))):140,d=i?Math.max(54,Math.min(72,Math.floor(t*.21))):88,u=i?52:64,f=i?"max(8px, env(safe-area-inset-left))":"max(14px, env(safe-area-inset-left))",g=i?"max(8px, env(safe-area-inset-bottom))":"max(14px, env(safe-area-inset-bottom))";a&&(a.style.left=f,a.style.bottom=r?`calc(${g} + ${u+18}px)`:g,a.style.width=`${h}px`,a.style.height=`${h}px`),o&&(o.style.right=i?"max(8px, env(safe-area-inset-right))":"max(14px, env(safe-area-inset-right))",o.style.bottom=g,o.style.gap=i?"6px":"8px");for(const p of c)p.style.minWidth=`${d}px`,p.style.width=`${d}px`,p.style.height=`${u}px`,p.style.borderRadius=i?"15px":"18px",p.style.fontSize=i?"12px":p.getAttribute("aria-label")==="Throttle"?"15px":"13px";l&&(l.style.minWidth=i?"54px":"64px",l.style.height=i?"40px":"44px",l.style.bottom=i?`calc(${g} + ${r?u+h+26:u+18}px)`:g,l.style.fontSize=i?"11px":"13px")}syncMobileHudLayout(){this.syncTouchControlsLayout();const e=this.hud,t=e==null?void 0:e.miniMapWrapper;if(!t)return;const n=this.miniMapDirectionLabel,i=t.querySelector("[data-minimap-title]"),r=e==null?void 0:e.panel;if(this.isTouchLandscape()){Object.assign(t.style,{top:"max(12px, env(safe-area-inset-top))",left:"max(12px, env(safe-area-inset-left))",right:"auto",bottom:"auto",width:"148px",height:"126px",borderRadius:"12px",transform:"none"}),n&&Object.assign(n.style,{minHeight:"36px",padding:"6px 8px",fontSize:"12px",lineHeight:"1.15"}),i&&(i.style.display="none"),r&&Object.assign(r.style,{top:"max(12px, env(safe-area-inset-top))",left:"calc(max(12px, env(safe-area-inset-left)) + 160px)",minWidth:"0",width:"min(232px, calc(100vw - 190px))",maxWidth:"calc(100vw - 190px)",padding:"7px 9px",gap:"4px",fontSize:"11px",lineHeight:"1.25"});return}if(this.isTouchControlEnabled()){Object.assign(t.style,{top:"max(10px, env(safe-area-inset-top))",left:"max(10px, env(safe-area-inset-left))",right:"auto",bottom:"auto",width:"132px",height:"112px",borderRadius:"11px",transform:"none"}),n&&Object.assign(n.style,{minHeight:"34px",padding:"5px 7px",fontSize:"11px",lineHeight:"1.15"}),i&&(i.style.display="none"),r&&Object.assign(r.style,{top:"max(10px, env(safe-area-inset-top))",left:"calc(max(10px, env(safe-area-inset-left)) + 142px)",minWidth:"0",width:"calc(100vw - max(10px, env(safe-area-inset-left)) - 152px)",maxWidth:"none",padding:"6px 7px",gap:"3px",fontSize:"10px",lineHeight:"1.2"});return}Object.assign(t.style,{top:"auto",left:"auto",right:"18px",bottom:"28px",width:"236px",height:"278px",borderRadius:"16px",transform:"none"}),n&&Object.assign(n.style,{minHeight:"54px",padding:"10px 14px",fontSize:"15px",lineHeight:"1.25"}),i&&(i.style.display="flex"),r&&Object.assign(r.style,{top:"16px",left:"16px",minWidth:"220px",width:"auto",maxWidth:"min(420px, calc(100vw - 280px))",padding:"10px 12px",gap:"6px",fontSize:"13px",lineHeight:"1.3"})}createSceneEnvironment(){const e=this.requireThree();if(!this.scene)return;const t=this.getDifficultyFogRange();this.scene.fog=new e.Fog(13359065,t.near,t.far);const n=new e.AmbientLight(16777215,1.28),i=new e.DirectionalLight(16771010,1.55);i.position.set(38,62,26),i.castShadow=!1;const r=new e.HemisphereLight(12571871,5073744,.92);this.scene.add(n,i,r),this.addSkyDome()}getDifficultyFogRange(){return this.difficultyPreset===ri.advanced?{near:this.renderQuality.fogNear*.46,far:this.renderQuality.fogFar*.54}:this.difficultyPreset===ri.intermediate?{near:this.renderQuality.fogNear*.68,far:this.renderQuality.fogFar*.76}:{near:this.renderQuality.fogNear,far:this.renderQuality.fogFar}}addSkyDome(){const e=this.requireThree();if(!this.scene)return;const t=this.getRouteBounds(),n=new e.Mesh(new e.SphereGeometry(1200,32,16),new e.MeshBasicMaterial({map:this.createSkyTexture(),side:e.DoubleSide,depthWrite:!1,fog:!1}));n.name="driving-sky-dome",n.position.set((t.minX+t.maxX)/2,-120,(t.minZ+t.maxZ)/2),n.renderOrder=-1e3,this.scene.add(n)}createSkyTexture(){const e=this.requireThree(),t=document.createElement("canvas");t.width=512,t.height=256;const n=t.getContext("2d");if(n){const r=n.createLinearGradient(0,0,0,t.height);r.addColorStop(0,"#5f9ed0"),r.addColorStop(.42,"#a8d3e5"),r.addColorStop(.66,"#e4eef0"),r.addColorStop(1,"#f7dfbd"),n.fillStyle=r,n.fillRect(0,0,t.width,t.height);const a=n.createRadialGradient(384,74,2,384,74,92);a.addColorStop(0,"rgba(255,246,205,0.95)"),a.addColorStop(.22,"rgba(255,226,156,0.56)"),a.addColorStop(1,"rgba(255,226,156,0)"),n.fillStyle=a,n.fillRect(250,0,262,190),n.fillStyle="rgba(255,255,255,0.28)";for(const[o,l,c]of[[54,72,92],[154,48,68],[286,96,116],[418,122,82]])n.beginPath(),n.ellipse(o,l,c,12,0,0,Math.PI*2),n.ellipse(o+c*.38,l+4,c*.7,10,0,0,Math.PI*2),n.fill()}const i=new e.CanvasTexture(t);return i.colorSpace=e.SRGBColorSpace,i.needsUpdate=!0,i}initHud(e,t){const n=document.createElement("div");Object.assign(n.style,{position:"absolute",inset:"0",zIndex:"10",pointerEvents:"none"});const i=document.createElement("div"),r=document.createElement("div"),a=document.createElement("div"),o=document.createElement("div"),l=document.createElement("div"),c=document.createElement("div");i.textContent=this.text.taskDelivery,r.textContent=this.getRouteHudText(),a.textContent="0 km/h",o.textContent="0 m",l.textContent=this.getCameraModeText(),c.textContent=this.text.watchRoad;const h=document.createElement("div");Object.assign(h.style,{position:"absolute",top:"16px",left:"16px",display:"grid",gap:"6px",minWidth:"220px",maxWidth:"min(420px, calc(100vw - 280px))",padding:"10px 12px",borderRadius:"8px",background:"rgba(15, 23, 42, 0.72)",color:"#fff",fontSize:"13px",lineHeight:"1.3",boxShadow:"0 10px 26px rgba(0,0,0,0.22)",backdropFilter:"blur(4px)"}),Object.assign(i.style,{fontWeight:"800"}),Object.assign(r.style,{color:"rgba(191,219,254,0.95)",fontSize:"12px",fontWeight:"800",overflowWrap:"anywhere"}),Object.assign(c.style,{color:"rgba(226,232,240,0.92)"});const d=document.createElement("div");Object.assign(d.style,{display:"flex",gap:"10px",flexWrap:"wrap",color:"rgba(226,232,240,0.88)",fontSize:"12px",fontWeight:"700"}),d.append(a,o,l),h.append(i,r,d,c);const u=document.createElement("div");Object.assign(u.style,{position:"absolute",inset:"0",opacity:"0",transition:"opacity 90ms linear",boxShadow:t?"inset 0 0 0 22px rgba(255, 46, 46, 0.86), inset 0 0 80px rgba(255, 0, 0, 0.42)":"none"});const f=document.createElement("div");Object.assign(f.style,{position:"absolute",inset:"0",zIndex:"25",opacity:"0",pointerEvents:"none",background:"#000",transition:`opacity ${this.laneResetBlackoutMs}ms ease`}),this.sideRearviewMirrorsEnabled=!0;const g=this.createMiniMap(),x=this.createCockpitMask();n.append(u,x,h,g,f),e.appendChild(n),this.hud={status:i,route:r,speed:a,distance:o,view:l,event:c,redFlash:u,blackout:f,cockpit:x,panel:h,miniMapWrapper:g},this.updateCameraModeHud(),this.syncMobileHudLayout()}createMiniMap(){const e=document.createElement("div");Object.assign(e.style,{position:"absolute",bottom:"28px",right:"18px",width:"236px",height:"278px",borderRadius:"16px",overflow:"hidden",border:"1px solid rgba(15,23,42,0.18)",background:"#f8fafc",boxShadow:"0 14px 34px rgba(0,0,0,0.38), 0 1px 0 rgba(255,255,255,0.9) inset",zIndex:"15",display:"flex",flexDirection:"column"});const t=document.createElement("div");t.setAttribute("data-minimap-dir",""),Object.assign(t.style,{minHeight:"54px",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",background:"#1a73e8",fontSize:"15px",fontWeight:"800",lineHeight:"1.25",textAlign:"center",boxShadow:"0 1px 0 rgba(255,255,255,0.18) inset"}),t.textContent=`↑ ${this.text.straight}`;const n=document.createElement("div");n.setAttribute("data-minimap-title",""),Object.assign(n.style,{padding:"7px 12px",background:"#fff",borderBottom:"1px solid rgba(15,23,42,0.08)",display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",fontWeight:"700",color:"#334155"});const i=document.createElementNS("http://www.w3.org/2000/svg","svg");i.setAttribute("width","14"),i.setAttribute("height","14"),i.setAttribute("viewBox","0 0 24 24"),i.setAttribute("fill","none"),i.setAttribute("stroke","#1a73e8"),i.setAttribute("stroke-width","2.5"),i.setAttribute("stroke-linecap","round"),i.setAttribute("stroke-linejoin","round");const r=document.createElementNS("http://www.w3.org/2000/svg","polygon");r.setAttribute("points","3 11 22 2 13 21 11 13 3 11"),i.appendChild(r);const a=document.createElement("span");a.textContent=this.text.navigation,n.append(i,a);const o=document.createElement("canvas");return o.width=236,o.height=194,Object.assign(o.style,{width:"100%",minHeight:"0",flex:"1",display:"block"}),e.append(t,n,o),this.miniMapDirectionLabel=t,this.miniMapCanvas=o,this.miniMapCtx=o.getContext("2d"),e}updateMiniMap(){const e=this.miniMapCtx,t=this.miniMapCanvas;if(!e||!t)return;const n=performance.now();if(n-this.miniMapLastUpdateTime<this.getMiniMapUpdateIntervalMs())return;this.miniMapLastUpdateTime=n;const i=t.width,r=t.height,a=this.getVehicleCollisionBox(),o=this.getForwardVector(this.vehicleHeading),l=this.getRightVector(this.vehicleHeading),c=1.72,h=i/2,d=r*.76;e.clearRect(0,0,i,r),e.fillStyle="#eef3f1",e.fillRect(0,0,i,r);const u=(T,R)=>({sx:h+((T-a.centerX)*l.x+(R-a.centerZ)*l.z)*c,sy:d-((T-a.centerX)*o.x+(R-a.centerZ)*o.z)*c});e.lineCap="round",e.lineJoin="round";const f=(T,R,M,w)=>{const P=this.clamp(T,0,this.routeLength),C=this.clamp(R,0,this.routeLength);if(C<=P)return;e.strokeStyle=M,e.lineWidth=w,e.beginPath();const F=this.getDrivingLanePoint(P),G=u(F.x,F.z);e.moveTo(G.sx,G.sy),this.forEachMiniMapRouteSample(P,C,B=>{const V=u(B.x,B.z);e.lineTo(V.sx,V.sy)});const W=this.getDrivingLanePoint(C),N=u(W.x,W.z);e.lineTo(N.sx,N.sy),e.stroke()},g=Math.max(0,this.progress-18),x=Math.min(this.routeLength,this.progress+126);f(g,x,"rgba(148, 163, 184, 0.28)",28),f(g,x,"#ffffff",20),f(this.progress,x,"#1a73e8",12),f(this.progress,x,"#185abc",3);const m=this.intersections.find(T=>!T.entered&&this.progress<T.distance);if(m){const T=this.getDrivingLanePoint(m.distance),R=u(T.x,T.z);R.sx>-24&&R.sx<i+24&&R.sy>-24&&R.sy<r+24&&(e.fillStyle="#fff",e.strokeStyle="#1a73e8",e.lineWidth=3,e.beginPath(),e.arc(R.sx,R.sy,10,0,Math.PI*2),e.fill(),e.stroke(),e.fillStyle="#1a73e8",e.font=`bold 13px ${cs.fontFamily}`,e.textAlign="center",e.textBaseline="middle",e.fillText(this.getNavigationArrow(m.turnDir),R.sx,R.sy+.5))}const p=this.getDrivingLanePoint(this.routeLength-2),v=u(p.x,p.z);v.sx>-18&&v.sx<i+18&&v.sy>-18&&v.sy<r+18&&(e.fillStyle="#ef4444",e.beginPath(),e.arc(v.sx,v.sy,6,0,Math.PI*2),e.fill(),e.fillStyle="#fff",e.font=`bold 9px ${cs.fontFamily}`,e.textAlign="center",e.textBaseline="middle",e.fillText("B",v.sx,v.sy+.2));const S={sx:h,sy:d},b=.5+.5*Math.sin(n/300);e.strokeStyle=`rgba(26, 115, 232, ${.22+b*.16})`,e.lineWidth=2,e.beginPath(),e.arc(S.sx,S.sy,9+b*3,0,Math.PI*2),e.stroke(),e.fillStyle="#ffffff",e.beginPath(),e.arc(S.sx,S.sy,8,0,Math.PI*2),e.fill(),e.fillStyle="#1a73e8",e.beginPath(),e.arc(S.sx,S.sy,5,0,Math.PI*2),e.fill();const A=this.miniMapDirectionLabel;if(A){let T="";if(m){const R=Math.round(m.distance-this.progress);T=`${this.getNavigationArrow(m.turnDir)} ${this.format(this.text.turnAfterMeters,{dist:R,instruction:m.instruction})}`}else T=`↑ ${this.text.straightToDestination}`;T!==this.miniMapLastDirectionText&&(A.textContent=T,this.miniMapLastDirectionText=T)}}getMiniMapUpdateIntervalMs(){return this.renderQuality.level==="low"?66:this.renderQuality.level==="medium"?50:33}createMiniMapRouteSamples(){if(this.routeLength<=0)return[];const e=[],t=3;for(let r=0;r<=this.routeLength;r+=t){const a=this.getDrivingLanePoint(r);e.push({distance:r,x:a.x,z:a.z})}const n=this.getDrivingLanePoint(this.routeLength),i=e[e.length-1];return(!i||i.distance<this.routeLength)&&e.push({distance:this.routeLength,x:n.x,z:n.z}),e}forEachMiniMapRouteSample(e,t,n){for(const i of this.miniMapRouteSamples)if(!(i.distance<=e)){if(i.distance>=t)break;n(i)}}createCockpitMask(){const e=document.createElement("div");Object.assign(e.style,{position:"absolute",inset:"0",pointerEvents:"none",boxShadow:"inset 0 0 0 10px rgba(4, 12, 18, 0.68), inset 0 80px 90px rgba(4, 12, 18, 0.28)"});const t=document.createElement("div");Object.assign(t.style,{position:"absolute",left:"0",right:"0",bottom:"0",height:"24%",background:"linear-gradient(180deg, rgba(30,39,44,0.92), rgba(8,12,16,0.98))",borderTop:"3px solid rgba(255,255,255,0.10)",borderRadius:"50% 50% 0 0 / 16% 16% 0 0"});const n=document.createElement("div");Object.assign(n.style,{position:"absolute",left:"38%",bottom:"4%",width:"220px",height:"110px",transform:"translateX(-50%)",transformOrigin:"50% 100%",border:"18px solid rgba(9, 14, 18, 0.96)",borderBottom:"0",borderRadius:"140px 140px 0 0",boxShadow:"0 0 0 2px rgba(255,255,255,0.08), inset 0 8px 24px rgba(255,255,255,0.06)"});const i=document.createElement("div");Object.assign(i.style,{position:"absolute",left:"50%",bottom:"-8px",width:"18px",height:"74px",transform:"translateX(-50%)",borderRadius:"12px",background:"linear-gradient(180deg, rgba(28,34,40,0.96), rgba(8,12,16,0.96))",boxShadow:"0 0 0 1px rgba(255,255,255,0.08)"});const r=document.createElement("div");Object.assign(r.style,{position:"absolute",left:"50%",bottom:"-18px",width:"56px",height:"34px",transform:"translateX(-50%)",borderRadius:"999px",background:"linear-gradient(180deg, rgba(33,41,49,0.98), rgba(8,12,16,0.98))",boxShadow:"inset 0 6px 12px rgba(255,255,255,0.06)"}),n.append(i,r),this.cockpitSteeringWheel=n;const a=document.createElement("div");Object.assign(a.style,{position:"absolute",left:"30%",bottom:"8%",width:"148px",height:"58px",transform:"translateX(-50%)",borderRadius:"48px 48px 12px 12px",background:"linear-gradient(180deg, rgba(15,23,31,0.94), rgba(3,7,12,0.96))",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 8px 18px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.10)"});const o=document.createElement("div");Object.assign(o.style,{position:"absolute",left:"16px",top:"8px",width:"44px",height:"44px",borderRadius:"50%",border:"2px solid rgba(125,211,252,0.42)",background:"radial-gradient(circle at 50% 58%, rgba(14,23,34,0.9), rgba(2,6,10,0.96))"});const l=document.createElement("div");Object.assign(l.style,{position:"absolute",left:"20px",bottom:"20px",width:"2px",height:"18px",transformOrigin:"50% 100%",transform:"rotate(-115deg)",background:"#f87171",borderRadius:"2px",boxShadow:"0 0 8px rgba(248,113,113,0.75)"}),o.appendChild(l);const c=document.createElement("div");Object.assign(c.style,{position:"absolute",right:"16px",top:"12px",color:"#dff7ff",fontSize:"15px",fontWeight:"900",lineHeight:"1",textShadow:"0 0 10px rgba(56,189,248,0.45)"}),c.textContent="0";const h=document.createElement("div");Object.assign(h.style,{position:"absolute",right:"16px",top:"31px",color:"rgba(223,247,255,0.72)",fontSize:"9px",fontWeight:"800",lineHeight:"1"}),h.textContent="km/h",a.append(o,c,h),t.appendChild(a),this.cockpitSpeedNeedle=l,this.cockpitSpeedText=c;const d=document.createElement("div");Object.assign(d.style,{position:"absolute",left:"50%",bottom:"19%",width:"44%",height:"10%",transform:"translateX(-50%)",borderRadius:"50% 50% 0 0 / 70% 70% 0 0",background:"linear-gradient(180deg, rgba(59,130,246,0.72), rgba(18,31,46,0.92))",boxShadow:"inset 0 14px 28px rgba(255,255,255,0.10), 0 -8px 30px rgba(15,23,42,0.16)"});const u=document.createElement("div");Object.assign(u.style,{position:"absolute",left:"0",top:"0",width:"9%",height:"100%",background:"linear-gradient(90deg, rgba(5,10,14,0.88), rgba(5,10,14,0.10))",clipPath:"polygon(0 0, 100% 0, 42% 100%, 0 100%)"});const f=document.createElement("div");Object.assign(f.style,{position:"absolute",right:"0",top:"0",width:"9%",height:"100%",background:"linear-gradient(270deg, rgba(5,10,14,0.88), rgba(5,10,14,0.10))",clipPath:"polygon(0 0, 100% 0, 100% 100%, 58% 100%)"});const g=this.createRearviewMirror("center");return e.append(d,t,n,u,f,g),this.sideRearviewMirrorsEnabled&&e.append(this.createRearviewMirror("left"),this.createRearviewMirror("right")),e}createRearviewMirror(e){const t=document.createElement("div"),n=e==="center",i=e==="left";t.dataset.rearviewWrapper=e,Object.assign(t.style,{position:"absolute",overflow:"hidden",background:"linear-gradient(145deg, rgba(5, 10, 14, 0.98), rgba(18, 27, 34, 0.98))",border:n?"5px solid rgba(7, 11, 15, 0.98)":"4px solid rgba(7, 11, 15, 0.96)",borderRadius:n?"10px":"18px 22px 20px 18px / 16px 18px 22px 20px",boxShadow:"0 10px 22px rgba(0,0,0,0.36), inset 0 0 0 1px rgba(255,255,255,0.10)"}),n?Object.assign(t.style,{left:"50%",top:"112px",width:"210px",height:"52px",transform:"translateX(-50%)"}):(Object.assign(t.style,{top:"44%",width:"128px",height:"72px",transform:i?"skewY(-5deg) rotate(-2deg)":"skewY(5deg) rotate(2deg)"}),i?t.style.left="18px":t.style.right="18px");const r=document.createElement("div");Object.assign(r.style,{position:"absolute",inset:n?"4px 6px":"5px",overflow:"hidden",borderRadius:n?"6px":"14px 18px 16px 14px / 12px 14px 18px 16px",background:"#071118",boxShadow:"inset 0 0 18px rgba(0,0,0,0.44)"});const a=document.createElement("canvas"),o=this.getRearviewCanvasSize(e);a.width=o.width,a.height=o.height,a.dataset.rearviewMirror=e,Object.assign(a.style,{position:"absolute",inset:"0",width:"100%",height:"100%",display:"block",background:"#071118",transform:"scaleX(-1)"}),this.rearviewMirrorCanvases[e]=a;const l=document.createElement("div");Object.assign(l.style,{position:"absolute",inset:"0",background:"linear-gradient(120deg, rgba(255,255,255,0.18), rgba(255,255,255,0.02) 30%, rgba(255,255,255,0) 54%)"});const c=document.createElement("div");return Object.assign(c.style,{position:"absolute",inset:"0",boxShadow:"inset 0 0 18px rgba(0,0,0,0.62)"}),r.append(a,l,c),t.appendChild(r),t}updateRearviewMirrors(e){var g;if(!this.renderer||!this.scene||!this.rearviewCamera||this.cameraMode!=="first-person"||e-this.rearviewLastUpdateTime<this.getRearviewUpdateIntervalMs())return;this.rearviewLastUpdateTime=e;const t=this.rearviewMirrorCanvases.center,n=this.sideRearviewMirrorsEnabled?this.rearviewMirrorCanvases.left:null,i=this.sideRearviewMirrorsEnabled?this.rearviewMirrorCanvases.right:null,r=!!(t!=null&&t.isConnected),a=!!(n!=null&&n.isConnected),o=!!(i!=null&&i.isConnected);if(!r&&!a&&!o)return;const l=this.getVehicleCollisionBox(),c=this.getForwardVector(this.vehicleHeading),h=this.getRightVector(this.vehicleHeading),d=this.requireThree(),u=V_(this.renderer,()=>new d.Vector4),f=(g=this.vehicleRoot)==null?void 0:g.visible;this.vehicleRoot&&(this.vehicleRoot.visible=!1);try{r&&t&&this.renderRearviewMirror("center",t,l,c,h),a&&n&&this.renderRearviewMirror("left",n,l,c,h),o&&i&&this.renderRearviewMirror("right",i,l,c,h)}finally{H_(this.renderer,u),this.vehicleRoot&&f!==void 0&&(this.vehicleRoot.visible=f)}}renderRearviewMirror(e,t,n,i,r){if(!this.renderer||!this.scene||!this.rearviewCamera)return;const a=this.requireThree(),o=Math.max(1,t.width),l=Math.max(1,t.height),c=this.getRearviewRenderTarget(e,o,l),h=e==="center"?0:e==="left"?-1:1,d=e==="center"?0:h*1.45,u=e==="center"?0:h*32,f=e==="center"?1.2:.45,g=e==="center"?2.22:1.84,x=e==="center"?115:82;this.rearviewCamera.fov=e==="center"?52:66,this.rearviewCamera.aspect=o/l,this.rearviewCamera.updateProjectionMatrix(),this.rearviewCamera.position.set(n.centerX-i.x*f+r.x*d,g,n.centerZ-i.z*f+r.z*d);const m=this.rearviewLookAt??new a.Vector3;this.rearviewLookAt=m,m.set(n.centerX-i.x*x+r.x*u,1.28,n.centerZ-i.z*x+r.z*u),this.rearviewCamera.lookAt(m),this.renderer.setRenderTarget(c),this.renderer.clear(!0,!0,!0),this.renderer.render(this.scene,this.rearviewCamera);const p=this.getRearviewPixelBuffer(e,o,l);this.renderer.readRenderTargetPixels(c,0,0,o,l,p),this.copyRearviewPixelsToCanvas(p,t)}getRearviewUpdateIntervalMs(){return 1e3/30}getRearviewCanvasSize(e){const t=e==="center",n=t?320:192,i=t?82:108,r=this.rearviewQualityLevel==="high"?1:this.rearviewQualityLevel==="medium"?.72:.5;return{width:Math.max(1,Math.round(n*r)),height:Math.max(1,Math.round(i*r))}}getRearviewRenderTarget(e,t,n){var o;const i=this.rearviewRenderTargets[e];if((i==null?void 0:i.width)===t&&(i==null?void 0:i.height)===n)return i;(o=i==null?void 0:i.dispose)==null||o.call(i);const r=this.requireThree(),a=new r.WebGLRenderTarget(t,n,{depthBuffer:!0,stencilBuffer:!1});return a.texture.colorSpace=r.SRGBColorSpace,this.rearviewRenderTargets[e]=a,this.rearviewPixelBuffers[e]=new Uint8Array(t*n*4),a}getRearviewPixelBuffer(e,t,n){const i=this.rearviewPixelBuffers[e];if(i&&i.length===t*n*4)return i;const r=new Uint8Array(t*n*4);return this.rearviewPixelBuffers[e]=r,r}copyRearviewPixelsToCanvas(e,t){const n=t.getContext("2d");if(!n)return;const{width:i,height:r}=t;let a=this.rearviewImageData.get(t);(!a||a.width!==i||a.height!==r)&&(a=n.createImageData(i,r),this.rearviewImageData.set(t,a));const o=i*4;for(let l=0;l<r;l+=1){const c=(r-l-1)*o,h=l*o;a.data.set(e.subarray(c,c+o),h)}n.putImageData(a,0,0)}buildWorld(){const e=this.requireThree();if(!this.scene)return;this.roadCollisionBoxes=[],this.buildingCollisionBoxes=[];const t=new e.MeshStandardMaterial({color:2830389,roughness:.9,metalness:.08}),n=new e.MeshStandardMaterial({color:16436245,roughness:.76,metalness:.05}),i=new e.MeshStandardMaterial({color:16317180,roughness:.72,metalness:.03}),r=new e.MeshStandardMaterial({color:16777215,roughness:.68,metalness:.04}),a=new e.MeshStandardMaterial({color:16777215,roughness:.7,metalness:.08,emissive:11145489,emissiveIntensity:.24}),o=new e.MeshStandardMaterial({color:5213525,roughness:.86,metalness:.02,dithering:!0}),l=this.getRouteBounds(),c=Math.max(1800,l.maxX-l.minX+720,l.maxZ-l.minZ+720),h=new e.Mesh(new e.PlaneGeometry(c,c,64,64),o);h.rotation.x=-Math.PI/2,h.position.set((l.minX+l.maxX)/2,-.52,(l.minZ+l.maxZ)/2),h.receiveShadow=!1,this.scene.add(h);let d=0;for(const u of this.route){const f={x:u.start.x+u.dir.x*u.length/2,z:u.start.z+u.dir.z*u.length/2},g=this.getHeadingFromDirection(u.dir),x=this.getSceneYawFromHeading(g),m=this.getRouteRightVector(u.dir),p=this.getSegmentRoadWidth(u),v=new e.Mesh(new e.BoxGeometry(p+.44,.08,u.length),t);v.position.set(f.x,-.03,f.z),v.rotation.y=x,v.receiveShadow=!1,this.scene.add(v);const S=new e.Mesh(new e.BoxGeometry(p,.045,u.length),this.createAsphaltRoadMaterial(u.length));S.position.set(f.x,.015,f.z),S.rotation.y=x,S.receiveShadow=!1,this.scene.add(S),this.roadCollisionBoxes.push({centerX:f.x,centerZ:f.z,angle:g,halfWidth:p/2,halfLength:u.length/2}),this.addRoadEdgeMarkings(u,d,x,m,a),this.addLaneMarkings(u,d,x,m,n,i),d+=u.length}this.addLeftDriveStopLines(r),this.addTrafficLights();for(const u of this.intersections){const f=this.getRoutePoint(u.distance),g=this.getSegmentRoadWidth(this.route[u.segmentIndex]),x=this.getSegmentRoadWidth(this.route[u.segmentIndex+1]??this.route[u.segmentIndex]),m=Math.max(g,x)+18,p=new e.Mesh(new e.BoxGeometry(g+18,.04,m),this.createAsphaltRoadMaterial(m));p.position.set(f.x,.025,f.z);const v=this.getHeadingFromDirection(f.normal),S=this.getSceneYawFromHeading(v);p.rotation.y=S,p.receiveShadow=!1,this.scene.add(p),this.roadCollisionBoxes.push({centerX:f.x,centerZ:f.z,angle:v,halfWidth:(g+18)/2,halfLength:m/2})}this.addBuildings(),this.addTaiwanStreetDetails(),this.addTurnSignage(),this.addDestinationMarker()}addLeftDriveStopLines(e){const t=this.requireThree();if(this.scene)for(const n of this.intersections){const i=this.route[n.segmentIndex];if(!i)continue;const r=Math.max(1,i.length-this.stopLineSetback),a=this.getRouteRightVector(i.dir),o=this.getSceneYawForDirection(i.dir),l=this.getSegmentRoadWidth(i),c=this.getDrivingLaneOffset(n.distance-this.stopLineSetback),h=Math.max(3,l/2-1.6),d=new t.Mesh(new t.BoxGeometry(h,.052,.72),e);d.position.set(i.start.x+i.dir.x*r+a.x*c,.085,i.start.z+i.dir.z*r+a.z*c),d.rotation.y=o,this.scene.add(d)}}addTrafficLights(){var a;const e=this.requireThree();if(!this.scene)return;const t=new e.MeshStandardMaterial({color:2699834,roughness:.58,metalness:.35}),n=new e.MeshStandardMaterial({color:1120295,roughness:.62,metalness:.18}),i=new e.MeshStandardMaterial({color:726816,roughness:.62,metalness:.14}),r=new e.MeshBasicMaterial({color:2221679});for(const o of this.intersections){const l=this.route[o.segmentIndex];if(!l)continue;const c=this.getRouteRightVector(l.dir),h=this.getSceneYawForDirection(l.dir),d=Math.max(2,l.length-this.stopLineSetback-2.4),u=this.getSegmentRoadWidth(l),f=l.start.x+l.dir.x*d+c.x*(u/2+1.2),g=l.start.z+l.dir.z*d+c.z*(u/2+1.2),x=new e.Group,m=new e.Mesh(new e.CylinderGeometry(.12,.16,4.4,10),t);m.position.y=2.2;const p=new e.Mesh(new e.BoxGeometry(.78,2.25,.36),n);p.position.set(0,4.35,0);const v=new e.Mesh(new e.SphereGeometry(.28,16,10),new e.MeshBasicMaterial({color:4527124})),S=new e.Mesh(new e.SphereGeometry(.28,16,10),new e.MeshBasicMaterial({color:4864534})),b=new e.Mesh(new e.SphereGeometry(.28,16,10),new e.MeshBasicMaterial({color:1195300}));v.position.set(0,4.9,.2),S.position.set(0,4.35,.2),b.position.set(0,3.8,.2);const A=new e.Mesh(new e.BoxGeometry(.68,.58,.18),i);A.position.set(0,2.62,.18);const T=new e.Mesh(new e.SphereGeometry(.07,10,8),r);T.position.set(0,2.72,.29);const R=new e.Mesh(new e.BoxGeometry(.08,.16,.03),r);R.position.set(0,2.56,.29);const M=new e.Mesh(new e.BoxGeometry(.2,.04,.03),r);M.position.set(.02,2.43,.29),M.rotation.z=-.35,x.add(m,p,v,S,b,A,T,R,M),x.position.set(f,0,g),x.rotation.y=h,(a=x.traverse)==null||a.call(x,w=>{w.castShadow=!1,w.receiveShadow=!1}),this.scene.add(x),o.trafficLightGroup=x,o.trafficLightLamps={red:v,yellow:S,green:b}}}addTaiwanStreetDetails(){var f;const e=this.requireThree();if(!this.scene)return;const t=new e.MeshStandardMaterial({color:1018711,roughness:.72,metalness:.04}),n=new e.MeshStandardMaterial({color:16777215,roughness:.62,metalness:.02}),i=new e.MeshStandardMaterial({color:2565930,roughness:.74,metalness:.08}),r=new e.MeshStandardMaterial({color:16436245,roughness:.65,metalness:.04}),a=new e.MeshStandardMaterial({color:10134441,roughness:.76,metalness:.12}),o=new e.MeshStandardMaterial({color:14275784,roughness:.82,metalness:.02}),l=new e.MeshStandardMaterial({color:12170151,roughness:.86,metalness:.02});for(const g of this.intersections){const x=this.route[g.segmentIndex];if(!x)continue;const m=this.getRouteRightVector(x.dir),p=this.getSceneYawForDirection(x.dir),v=Math.max(2,x.length-this.stopLineSetback-6.2),S=this.getSegmentRoadWidth(x),b=this.getDrivingLaneOffset(g.distance-this.stopLineSetback),A={x:x.start.x+x.dir.x*v+m.x*b,z:x.start.z+x.dir.z*v+m.z*b},T=new e.Mesh(new e.BoxGeometry(Math.max(3.4,S/2-1.4),.036,4.8),t);T.position.set(A.x,.105,A.z),T.rotation.y=p,this.scene.add(T);for(const R of[-1,1]){const M=new e.Mesh(new e.BoxGeometry(.14,.048,4.8),n);M.position.set(A.x+m.x*R*(S/4-.35),.13,A.z+m.z*R*(S/4-.35)),M.rotation.y=p,this.scene.add(M)}}const c=this.renderQuality.level==="low"?44:22,h=this.renderQuality.level==="low"?72:this.renderQuality.level==="medium"?48:36,d=[],u=[];for(let g=18;g<this.routeLength-12;g+=c){if(this.isNearIntersection(g,14))continue;const x=this.getRoutePoint(g),m=this.getSceneYawForDirection(x.dir),p=x.roadWidth;for(const v of[-1,1]){if((Math.floor(g/22)+v)%2===0){const S=new e.Group,b=new e.Mesh(new e.CylinderGeometry(.13,.16,5.2,10),i);b.position.y=2.6,S.add(b);for(let T=0;T<4;T+=1){const R=new e.Mesh(new e.BoxGeometry(.34,.18,.04),r);R.position.set(0,.75+T*.32,-.16),R.rotation.z=T%2?-.25:.25,S.add(R)}const A=new e.Mesh(new e.BoxGeometry(2.4,.08,.08),i);A.position.set(v*.95,4.85,0),S.add(A),S.position.set(x.x+x.normal.x*v*(p/2+2),0,x.z+x.normal.z*v*(p/2+2)),S.rotation.y=m,this.scene.add(S)}if((Math.floor(g/22)+v)%3===0&&d.push({x:x.x+x.normal.x*v*(p/2+1.4),y:.9,z:x.z+x.normal.z*v*(p/2+1.4),yaw:m}),(Math.floor(g/22)+v)%2!==0){const S={x:x.x+x.normal.x*v*(p/2+.65),z:x.z+x.normal.z*v*(p/2+.65)};if(u.push({x:S.x,y:.11,z:S.z,yaw:m}),this.renderQuality.level!=="low"&&g%44===18){const b=this.createScooterMesh(2450411);b.position.set(S.x,.12,S.z),b.rotation.y=m+Math.PI*.5*v,b.scale.setScalar(.86),this.scene.add(b)}}}}this.addBoxInstances(1.2,1.8,.72,a,d),this.addBoxInstances(2,.035,4,n,u);for(let g=28;g<this.routeLength-25;g+=h){if(this.isNearIntersection(g,18))continue;const x=this.getRoutePoint(g),m=this.getSceneYawForDirection(x.dir),p=x.roadWidth;for(const v of[-1,1]){const S=new e.Group,b=new e.Mesh(new e.BoxGeometry(12,.28,3.2),o);b.position.y=3.05,S.add(b);for(const A of[-4.8,-2.4,0,2.4,4.8]){const T=new e.Mesh(new e.BoxGeometry(.22,3,.22),l);T.position.set(A,1.5,1.18),S.add(T)}S.position.set(x.x+x.normal.x*v*(p/2+5.2),0,x.z+x.normal.z*v*(p/2+5.2)),S.rotation.y=m+(v>0?0:Math.PI),(f=S.traverse)==null||f.call(S,A=>{A.castShadow=!1,A.receiveShadow=!1}),this.scene.add(S)}}}addRoadEdgeMarkings(e,t,n,i,r){if(!this.scene)return;const a=10,o=this.getSegmentRoadWidth(e),l=[];for(let c=a/2;c<e.length;c+=a+1.5){if(this.isNearIntersection(t+c,this.roadMarkingIntersectionClearance))continue;const h={x:e.start.x+e.dir.x*c,z:e.start.z+e.dir.z*c};for(const d of[-1,1])l.push({x:h.x+i.x*d*(o/2-.1),y:.06,z:h.z+i.z*d*(o/2-.1),yaw:n})}this.addBoxInstances(.18,.055,a,r,l)}addLaneMarkings(e,t,n,i,r,a){if(!this.scene)return;const o=this.getSegmentLaneCount(e);if(o<=1)return;const l=this.getSegmentLaneWidth(e),c=this.getLaneDividerOffsets(e),h=[],d=[],u=[],f=(m,p,v,S=.062)=>{const b={x:e.start.x+e.dir.x*p,z:e.start.z+e.dir.z*p};m.push({x:b.x+i.x*v,y:S,z:b.z+i.z*v,yaw:n})},g=(m,p,v,S)=>{f(S,m,p-v),f(S,m,p+v)},x=6.5;for(let m=5;m<e.length-3;m+=x)if(!this.isNearIntersection(t+m,this.roadMarkingIntersectionClearance))for(const p of c){if(!e.oneWay&&Math.abs(p)<l*.35){if(o<=2){Math.floor(m/13)%2===0&&f(h,m,p);continue}g(m,p,.18,d);continue}Math.floor(m/13)%2===0&&f(u,m,p,.06)}this.addBoxInstances(.14,.054,5.8,r,h),this.addBoxInstances(.13,.054,x+.25,r,d),this.addBoxInstances(.12,.054,5.6,a,u)}addBoxInstances(e,t,n,i,r){if(!this.scene||r.length===0)return;const a=this.requireThree(),o=new a.BoxGeometry(e,t,n),l=new a.InstancedMesh(o,i,r.length),c=new a.Object3D;r.forEach((h,d)=>{c.position.set(h.x,h.y,h.z),c.rotation.set(0,h.yaw,0),c.updateMatrix(),l.setMatrixAt(d,c.matrix)}),l.instanceMatrix.needsUpdate=!0,l.castShadow=!1,l.receiveShadow=!1,this.scene.add(l)}createAsphaltRoadMaterial(e){const t=this.requireThree(),n=Math.max(1,Math.round(e/20)),i=this.asphaltMaterials.get(n);if(i)return i;const r=this.createLowResolutionRoadTexture(n),a=new t.MeshStandardMaterial({map:r,color:6842472,roughness:.92,metalness:.02});return this.asphaltMaterials.set(n,a),a}createLowResolutionRoadTexture(e){const t=this.requireThree();if(this.asphaltTexture){const a=this.asphaltTexture.clone();return a.repeat.set(1.15,e),a.needsUpdate=!0,a}const n=document.createElement("canvas");n.width=this.renderQuality.roadTextureSize,n.height=this.renderQuality.roadTextureSize;const i=n.getContext("2d");if(i){i.fillStyle="#5b5e5f",i.fillRect(0,0,n.width,n.height);for(let a=0;a<this.renderQuality.roadNoiseSamples;a+=1){const o=58+Math.floor(Math.random()*52);i.fillStyle=`rgba(${o}, ${o}, ${o}, ${.08+Math.random()*.12})`;const l=Math.random()*n.width,c=Math.random()*n.height;i.fillRect(l,c,1+Math.random()*2,1+Math.random()*2)}i.strokeStyle="rgba(255,255,255,0.035)",i.lineWidth=1;for(let a=0;a<n.height;a+=42)i.beginPath(),i.moveTo(0,a+Math.random()*8),i.lineTo(n.width,a+Math.random()*8),i.stroke()}const r=new t.CanvasTexture(n);return r.wrapS=t.RepeatWrapping,r.wrapT=t.RepeatWrapping,r.repeat.set(1.15,e),r.colorSpace=t.SRGBColorSpace,r.needsUpdate=!0,this.asphaltTexture=r,r}addBuildings(){if(!this.scene)return;const e=[12175315,14074534,11124652,13280420,11118536,13095622],t=[1013358,1920728,14427686,9647082,16096779],n=this.renderQuality.level==="low"?34:20;for(let i=15;i<this.routeLength-10;i+=n){const r=this.getRoutePoint(i);for(const a of[-1,1]){const o=7+i*(a+3)%17,l=7+i%6,c=7.5+(i+3)%6;if(this.isNearIntersection(i,this.buildingIntersectionClearance+c/2))continue;const h=this.getSceneYawForDirection(r.dir)+a*Math.PI/2,d=this.getHeadingFromSceneYaw(h),u=r.roadWidth/2+this.sidewalkWidth+this.buildingRoadGap+c/2+i%8,f=r.x+r.normal.x*a*u,g=r.z+r.normal.z*a*u,x={centerX:f,centerZ:g,angle:d,halfWidth:l/2,halfLength:c/2};if(!this.isBuildingFootprintClear(x))continue;const m=e[Math.floor((i+a*7)%e.length)],p=t[Math.floor((i*3+a*11)%t.length)],v=this.createUrbanBuilding(l,o,c,m,p,i+a*19);v.position.set(f,0,g),v.rotation.y=h,this.scene.add(v),this.buildingCollisionBoxes.push(x)}}}createUrbanBuilding(e,t,n,i,r,a){var m;const o=this.requireThree(),l=new o.Group,c=new o.MeshStandardMaterial({color:i,roughness:.82,metalness:.03}),h=new o.MeshStandardMaterial({color:4937059,roughness:.78,metalness:.08}),d=new o.MeshBasicMaterial({color:13101055,transparent:!0,opacity:.62}),u=new o.MeshBasicMaterial({color:r}),f=new o.MeshStandardMaterial({color:14870768,roughness:.7,metalness:.02}),g=new o.Mesh(new o.BoxGeometry(e,t,n),c);g.position.y=t/2,l.add(g);const x=new o.Mesh(new o.BoxGeometry(e+.35,.32,n+.35),h);if(x.position.y=t+.16,l.add(x),this.renderQuality.level!=="low"){const p=n/2+.035,v=this.clamp(Math.floor((t-3)/2.2),2,8),S=this.clamp(Math.floor(e/1.55),3,7),b=-((S-1)*1.18)/2;for(let R=0;R<v;R+=1)for(let M=0;M<S;M+=1){if((R+M+Math.floor(a))%5===0)continue;const w=new o.Mesh(new o.BoxGeometry(.62,.72,.045),d);w.position.set(b+M*1.18,3.25+R*2,p),l.add(w)}const A=new o.Mesh(new o.BoxGeometry(e*.72,.62,.055),u);A.position.set(0,2.25,p+.02),l.add(A);const T=new o.Mesh(new o.BoxGeometry(e*.82,.18,1.05),f);if(T.position.set(0,2.95,p+.42),l.add(T),t>13){const R=new o.MeshBasicMaterial({color:2503224});for(let M=0;M<Math.min(4,v-1);M+=1){const w=new o.Mesh(new o.BoxGeometry(e*.62,.08,.12),R);w.position.set(0,4.05+M*2,p+.22),l.add(w)}}}return(m=l.traverse)==null||m.call(l,p=>{p.castShadow=!1,p.receiveShadow=!1}),l}isNearIntersection(e,t){return this.intersections.some(n=>Math.abs(e-n.distance)<t)}isBuildingFootprintClear(e){return!this.roadCollisionBoxes.some(t=>this.boxesOverlap(e,this.expandCollisionBox(t,this.buildingRoadMargin)))}expandCollisionBox(e,t){return{...e,halfWidth:e.halfWidth+t,halfLength:e.halfLength+t}}addTurnSignage(){const e=this.requireThree();if(this.scene)for(const t of this.intersections){if(!t.turnDir)continue;const n=Math.max(5,t.distance-20),i=this.getRoutePoint(n),r=new e.Group,a=new e.MeshBasicMaterial({color:8947848}),o=new e.Mesh(new e.BoxGeometry(.2,4,.2),a);o.position.y=2,r.add(o);const l=new e.MeshBasicMaterial({color:2450411}),c=new e.Mesh(new e.BoxGeometry(2.8,1.8,.12),l);c.position.y=4.2,r.add(c);const h=this.getNavigationArrow(t.turnDir),d=this.createSignTexture(h),u=new e.MeshBasicMaterial({map:d,transparent:!0,depthWrite:!1}),f=new e.Mesh(new e.PlaneGeometry(2.2,1.4),u);f.position.set(0,4.2,.07),r.add(f),r.position.set(i.x+i.normal.x*(i.roadWidth/2+1),0,i.z+i.normal.z*(i.roadWidth/2+1)),r.rotation.y=this.getSceneYawForDirection(i.dir),this.scene.add(r)}}createSignTexture(e){const t=this.signTextureCache.get(e);if(t)return t;const n=this.requireThree(),i=document.createElement("canvas");i.width=256,i.height=128;const r=i.getContext("2d");r&&(r.clearRect(0,0,256,128),r.fillStyle="#ffffff",r.font=`bold 92px ${cs.fontFamily}`,r.textAlign="center",r.textBaseline="middle",r.fillText(e,128,64));const a=new n.CanvasTexture(i);return a.needsUpdate=!0,this.signTextureCache.set(e,a),a}addDestinationMarker(){const e=this.requireThree();if(!this.scene)return;const t=this.getRoutePoint(this.routeLength-5),n=new e.Group,i=new e.MeshBasicMaterial({color:16777215}),r=new e.MeshBasicMaterial({color:3718648}),a=new e.Mesh(new e.BoxGeometry(.35,5,.35),i);a.position.y=2.5;const o=new e.Mesh(new e.BoxGeometry(4,2.2,.18),r);o.position.set(2,4.2,0),n.add(a,o),n.position.set(t.x+t.normal.x*(t.roadWidth/2+4),0,t.z+t.normal.z*(t.roadWidth/2+4)),this.scene.add(n)}async loadTaipeiOsmCity(){if(this.renderQuality.useOsmCity&&!(!this.scene||typeof fetch>"u"))try{const e=await fetch(this.taipeiOsmUrl);if(!e.ok)return;const t=await e.json();if(!t||!Array.isArray(t.elements))return;this.addTaipeiOsmCity(t.elements)}catch(e){console.warn("Unable to load Taipei OSM city data.",e)}}addTaipeiOsmCity(e){const t=this.requireThree();if(!this.scene)return;const n=new Map;for(const x of e)(x==null?void 0:x.type)==="node"&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&n.set(x.id,{lat:x.lat,lon:x.lon});const i=new t.Group;i.name="taipei-xinyi-osm-city";const r=new t.MeshStandardMaterial({color:4937059,roughness:.88,metalness:.03}),a=[new t.MeshStandardMaterial({color:12502991,roughness:.82,metalness:.02}),new t.MeshStandardMaterial({color:13156017,roughness:.84,metalness:.02}),new t.MeshStandardMaterial({color:11450557,roughness:.8,metalness:.03}),new t.MeshStandardMaterial({color:13881544,roughness:.86,metalness:.01})],o=new t.MeshStandardMaterial({color:3159098,roughness:.88,metalness:.02});let l=0,c=0;const h=this.renderQuality.osmRoadSegmentLimit,d=this.renderQuality.osmBuildingLimit,u=this.getRouteBounds(),f=180,g=x=>x.x>=u.minX-f&&x.x<=u.maxX+f&&x.z>=u.minZ-f&&x.z<=u.maxZ+f;for(const x of e){if((x==null?void 0:x.type)!=="way"||!Array.isArray(x.nodes)||!x.tags)continue;const m=x.nodes.map(p=>n.get(p)).filter(Boolean).map(p=>this.projectTaipeiLonLat(p.lon,p.lat));if(!(m.length<2)){if(x.tags.highway&&c<h){const p=this.getOsmRoadWidth(x.tags);for(let v=1;v<m.length;v+=1){const S=m[v-1],b=m[v];if(!g(S)&&!g(b))continue;const A=b.x-S.x,T=b.z-S.z,R=Math.hypot(A,T);if(R<2||c>=h)continue;const M=(S.x+b.x)/2,w=(S.z+b.z)/2;if(this.getDistanceToRoute(M,w)>130)continue;const P=new t.Mesh(new t.BoxGeometry(p,.024,R),r);P.position.set(M,-.455,w),P.rotation.y=this.getSceneYawForDirection({x:A/R,z:T/R}),i.add(P),c+=1}}if(x.tags.building&&l<d){const p=this.getPointBounds(m),v=p.maxX-p.minX,S=p.maxZ-p.minZ;if(v<1.4||S<1.4||v>140||S>140)continue;const b=this.getOsmBuildingHeight(x.tags,l),A=a[l%a.length],T={centerX:(p.minX+p.maxX)/2,centerZ:(p.minZ+p.maxZ)/2,angle:0,halfWidth:v/2,halfLength:S/2};if(!this.isBuildingFootprintClear(this.expandCollisionBox(T,2.2))||!this.isBoxNearRoute(T,95))continue;const R=new t.Mesh(new t.BoxGeometry(v,b,S),A);if(R.position.set(T.centerX,b/2-.45,T.centerZ),i.add(R),this.buildingCollisionBoxes.push(T),b>7&&Math.min(v,S)>4){const M=new t.Mesh(new t.BoxGeometry(v*.78,2.25,1.1),o);M.position.set(R.position.x,.72,p.minZ+.55),i.add(M)}l+=1}}}this.scene.add(i)}projectTaipeiLonLat(e,t){return ho(e,t)}getPointBounds(e){return e.reduce((t,n)=>({minX:Math.min(t.minX,n.x),maxX:Math.max(t.maxX,n.x),minZ:Math.min(t.minZ,n.z),maxZ:Math.max(t.maxZ,n.z)}),{minX:1/0,maxX:-1/0,minZ:1/0,maxZ:-1/0})}getOsmRoadWidth(e){const t=Number.parseFloat(String(e.width??"").replace(/[^\d.]/g,""));if(Number.isFinite(t)&&t>1)return this.clamp(t,2.4,48);const n=Number.parseFloat(String(e["lanes:forward"]??"")),i=Number.parseFloat(String(e["lanes:backward"]??"")),r=Number.parseFloat(String(e.lanes??"")),a=Number.isFinite(n)&&Number.isFinite(i)?n+i:Number.isFinite(r)?r:0;if(a>0)return this.clamp(a*this.defaultLaneWidth+1.2,3.4,42);const o=e.highway;return o==="primary"||o==="secondary"?8.4:o==="tertiary"||o==="residential"?5.8:o==="service"?3.4:o==="footway"||o==="path"||o==="steps"?1.4:4.6}getOsmBuildingHeight(e,t){const n=Number.parseFloat(String(e.height??"").replace(/[^\d.]/g,""));if(Number.isFinite(n)&&n>2)return this.clamp(n,3.4,520);const i=Number.parseFloat(String(e["building:levels"]??""));return Number.isFinite(i)&&i>0?this.clamp(i*3.25,3.4,360):8+t%7*4.2}createVehicleVisual(){const e=this.requireThree();if(!this.scene)return;const t=new e.Group;t.name="driving-reference-vehicle-root",this.vehicleRoot=t,this.scene.add(t);const n=this.createFallbackVehicle();this.fallbackVehicle=n.group,this.wheelBindings=n.wheels,t.add(n.group),this.vehicleBlobShadow=this.createBlobShadowMesh(2.75,5.35,.42),this.scene.add(this.vehicleBlobShadow),this.updateVehicleVisual(0)}createBlobShadowMesh(e,t,n){const i=this.requireThree(),r=new i.MeshBasicMaterial({map:this.getBlobShadowTexture(),transparent:!0,opacity:n,depthWrite:!1}),a=new i.Mesh(new i.PlaneGeometry(e,t),r);return a.rotation.x=-Math.PI/2,a.position.y=.118,a.renderOrder=1,a}getBlobShadowTexture(){if(this.blobShadowTexture)return this.blobShadowTexture;const e=this.requireThree(),t=document.createElement("canvas");t.width=256,t.height=128;const n=t.getContext("2d");if(n){const i=n.createRadialGradient(128,64,8,128,64,68);i.addColorStop(0,"rgba(0,0,0,0.55)"),i.addColorStop(.58,"rgba(0,0,0,0.22)"),i.addColorStop(1,"rgba(0,0,0,0)"),n.fillStyle=i,n.fillRect(0,0,t.width,t.height)}return this.blobShadowTexture=new e.CanvasTexture(t),this.blobShadowTexture.needsUpdate=!0,this.blobShadowTexture}createFallbackVehicle(e=1920728){const t=this.requireThree(),n=new t.Group;n.name="driving-reference-fallback-car";const i=new t.MeshStandardMaterial({color:e,roughness:.42,metalness:.26}),r=new t.MeshStandardMaterial({color:1516884,roughness:.18,metalness:.12}),a=new t.MeshStandardMaterial({color:1118481,roughness:.72,metalness:.12}),o=new t.MeshStandardMaterial({color:12174028,roughness:.42,metalness:.55}),l=new t.Mesh(new t.BoxGeometry(1.95,.88,4.5),i);l.position.y=.82,l.castShadow=!1,l.receiveShadow=!1;const c=new t.Mesh(new t.BoxGeometry(1.38,.82,1.7),r);c.position.set(0,1.44,-.28),c.castShadow=!1,n.add(l,c);const h=[];for(const[d,u,f]of[[-.98,-1.46,!0],[.98,-1.46,!0],[-.98,1.38,!1],[.98,1.38,!1]]){const g=new t.Group,x=new t.Mesh(new t.TorusGeometry(.38,.12,8,18),a);x.rotation.y=Math.PI/2;const m=new t.Mesh(new t.CylinderGeometry(.22,.22,.15,16),o);m.rotation.z=Math.PI/2,g.add(x,m),g.position.set(d,.42,u),g.castShadow=!1,n.add(g),h.push({node:g,initialY:g.position.y,baseRotationX:g.rotation.x,baseRotationY:g.rotation.y,baseRotationZ:g.rotation.z,front:f})}return{group:n,wheels:h}}loadReferenceVehicleModel(){if(!this.renderQuality.useReferenceVehicleModel||!this.vehicleRoot)return Promise.resolve(!1);const t=new wx;return new Promise(n=>{const i=r=>t.load(this.referenceVehicleUrls[r],a=>{var g;if(this.finished||!this.vehicleRoot){this.disposeObject(a.scene),n(!1);return}const o=this.requireThree(),l=a.scene;l.name="driving-reference-car-glb",(g=l.traverse)==null||g.call(l,x=>{x.castShadow=!1,x.receiveShadow=!1;const m=x.material;if(m){const p=Array.isArray(m)?m:[m];for(const v of p)this.applyVehicleMaterialQuality(v)}}),l.updateMatrixWorld(!0);let c=new o.Box3().setFromObject(l);const h=new o.Vector3;c.getSize(h);const u=4.55/Math.max(h.z,h.x,1);l.scale.setScalar(u),l.updateMatrixWorld(!0),c=new o.Box3().setFromObject(l);const f=new o.Vector3;c.getCenter(f),l.position.set(-f.x,-c.min.y,-f.z),l.rotation.y=this.referenceVehicleModelYawOffset,this.vehicleRoot.remove(this.fallbackVehicle),this.vehicleRoot.add(l),this.vehicleModel=l,this.fallbackVehicle=null,this.bindReferenceWheels(l),this.updateVehicleVisual(0),n(!0)},void 0,a=>{if(r+1<this.referenceVehicleUrls.length){console.warn("Unable to load the reference vehicle from the configured CDN. Falling back locally.",a),i(r+1);return}console.warn("Unable to load reference driving vehicle model.",a),n(!1)});i(0)})}applyVehicleMaterialQuality(e){var t,n,i,r,a,o,l,c;e.roughness=Math.min(.78,e.roughness??.58),e.metalness=Math.max(.08,e.metalness??.08);for(const h of["map","emissiveMap","aoMap"])if(e[h]){const d=e[h],u=this.capTextureResolution(d,this.renderQuality.vehicleTextureSize);e[h]=u,u!==d&&((t=d.dispose)==null||t.call(d))}if(this.renderQuality.level==="high"){for(const h of["normalMap","roughnessMap","metalnessMap"])if(e[h]){const d=e[h],u=this.capTextureResolution(d,this.renderQuality.vehicleTextureSize);e[h]=u,u!==d&&((n=d.dispose)==null||n.call(d))}}else(r=(i=e.normalMap)==null?void 0:i.dispose)==null||r.call(i),(o=(a=e.roughnessMap)==null?void 0:a.dispose)==null||o.call(a),(c=(l=e.metalnessMap)==null?void 0:l.dispose)==null||c.call(l),e.normalMap=null,e.roughnessMap=null,e.metalnessMap=null;e.needsUpdate=!0}capTextureResolution(e,t){const n=e==null?void 0:e.image,i=Number((n==null?void 0:n.width)??0),r=Number((n==null?void 0:n.height)??0),a=Math.max(i,r);if(!n||a<=t||i<=0||r<=0)return e;const o=this.requireThree(),l=t/a,c=document.createElement("canvas");c.width=Math.max(1,Math.round(i*l)),c.height=Math.max(1,Math.round(r*l));const h=c.getContext("2d");if(!h)return e;h.drawImage(n,0,0,c.width,c.height);const d=new o.CanvasTexture(c);return d.wrapS=e.wrapS,d.wrapT=e.wrapT,d.flipY=e.flipY,d.colorSpace=e.colorSpace??o.SRGBColorSpace,e.offset&&d.offset&&d.offset.copy(e.offset),e.repeat&&d.repeat&&d.repeat.copy(e.repeat),e.center&&d.center&&d.center.copy(e.center),d.rotation=e.rotation??0,d.needsUpdate=!0,d}bindReferenceWheels(e){var n;const t=[];(n=e.traverse)==null||n.call(e,i=>{const r=String(i.name??"").toLowerCase();if(!r.includes("wheel"))return;const a=r.includes("fl")||r.includes("fr")||r.includes("front");t.push({node:i,initialY:i.position.y,baseRotationX:i.rotation.x,baseRotationY:i.rotation.y,baseRotationZ:i.rotation.z,front:a})}),this.wheelBindings=t}updateVehicleVisual(e){if(!this.vehicleRoot)return;const t=this.getVehicleCollisionBox(),n=this.clamp(this.vehicleSpeed/this.maxVehicleSpeed,0,1);this.wheelSpin+=this.vehicleSpeed*e*2.7;const i=this.lastBrakePressed?this.lerp(-.012,-.026,n):this.lerp(.004,-.004,n),r=this.clamp(-this.steeringInput*.022-this.lastYawRate*.018,-.035,.035),a=this.getSceneYawFromHeading(this.vehicleHeading);this.vehicleRoot.position.set(t.centerX,.018,t.centerZ),this.vehicleRoot.rotation.set(i,a,r),this.vehicleBlobShadow&&(this.vehicleBlobShadow.position.set(t.centerX,.118,t.centerZ),this.vehicleBlobShadow.rotation.y=a);for(const o of this.wheelBindings)o.node.position.y=o.initialY,o.node.rotation.x=o.baseRotationX+this.wheelSpin,o.node.rotation.y=o.baseRotationY-(o.front?this.frontWheelAngle*.72:0),o.node.rotation.z=o.baseRotationZ;this.vehicleModel&&(this.vehicleModel.rotation.x=0)}loop(e,t,n){var d;if(this.finished||!this.renderer||!this.scene||!this.camera)return;if(!n.isConnected){this.finishTrial(n,"aborted");return}if(this.syncVisibilityPause(e)||this.syncInputPause(e)){this.lastFrameTime=e,this.raf=requestAnimationFrame(u=>this.loop(u,t,n));return}this.excludeInactiveFrameGap(e);const i=Math.max(0,e-this.lastFrameTime);this.lastFrameTime=e,i>=1&&i<=100&&this.fpsSamples.push(1e3/i),this.fpsSamples.length>240&&this.fpsSamples.shift();const r=this.readInput(),a=r.brake>.35;!this.laneResetActive&&a&&!this.lastBrakePressed&&this.handleBrakePressed(r.brakeTimestamp??e),a&&(this.pendingBrakeTimestamp=null),this.lastBrakePressed=a;const o=Math.abs(r.steering)>.15?Math.sign(r.steering):0;!this.laneResetActive&&o!==0&&o!==this.lastResponseSteering&&this.handleHazardResponse(e,o<0?"steer-left":"steer-right"),this.lastResponseSteering=o;const l=W_(this.simulationAccumulatorMs,i,this.fixedSimulationStepMs,this.maxSimulationCatchUpMs);this.simulationAccumulatorMs=l.nextAccumulatorMs;const c=this.fixedSimulationStepMs/1e3;for(let u=0;u<l.stepCount;u+=1)this.simulationTime+=this.fixedSimulationStepMs,this.laneResetActive?(this.vehicleSpeed=0,this.lastYawRate=0,this.updateTrafficLights(this.simulationTime),this.updateAmbientTraffic(c)):(this.updateVehicleFree(r,c,this.simulationTime),this.updateTrafficLights(this.simulationTime),this.updateIntersections(),this.activateScheduledHazards(this.simulationTime),this.updateHazards(this.simulationTime),this.updateAmbientTraffic(c));const h=l.simulatedMs/1e3;if(this.updateVehicleVisual(h),this.updateCameraFree(),this.needsFirstFrameCameraSnap&&(this.needsFirstFrameCameraSnap=!1,this.snapCameraToVehicle()),this.updateHud(),this.updateCockpitHud(),this.updateMiniMap(),this.updateRearviewMirrors(e),(d=this.viewportController)==null||d.prepareMainRender(),this.renderer.render(this.scene,this.camera),this.markHazardsPresented(Dc(e,performance.now(),this.refreshMeasured?this.displayRefreshMs:Number.NaN)),this.isTrialTimedOut(this.simulationTime,t)){si.playEnd("Victory"),this.finishTrial(n,"timeout");return}if(this.isDestinationReached()){si.playEnd("Victory"),this.finishTrial(n,"completed");return}this.raf=requestAnimationFrame(u=>this.loop(u,t,n))}renderFirstFrameBeforeReveal(e){var t;!this.renderer||!this.scene||!this.camera||(this.snapCameraToVehicle(),this.needsFirstFrameCameraSnap=!1,this.updateHud(),this.updateCockpitHud(),this.updateMiniMap(),this.updateRearviewMirrors(e),(t=this.viewportController)==null||t.prepareMainRender(),this.renderer.render(this.scene,this.camera),this.markHazardsPresented(Dc(e,performance.now(),this.refreshMeasured?this.displayRefreshMs:Number.NaN)))}isTrialTimedOut(e,t){const n=Number(t.driving_duration_sec??80),i=Math.max(5e3,n*1e3);return this.trialStartTime>0&&e-this.trialStartTime>=i}updateVehicleFree(e,t,n){const l=this.vehicleX,c=this.vehicleZ,h=this.vehicleHeading,d=this.progress,u=e.brake>.02?0:e.throttle*this.maxVehicleSpeed,f=e.brake>.02?9.6:u>this.vehicleSpeed?2.65:1.35;this.vehicleSpeed=this.expSmoothing(this.vehicleSpeed,u,f,t),this.vehicleSpeed-=.9*(1-e.throttle)*t,this.vehicleSpeed=this.clamp(this.vehicleSpeed,0,this.maxVehicleSpeed);const g=this.clamp(this.vehicleSpeed/this.maxVehicleSpeed,0,1),x=this.lerp(.72,.28,Math.pow(g,.82)),m=e.steering*x,p=Math.abs(e.steering)>.01?6.4:8.8;this.frontWheelAngle=this.expSmoothing(this.frontWheelAngle,m,p,t),Math.abs(e.steering)<=.01&&Math.abs(this.frontWheelAngle)<.0015&&(this.frontWheelAngle=0),this.steeringInput=x>0?this.clamp(this.frontWheelAngle/x,-1,1):0,Math.abs(this.steeringInput)<.002&&(this.steeringInput=0);const v=this.lerp(1,.84,Math.pow(g,.9));this.lastYawRate=this.vehicleSpeed>.03?this.vehicleSpeed*Math.tan(this.frontWheelAngle)/this.wheelBase*v:0,this.vehicleHeading+=this.lastYawRate*t;const S=this.getForwardVector(this.vehicleHeading);this.vehicleX+=S.x*this.vehicleSpeed*t,this.vehicleZ+=S.z*this.vehicleSpeed*t;const b=this.isVehicleCollidingWithTraffic();b&&this.recordAvoidanceTrafficCollision(),(this.isVehicleCollidingWithBuilding()||b)&&(this.recordCollisionEvent(n),this.vehicleX=l,this.vehicleZ=c,this.vehicleHeading=h,this.vehicleSpeed=0,this.frontWheelAngle=0,this.steeringInput=0,this.lastYawRate=0);const A=this.getVehicleCollisionBox(),T=this.projectOntoRoute(A.centerX,A.centerZ,d);this.previousProgress=d,this.progress=T.distance,this.lateralOffset=T.lateral,this.updateDrivingRuleViolations(),this.updateLaneDepartureState(Math.abs(this.lateralOffset)>this.getLaneDeviationLimit(this.progress),n)}updateDrivingRuleViolations(){const e=this.getRouteHeading(this.progress),t=Math.abs(this.getSignedAngleDelta(this.vehicleHeading,e)),n=this.vehicleSpeed>3&&t>1.05;n&&!this.navigationDeviationActive&&this.recordDrivingRuleEvent("navigation-deviation","wrong-direction"),this.navigationDeviationActive=n;const r=Math.abs(this.lateralOffset)<=this.getLaneDeviationLimit(this.progress)&&this.isProtectedLaneMarkingCrossed(this.progress,this.lateralOffset);r&&!this.laneMarkingViolationActive&&this.recordDrivingRuleEvent("lane-marking-crossed","lane-line-crossed"),this.laneMarkingViolationActive=r}updateLaneDepartureState(e,t){const n=this.getCurrentResetPose();if(e){this.laneDeviationActive||(this.laneDeviationCount+=1,this.laneDepartureStartTime=t,this.laneDeparturePose=this.lastInLanePose??n,this.recordDrivingRuleEvent("lane-departure","lane-departure")),this.laneDeviationActive=!0,this.laneDepartureStartTime!==null&&t-this.laneDepartureStartTime>=this.laneDeviationGraceMs&&this.triggerLaneReset();return}this.lastInLanePose=n,this.laneDepartureStartTime=null,this.laneDeparturePose=null,this.laneDeviationActive=!1}recordDrivingRuleEvent(e,t,n={}){this.eventResults.push({event_id:e,label:this.getDrivingRuleEventLabel(e),distance_m:Math.round(this.progress),rt_ms:n.rt??null,valid:n.valid??!0,collision:n.collision??!1,brake_preheld:n.preheldBrake??!1,response:t})}getDrivingRuleEventLabel(e){var n;return((n={"navigation-deviation":{zh:"偏離導航",en:"Navigation deviation"},"lane-marking-crossed":{zh:"壓線",en:"Lane marking crossed"},"lane-departure":{zh:"偏離車道",en:"Lane departure"},"vehicle-collision":{zh:"撞車",en:"Vehicle collision"},"traffic-light-red":{zh:"闖紅燈",en:this.text.redLightViolation}}[e])==null?void 0:n[this.language])??String(e)}getCurrentResetPose(){return{x:this.vehicleX,z:this.vehicleZ,progress:this.progress,lateral:this.lateralOffset}}triggerLaneReset(){var t;if(this.laneResetActive)return;const e=this.laneDeparturePose??this.lastInLanePose??this.getCurrentResetPose();this.laneResetActive=!0,this.vehicleSpeed=0,this.frontWheelAngle=0,this.steeringInput=0,this.lastYawRate=0,(t=this.hud)!=null&&t.blackout&&(this.hud.blackout.style.opacity="1"),this.laneResetBlackoutTimer=window.setTimeout(()=>{this.laneResetBlackoutTimer=null,this.applyLaneResetPose(e),this.laneResetClearTimer=window.setTimeout(()=>{var n;this.laneResetClearTimer=null,(n=this.hud)!=null&&n.blackout&&(this.hud.blackout.style.opacity="0"),this.laneResetActive=!1,this.laneDepartureStartTime=null,this.laneDeparturePose=null,this.laneDeviationActive=!1,this.lastInLanePose=this.getCurrentResetPose()},this.laneResetHoldMs)},this.laneResetBlackoutMs)}applyLaneResetPose(e){const t=this.getSurfacePoint(e.progress),n=this.clamp(e.lateral,-this.getLaneDeviationLimit(e.progress)+this.vehicleHalfWidth,this.getLaneDeviationLimit(e.progress)-this.vehicleHalfWidth),i=this.getHeadingFromDirection(t.dir),r=this.getRouteLateralPoint(t,n);this.vehicleX=r.x,this.vehicleZ=r.z,this.vehicleHeading=i,this.vehicleSpeed=0,this.frontWheelAngle=0,this.steeringInput=0,this.lastYawRate=0;const a=this.getVehicleCollisionBox(),o=this.projectOntoRoute(a.centerX,a.centerZ,e.progress);this.previousProgress=o.distance,this.progress=o.distance,this.lateralOffset=o.lateral,this.snapCameraToVehicle()}projectOntoRoute(e,t,n=this.progress){let i=1/0,r=0,a=0;for(let o=0;o<this.route.length;o+=1){const l=this.route[o],c=e-l.start.x,h=t-l.start.z,d=c*l.dir.x+h*l.dir.z,u=Math.max(0,Math.min(l.length,d)),f=l.start.x+l.dir.x*u,g=l.start.z+l.dir.z*u,x=(e-f)**2+(t-g)**2,m=this.getRouteRightVector(l.dir),p=m.x,v=m.z,S=(e-f)*p+(t-g)*v,b=(this.routeSegmentStarts[o]??0)+u,A=b-n,T=A<-8?Math.abs(A)*1.4:0,R=A>42?(A-42)*.45:0,M=Math.abs(A)*.12+T+R,w=x+M;w<i&&(i=w,r=b,a=S)}return{distance:r,lateral:a}}updateIntersections(){for(const e of this.intersections){if(e.entered)continue;const t=e.distance-this.progress,n=this.getIntersectionStopLineDistance(e);if(!e.announced&&t<50&&t>0&&(e.announced=!0,this.hud&&e.turnDir)){const i=this.getNavigationArrow(e.turnDir);this.hud.status.textContent=this.format(this.text.upcomingTurn,{instruction:e.instruction,arrow:i})}!e.redLightChecked&&this.previousProgress<n&&this.progress>=n&&(e.redLightChecked=!0,e.trafficSignalState==="red"&&this.recordRedLightViolation(e)),this.progress>=e.distance&&(e.entered=!0)}}updateTrafficLights(e){const t=Math.max(0,e-this.trialStartTime);for(const n of this.intersections){const i=this.getTrafficLightState(t+n.trafficSignalOffsetMs),r=n.trafficSignalRenderedState;n.trafficSignalState=i,i!==r&&(this.updateTrafficLightVisual(n,i),n.trafficSignalRenderedState=i)}}getTrafficLightState(e){const t=this.trafficGreenMs+this.trafficYellowMs+this.trafficRedMs,n=(e%t+t)%t;return n<this.trafficGreenMs?"green":n<this.trafficGreenMs+this.trafficYellowMs?"yellow":"red"}updateTrafficLightVisual(e,t){const n=e.trafficLightLamps;n&&(n.red.material.color.setHex(t==="red"?16719647:4527124),n.yellow.material.color.setHex(t==="yellow"?16767050:4864534),n.green.material.color.setHex(t==="green"?1496163:1195300))}getIntersectionStopLineDistance(e){return Math.max(0,e.distance-this.stopLineSetback)}isDestinationReached(){if(this.progress>=this.routeLength-2)return!0;if(this.progress<this.routeLength-18)return!1;const e=this.getRoutePoint(this.routeLength),t=this.getDrivingLaneOffset(this.routeLength),n=this.getVehicleCollisionBox(),i=e.x+e.normal.x*t,r=e.z+e.normal.z*t;return Math.hypot(n.centerX-i,n.centerZ-r)<7.5}recordRedLightViolation(e){var n;const t={event_id:"traffic-light-red",label:this.text.redLightViolation,distance_m:Math.round(this.progress),rt_ms:null,valid:!0,collision:!1,brake_preheld:!1,response:"red-light-violation"};this.eventResults.push(t),si.playFailure(),(n=this.hud)!=null&&n.event&&(this.hud.event.textContent=this.text.redLightViolationMessage),e.redLightChecked=!0}preloadHazardEvents(){if(!this.scene)return;const e=this.createHazardSchedule();this.activeHazards=e.map(({template:t,triggerDistance:n})=>{var o;const i=this.getHazardSpawnDistance(t.id,n),r=this.getRoutePoint(i),a=this.createHazardMesh(t.id);return a.visible=!1,a.position.set(r.x,0,r.z),a.rotation.y=this.getSceneYawForDirection(r.dir),(o=this.scene)==null||o.add(a),{active:!1,template:t,group:a,triggerDistance:n,hazardDistance:i,startTime:0,presentedAt:null,crossingStarted:!1,brakeTime:null,rt:null,preheldBrake:!1,collision:!1,resolved:!1,removeAt:null,currentDistance:i,currentLateral:0,targetLateral:0,crossingStartLateral:0,crossingEndLateral:0,result:{event_id:t.id,label:this.getHazardLabel(t.id),distance_m:Math.round(n),rt_ms:null,valid:!0,collision:!1,brake_preheld:!1,avoidance_success:null,other_vehicle_collision:!1,response:"pending"}}})}createHazardSchedule(){const e=[];let t=45;const{minHazardInterval:n,maxHazardInterval:i}=this.difficultyPreset;for(;t<this.routeLength-40;){const r=this.hazardTemplates[0];e.push({template:r,triggerDistance:t}),t+=(n+i)/2}return e}createAmbientTraffic(){if(!this.scene)return;const e=[15658734,2450411,15680580,16096779,2278750,988970];for(let t=0;t<this.renderQuality.ambientTrafficCount;t+=1){const n=t%3!==0,i=t%3===0?-1:1,r=(t*71+42)%Math.max(1,this.routeLength-12),a=n?this.createScooterMesh(e[t%e.length]):this.createFallbackVehicle(e[t%e.length]).group;a.scale.setScalar(n?1:1.02);const o=this.createBlobShadowMesh(n?1.25:2.75,n?2:5.25,n?.28:.36);this.scene.add(a),this.scene.add(o);const l={group:a,shadow:o,distance:r,lateral:this.getTrafficLaneOffset(r,i,n,t),direction:i,speed:0,targetSpeed:0,cruiseSpeed:n?6.8+t%5*.95:7.4+t%4*1.05};this.ambientTrafficActors.push(l),this.positionTrafficActor(l)}}updateAmbientTraffic(e){for(const t of this.ambientTrafficActors){const n=this.getTrafficActorStopDistance(t);t.targetSpeed=n!==null?0:t.cruiseSpeed,t.speed=this.expSmoothing(t.speed,t.targetSpeed,t.targetSpeed>t.speed?2.2:5.8,e),t.distance+=t.direction*t.speed*e,t.distance>this.routeLength-4&&(t.distance=6),t.distance<4&&(t.distance=this.routeLength-6),this.positionTrafficActor(t)}}getTrafficActorStopDistance(e){let t;if(e.direction===1)t=this.intersections.find(r=>r.distance>e.distance);else for(let r=this.intersections.length-1;r>=0;r-=1)if(this.intersections[r].distance<e.distance){t=this.intersections[r];break}if(!t)return null;const n=this.getTrafficActorStopLineDistance(t,e.direction),i=(n-e.distance)*e.direction;return i<0||i>28||t.trafficSignalState!=="red"&&t.trafficSignalState!=="yellow"?null:n}getTrafficActorStopLineDistance(e,t){return t===1?this.getIntersectionStopLineDistance(e)-2.2:Math.min(this.routeLength,e.distance+this.stopLineSetback+2.2)}getTrafficLaneOffset(e,t,n,i){const r=this.getRoutePoint(e),a=this.route[r.segmentIndex],o=this.getSegmentLaneWidth(a),l=this.getTravelLaneOffsets(a,r.oneWay?1:t),c=l[Math.abs(i+(n?1:0))%l.length]??this.getDrivingLaneOffset(e),h=n?(i%2===0?-.35:.35)*(t===1?1:-1):.1*t;return this.clamp(c+h,-r.roadWidth/2+o/2,r.roadWidth/2-o/2)}getTravelLaneOffsets(e,t){const n=this.getSegmentLaneCount(e),i=this.getSegmentLaneWidth(e);if(e.oneWay){const o=-Math.min(this.getSegmentRoadWidth(e)-1.1,n*i)/2+i/2;return Array.from({length:n},(l,c)=>o+c*i)}const r=Math.max(1,Math.floor(n/2));return Array.from({length:r},(a,o)=>t===1?i*(o+.5):-i*(o+.5))}positionTrafficActor(e){const t=this.getRoutePoint(e.distance);e.group.position.set(t.x+t.normal.x*e.lateral,.05,t.z+t.normal.z*e.lateral),e.group.rotation.y=this.getSceneYawForDirection({x:t.dir.x*e.direction,z:t.dir.z*e.direction}),e.shadow.position.set(e.group.position.x,.116,e.group.position.z),e.shadow.rotation.y=e.group.rotation.y}activateScheduledHazards(e){if(this.activeHazards.some(x=>x.active&&!x.resolved))return;const t=this.activeHazards.find(x=>!x.active&&!x.resolved&&this.progress>=x.triggerDistance);if(!t)return;const n=this.readInput(),i=this.getHazardSpawnDistance(t.template.id,this.progress),r=this.getRoutePoint(i),a=this.getCurrentVehicleLaneLateral(),o=this.getHazardTargetLateral(t.template.id,i,a),l=t.template.id==="wrong-way-driver"?this.getOpposingLaneOffset(i,o):o,c=o>=0?1:-1,h=this.getRoadWidthAtDistance(i),d=t.template.id==="child-crossing"?h/2+.25:h/2+.8,u=c*d,f=-c*d,g=n.brake>.35;t.active=!0,t.triggerDistance=this.progress,t.hazardDistance=i,t.startTime=e,t.presentedAt=null,t.crossingStarted=!1,t.brakeTime=g?e:null,t.rt=null,t.preheldBrake=g,t.collision=!1,t.resolved=!1,t.removeAt=null,t.currentDistance=i,t.currentLateral=l,t.targetLateral=o,t.crossingStartLateral=t.template.id==="wrong-way-driver"?l:u,t.crossingEndLateral=f,t.result.distance_m=Math.round(this.progress),t.result.rt_ms=null,t.result.valid=!g,t.result.collision=!1,t.result.brake_preheld=g,t.result.response=g?"invalid-preheld-brake":"pending",t.group.visible=!0,t.group.position.set(r.x+r.normal.x*l,0,r.z+r.normal.z*l),t.group.rotation.y=this.getSceneYawForDirection(t.template.id==="wrong-way-driver"?{x:-r.dir.x,z:-r.dir.z}:r.dir)}syncInputPause(e){if(!(this.controlMode!=="wheel"||(()=>{var r;const i=ws(((r=navigator.getGamepads)==null?void 0:r.call(navigator))??[]);return!!(i&&this.wheelCalibration&&Zo(i,this.wheelCalibration))})()))return this.inputPausedAt===0&&(this.inputPausedAt=e,this.keyState={left:!1,right:!1,up:!1,down:!1},this.lastBrakePressed=!1,this.inputPauseOverlay&&(this.inputPauseOverlay.style.display="grid")),!0;if(this.inputPausedAt===0)return!1;const n=Math.max(0,e-this.inputPausedAt);return this.inputPausedAt=0,this.inputPauseOverlay&&(this.inputPauseOverlay.style.display="none"),this.shiftResponseClockAfterPause(n),this.lastFrameTime=e,this.lastBrakePressed=this.readInput().brake>.35,!1}attachVisibilityPauseListener(){this.visibilityChangeListener||(this.visibilityChangeListener=()=>{const e=performance.now();document.visibilityState!=="visible"?this.beginVisibilityPause(e):this.endVisibilityPause(e)},document.addEventListener("visibilitychange",this.visibilityChangeListener),document.visibilityState!=="visible"&&this.beginVisibilityPause(performance.now()))}beginVisibilityPause(e){this.visibilityPausedAt===null&&(this.visibilityPausedAt=e),this.keyState={left:!1,right:!1,up:!1,down:!1},this.pendingBrakeTimestamp=null,this.lastBrakePressed=!1}endVisibilityPause(e){if(this.visibilityPausedAt===null)return;const t=Math.max(0,e-this.visibilityPausedAt);this.visibilityPausedAt=null,this.shiftResponseClockAfterPause(t),this.inputPausedAt>0&&(this.inputPausedAt+=t),this.lastFrameTime=e,this.pendingBrakeTimestamp=null,this.lastBrakePressed=this.controlMode==="wheel"?this.readInput().brake>.35:!1}syncVisibilityPause(e){return document.visibilityState!=="visible"?(this.beginVisibilityPause(e),!0):(this.endVisibilityPause(e),!1)}excludeInactiveFrameGap(e){if(this.lastFrameTime<=0)return;const t=e-this.lastFrameTime;if(!Number.isFinite(t)||t<=this.maxSimulationCatchUpMs)return;const n=t-this.maxSimulationCatchUpMs;this.shiftResponseClockAfterPause(n),this.inputPausedAt>0&&(this.inputPausedAt+=n),this.lastFrameTime+=n}shiftResponseClockAfterPause(e){if(!(e<=0)){for(const t of this.activeHazards)t.presentedAt!==null&&(t.presentedAt+=e);this.rearviewLastUpdateTime=performance.now(),this.miniMapLastUpdateTime=performance.now()}}markHazardsPresented(e){for(const t of this.activeHazards)t.active&&!t.resolved&&t.group.visible&&t.crossingStarted&&t.presentedAt===null&&(t.presentedAt=e,t.preheldBrake=this.readInput().brake>.35,t.brakeTime=null,t.result.brake_preheld=t.preheldBrake,t.result.valid=!1,t.result.response="pending",t.result.distance_m=Math.round(this.progress),this.eventResults.push(t.result),this.flashRed(),this.hud&&(this.hud.event.textContent=t.result.label))}getHazardLeadDistance(e){const t=this.difficultyPreset.hazardLeadDistance;return e==="child-crossing"||e==="elder-stopped"?t:e==="drunk-driver"?t*1.35:e==="wrong-way-driver"?185:e==="plane-crash"?t*1.25:t}getHazardSpawnDistance(e,t){let n=this.clamp(t+this.getHazardLeadDistance(e),10,this.routeLength-8);for(let i=0;i<5&&this.isNearIntersection(n,30);i+=1)n=this.clamp(n+24,10,this.routeLength-8);return n}updateHazards(e){const t=this.difficultyPreset.hazardTimeoutMs;for(const n of this.activeHazards){if(n.resolved){n.removeAt!==null&&e>=n.removeAt&&(n.group.visible=!1,n.removeAt=null);continue}if(!n.active)continue;const i=e-n.startTime,r=this.getRoutePoint(n.currentDistance),a=n.template.id==="plane-crash"?Math.max(.3,18-i*.018):0;let o=n.targetLateral;if(n.template.id==="child-crossing")o=this.lerp(n.crossingStartLateral,n.crossingEndLateral,Math.min(1,i/2600));else if(n.template.id==="drunk-driver")o=n.targetLateral;else if(n.template.id==="wrong-way-driver"){const g=Math.max(0,n.triggerDistance-62);n.currentDistance=Math.max(g,n.hazardDistance-i*.018);const x=this.getRoutePoint(n.currentDistance),m=n.currentDistance-this.progress,p=this.clamp((54-m)/24,0,1)**2;p>0&&(n.crossingStarted=!0),o=this.lerp(n.crossingStartLateral,n.targetLateral,p),n.group.position.set(x.x+x.normal.x*o,0,x.z+x.normal.z*o),n.currentLateral=o,n.group.rotation.y=this.getSceneYawForDirection({x:-x.dir.x,z:-x.dir.z})}n.template.id!=="wrong-way-driver"&&(n.currentLateral=o,n.group.position.set(r.x+r.normal.x*o,a,r.z+r.normal.z*o),n.group.rotation.y=this.getSceneYawForDirection(r.dir)+(n.template.id==="drunk-driver"?Math.sin(i/300)*.5:0)),n.template.id==="plane-crash"&&(n.group.rotation.z=Math.min(1.15,i/900));const l=n.currentDistance-this.progress,c=!n.resolved&&this.isHazardColliding(n),h=n.template.id==="wrong-way-driver",d=!h&&n.brakeTime!==null&&this.vehicleSpeed<2.4&&!c&&l>-1,u=h&&!c&&this.hasPassedHazard(n),f=!h&&!c&&this.hasPassedHazard(n);if(c)this.resolveHazard(n,e,!0,n.brakeTime?"collision-after-brake":"collision-no-brake");else if(d)this.resolveHazard(n,e,!1,n.preheldBrake?"invalid-preheld-brake":"brake");else if(u){const g=n.preheldBrake?"invalid-preheld-brake":n.brakeTime?"dodge-after-brake":"dodge";this.resolveHazard(n,e,!1,g)}else if(f){const g=n.preheldBrake?"invalid-preheld-brake":n.brakeTime?"dodge-after-brake":"dodge";this.resolveHazard(n,e,!1,g)}!h&&!n.resolved&&i>t&&n.brakeTime!==null&&this.vehicleSpeed<2.4&&!c&&this.resolveHazard(n,e,!1,n.preheldBrake?"invalid-preheld-brake":"brake")}}resolveHazard(e,t,n,i){if(!e.resolved&&(e.resolved=!0,e.collision=n,e.result.collision=n,e.result.avoidance_success=!n&&!(this.difficultyPreset===ri.advanced&&e.result.other_vehicle_collision),e.rt===null&&(e.result.response=i),e.result.rt_ms=e.rt,e.result.valid=e.rt!==null,e.removeAt=t+950,e.result.avoidance_success?si.playSuccess():(si.playFailure(),this.vehicleSpeed=Math.min(this.vehicleSpeed,2.5)),this.hud)){const r=e.rt!==null?`${e.rt} ms`:this.text.noValidRt,a=e.result.avoidance_success?i==="dodge"||i==="dodge-after-brake"?this.text.dodged:this.text.stopped:this.text.collision;this.hud.event.textContent=this.format(this.text.hazardResult,{label:e.result.label,outcome:a,rtText:r})}}isVehicleCollidingWithBuilding(){if(this.buildingCollisionBoxes.length===0)return!1;const e=this.getVehicleCollisionBox();return this.buildingCollisionBoxes.some(t=>this.boxesOverlap(e,t))}isVehicleCollidingWithTraffic(){if(this.ambientTrafficActors.length===0)return!1;const e=this.getVehicleCollisionBox();return this.ambientTrafficActors.some(t=>{const n=Math.max(t.group.scale.x,t.group.scale.z)<=.95,i={centerX:t.group.position.x,centerZ:t.group.position.z,angle:this.getHeadingFromSceneYaw(t.group.rotation.y||0),halfWidth:n?.55:1,halfLength:n?.95:2.25};return this.boxesOverlap(e,i)})}recordCollisionEvent(e){e-this.lastCollisionEventTime<1200||(this.lastCollisionEventTime=e,this.recordDrivingRuleEvent("vehicle-collision","collision",{collision:!0}),si.playFailure())}recordAvoidanceTrafficCollision(){for(const e of this.activeHazards)e.active&&!e.resolved&&e.presentedAt!==null&&(e.result.other_vehicle_collision=!0,this.difficultyPreset===ri.advanced&&(e.result.avoidance_success=!1))}isHazardColliding(e){return e.template.id==="plane-crash"&&e.group.position.y>1.6?!1:this.boxesOverlap(this.getVehicleCollisionBox(),this.getHazardCollisionBox(e))}hasPassedHazard(e){const t=this.getVehicleCollisionBox(),n=this.getHazardCollisionBox(e),i=t.halfLength+n.halfLength+1.2;return this.progress-e.currentDistance>i}hasDodgedWrongWayDriver(e){const t=this.getVehicleCollisionBox(),n=this.getHazardCollisionBox(e),i=e.currentDistance-this.progress,r=t.halfLength+n.halfLength+.8;if(i>r)return!1;const a=this.getCurrentVehicleLaneLateral(),o=Math.abs(a-e.currentLateral),l=t.halfWidth+n.halfWidth+.9;return o>=l}hasWrongWayDriverOverrun(e){const t=this.getVehicleCollisionBox(),n=this.getHazardCollisionBox(e),i=e.currentDistance-this.progress,r=t.halfLength+n.halfLength+.8;return i<-r}getVehicleCollisionBox(){return{centerX:this.vehicleX,centerZ:this.vehicleZ,angle:this.vehicleHeading,halfWidth:this.vehicleHalfWidth,halfLength:this.vehicleHalfLength}}getCurrentVehicleLaneLateral(){const e=this.getVehicleCollisionBox(),t=this.projectOntoRoute(e.centerX,e.centerZ,this.progress),n=this.getRoadWidthAtDistance(t.distance)/2-this.vehicleHalfWidth;return this.clamp(t.lateral,-n,n)}getHazardTargetLateral(e,t,n){return e==="elder-stopped"||e==="plane-crash"?this.getDrivingLaneOffset(t):n}getOpposingLaneOffset(e,t){const n=this.getRoutePoint(e),i=this.getSegmentLaneWidth(this.route[n.segmentIndex]);return this.clamp(-t,-n.roadWidth/2+i/2,n.roadWidth/2-i/2)}getHazardCollisionBox(e){const t=e.group.userData.vehicleKind==="scooter"?{halfWidth:.45,halfLength:1.2}:this.getHazardFootprint(e.template.id);return{centerX:e.group.position.x,centerZ:e.group.position.z,angle:this.getHeadingFromSceneYaw(e.group.rotation.y||0),...t}}getHazardFootprint(e){switch(e){case"child-crossing":return{halfWidth:.34,halfLength:.34};case"elder-stopped":return{halfWidth:.44,halfLength:.44};case"plane-crash":return{halfWidth:4.8,halfLength:4.2};case"drunk-driver":case"wrong-way-driver":return{halfWidth:1,halfLength:2.25};default:return{halfWidth:1,halfLength:1}}}boxesOverlap(e,t){const n=[this.getBoxWidthAxis(e.angle),this.getForwardVector(e.angle),this.getBoxWidthAxis(t.angle),this.getForwardVector(t.angle)];for(const i of n){const r=Math.abs((e.centerX-t.centerX)*i.x+(e.centerZ-t.centerZ)*i.z),a=this.getProjectedRadius(e,i),o=this.getProjectedRadius(t,i);if(r>a+o)return!1}return!0}getProjectedRadius(e,t){const n=this.getBoxWidthAxis(e.angle),i=this.getForwardVector(e.angle);return e.halfWidth*Math.abs(n.x*t.x+n.z*t.z)+e.halfLength*Math.abs(i.x*t.x+i.z*t.z)}handleBrakePressed(e){this.handleHazardResponse(e,"brake")}handleHazardResponse(e,t){const n=this.activeHazards.find(r=>r.active&&!r.resolved);if(!n||n.presentedAt===null||e<n.presentedAt||(t==="brake"&&(n.brakeTime??(n.brakeTime=e)),n.rt!==null))return;const i=X_(n.presentedAt,e,this.refreshMeasured?this.displayRefreshMs:Number.NaN);n.rt=i.rawRtMs,n.result.rt_ms=n.rt,n.result.raw_rt_ms=i.rawRtMs,n.result.reaction_frames=i.frameCount,n.result.response=t,n.result.valid=!0,this.hud&&(this.hud.event.textContent=this.format(this.text.brakeReaction,{label:n.result.label,rt:Math.round(n.rt)}))}createHazardMesh(e){switch(e){case"child-crossing":return this.createPersonMesh(16765286,.55,{backpack:!0});case"elder-stopped":return this.createPersonMesh(14277081,.68,{cane:!0});case"plane-crash":return this.createPlaneMesh();case"drunk-driver":return this.createCarMesh(16347926);case"wrong-way-driver":{const t=[15658734,2450411,15680580,16096779,2278750,988970],n=t[Math.floor(Math.random()*t.length)],i=Math.random()<.5,r=i?this.createScooterMesh(n):this.createFallbackVehicle(n).group;return r.userData.vehicleKind=i?"scooter":"car",r}default:return this.createCarMesh(15680580)}}createScooterMesh(e){var d;const t=this.requireThree(),n=new t.Group,i=new t.MeshStandardMaterial({color:e,roughness:.45,metalness:.18}),r=new t.MeshStandardMaterial({color:1118481,roughness:.7,metalness:.08}),a=new t.MeshStandardMaterial({color:13751771,roughness:.36,metalness:.48}),o=new t.Mesh(new t.BoxGeometry(.7,.36,1.55),i);o.position.y=.58;const l=new t.Mesh(new t.BoxGeometry(.48,.14,.72),r);l.position.set(0,.86,-.08);const c=new t.Mesh(new t.BoxGeometry(1,.08,.08),a);c.position.set(0,1.02,-.62);const h=new t.Mesh(new t.BoxGeometry(.42,.72,.28),i);h.position.set(0,.76,-.54),n.add(o,l,c,h);for(const u of[-.62,.58]){const f=new t.Mesh(new t.TorusGeometry(.22,.065,8,16),r);f.rotation.y=Math.PI/2,f.position.set(0,.28,u),n.add(f)}return(d=n.traverse)==null||d.call(n,u=>{u.castShadow=!1,u.receiveShadow=!1}),n}createPersonMesh(e,t,n={}){const i=this.requireThree(),r=new i.Group,a=new i.MeshStandardMaterial({color:15910560,roughness:.78,metalness:.02}),o=new i.MeshStandardMaterial({color:e,roughness:.72,metalness:.02}),l=new i.MeshStandardMaterial({color:2236962,roughness:.7,metalness:.04}),c=new i.Mesh(new i.SphereGeometry(.45*t,8,6),a);c.position.y=2.1*t;const h=new i.Mesh(new i.BoxGeometry(.8*t,1.15*t,.45*t),o);h.position.y=1.25*t;const d=new i.Mesh(new i.BoxGeometry(.16*t,.82*t,.16*t),o);d.position.set(-.52*t,1.3*t,0),d.rotation.z=n.cane?-.25:.38;const u=new i.Mesh(new i.BoxGeometry(.16*t,.82*t,.16*t),o);u.position.set(.52*t,1.3*t,0),u.rotation.z=n.backpack?-.42:.25;const f=new i.Mesh(new i.BoxGeometry(.22*t,.9*t,.22*t),l);f.position.set(-.22*t,.45*t,0),f.rotation.z=n.backpack?.18:0;const g=new i.Mesh(new i.BoxGeometry(.22*t,.9*t,.22*t),l);if(g.position.set(.22*t,.45*t,0),g.rotation.z=n.backpack?-.18:0,r.add(c,h,d,u,f,g),n.backpack){const x=new i.MeshStandardMaterial({color:2450411,roughness:.62,metalness:.05}),m=new i.Mesh(new i.BoxGeometry(.52*t,.68*t,.22*t),x);m.position.set(0,1.35*t,-.34*t),r.add(m)}if(n.cane){const x=new i.MeshStandardMaterial({color:8145453,roughness:.66,metalness:.08}),m=new i.Mesh(new i.CylinderGeometry(.035*t,.035*t,1.35*t,8),x);m.position.set(-.68*t,.72*t,.18*t),m.rotation.z=-.16,r.add(m)}return r}createCarMesh(e){var r,a,o;const t=new wc.Group,n=(a=(r=this.vehicleModel)==null?void 0:r.clone)==null?void 0:a.call(r,!0);if(n)return n.rotation.x=0,(o=n.traverse)==null||o.call(n,l=>{l.castShadow=!1,l.receiveShadow=!1}),t.add(n),t;const i=this.createFallbackVehicle(e);return t.add(i.group),t}createPlaneMesh(){const e=this.requireThree(),t=new e.Group,n=new e.MeshBasicMaterial({color:14081508}),i=new e.MeshBasicMaterial({color:9741240}),r=new e.MeshBasicMaterial({color:4937059,transparent:!0,opacity:.42}),a=new e.MeshBasicMaterial({color:2042167}),o=new e.Mesh(new e.BoxGeometry(1.4,1.2,7),n),l=new e.Mesh(new e.BoxGeometry(8,.18,1.4),i),c=new e.Mesh(new e.BoxGeometry(4,.16,1.1),i);c.position.z=-2.8,c.position.y=.75,t.add(o,l,c);for(const[h,d,u,f]of[[-1.7,.9,-3.3,.7],[1.6,1.15,-3.9,.55],[.2,1.35,-4.6,.82]]){const g=new e.Mesh(new e.SphereGeometry(f,10,8),r);g.position.set(h,d,u),t.add(g)}for(const[h,d,u]of[[-3.1,2.8,1.1],[2.8,1.9,.8],[.8,-3.8,.9]]){const f=new e.Mesh(new e.BoxGeometry(u,.16,.42),a);f.position.set(h,.12,d),f.rotation.y=h*.7,t.add(f)}return t.scale.set(1.2,1.2,1.2),t}updateCameraFree(){this.applyCameraPose()}snapCameraToVehicle(){this.applyCameraPose()}applyCameraPose(){if(!this.camera)return;const e=F_({vehicleX:this.vehicleX,vehicleZ:this.vehicleZ,vehicleHeading:this.vehicleHeading,mode:this.cameraMode});this.camera.position.set(e.position.x,e.position.y,e.position.z),this.camera.up.set(e.up.x,e.up.y,e.up.z),this.camera.lookAt(e.lookAt.x,e.lookAt.y,e.lookAt.z),Math.abs(this.camera.fov-e.fov)>1e-4&&(this.camera.fov=e.fov,this.camera.updateProjectionMatrix())}cycleCameraMode(){var n;const e=["third-person","first-person"],t=e[(e.indexOf(this.cameraMode)+1)%e.length];this.cameraMode=t,this.updateCameraModeHud(),this.snapCameraToVehicle(),(n=this.hud)!=null&&n.event&&(this.hud.event.textContent=this.language==="en"?`View: ${this.getCameraModeText()}`:`視角：${this.getCameraModeText()}`)}getCameraModeText(){return this.language==="en"?this.cameraMode==="first-person"?"First-person":"Third-person":this.cameraMode==="first-person"?"第一人稱":"第三人稱"}updateCameraModeHud(){var e,t;(e=this.hud)!=null&&e.view&&(this.hud.view.textContent=this.language==="en"?`View: ${this.getCameraModeText()}`:`視角：${this.getCameraModeText()}`),(t=this.hud)!=null&&t.cockpit&&(this.hud.cockpit.style.display=this.cameraMode==="first-person"?"block":"none"),this.vehicleRoot&&(this.vehicleRoot.visible=this.cameraMode==="third-person"),this.vehicleBlobShadow&&(this.vehicleBlobShadow.visible=this.cameraMode==="third-person")}updateCockpitHud(){if(this.cockpitSteeringWheel){const t=this.clamp(this.frontWheelAngle*34,-24,24);this.cockpitSteeringWheel.style.transform=`translateX(-50%) rotate(${t}deg)`}const e=Math.round(this.vehicleSpeed*3.6);if(this.cockpitSpeedText&&(this.cockpitSpeedText.textContent=String(e)),this.cockpitSpeedNeedle){const t=this.clamp(e/Math.round(this.maxVehicleSpeed*3.6),0,1);this.cockpitSpeedNeedle.style.transform=`rotate(${-115+t*230}deg)`}}updateHud(){if(!this.hud)return;const e=this.intersections.find(t=>!t.entered&&this.progress<t.distance);if(e&&e.turnDir){const t=Math.round(e.distance-this.progress),n=this.getNavigationArrow(e.turnDir);this.hud.status.textContent=this.language==="en"?`Navigation: ${e.instruction} in ${t}m ${n}`:`導航：${t}m 後${e.instruction} ${n}`}else this.hud.status.textContent=this.language==="en"?"Navigation: continue to destination":"導航：直行前往終點";this.hud.route.textContent=this.getRouteHudText(),this.hud.speed.textContent=`${Math.round(this.vehicleSpeed*3.6)} km/h`,this.hud.distance.textContent=`${Math.max(0,Math.round(this.routeLength-this.progress))} m`,this.hud.view&&(this.hud.view.textContent=this.language==="en"?`View: ${this.getCameraModeText()}`:`視角：${this.getCameraModeText()}`)}flashRed(){var e;!((e=this.hud)!=null&&e.redFlash)||this.hud.redFlash.style.boxShadow==="none"||(this.hud.redFlash.style.opacity="1",window.setTimeout(()=>{var t;(t=this.hud)!=null&&t.redFlash&&(this.hud.redFlash.style.opacity="0")},120))}readInput(){var o;let e=0,t=this.keyState.up?1:0,n=this.keyState.down?1:0,i=this.pendingBrakeTimestamp,r="";this.keyState.left&&(e-=1),this.keyState.right&&(e+=1);const a=ws(((o=navigator.getGamepads)==null?void 0:o.call(navigator))??[]);if(this.gamepadConnected=!!a,this.controlMode==="wheel"&&a&&this.wheelCalibration){r=a.id;const l=Zo(a,this.wheelCalibration);l&&(e=Math.abs(l.steering)>.03?l.steering:0,t=l.throttle,n=l.brake,n>.35&&Number.isFinite(a.timestamp)&&(i=this.normalizeInputTimestamp(a.timestamp)))}return{steering:Math.max(-1,Math.min(1,e)),throttle:Math.max(0,Math.min(1,t)),brake:Math.max(0,Math.min(1,n)),brakeTimestamp:i,gamepadName:r}}getControlMode(e){return e==="wasd"||e==="wheel"||e==="touch"?e:"arrow"}getLanguage(e){return e==="en"?"en":"zh"}getRouteAlias(){var n;const e=(n=this.selectedRouteVariant)==null?void 0:n.id,t=Di.findIndex(i=>i.id===e);return t>=0?`R${t+1}`:"R?"}getRouteHudText(){const e=this.getRouteAt(this.progress).segment.name,t=this.getRouteAlias(),n=e?` / ${e}`:"";return this.language==="en"?`Route: ${t}${n}`:`路線：${t}${n}`}getHazardLabel(e){return this.text.hazardLabels[e]}format(e,t){return Object.entries(t).reduce((n,[i,r])=>n.replace(new RegExp(`{${i}}`,"g"),String(r)),e)}clamp(e,t,n){return Math.max(t,Math.min(n,e))}lerp(e,t,n){return e+(t-e)*this.clamp(n,0,1)}expSmoothing(e,t,n,i){const r=1-Math.exp(-Math.max(0,n)*Math.max(0,i));return this.lerp(e,t,r)}getSignedAngleDelta(e,t){return Math.atan2(Math.sin(e-t),Math.cos(e-t))}getForwardVector(e){return{x:Math.sin(e),z:-Math.cos(e)}}getRightVector(e){return{x:Math.cos(e),z:Math.sin(e)}}getRouteRightVector(e){return{x:-e.z,z:e.x}}getHeadingFromDirection(e){return Math.atan2(e.x,-e.z)}getSceneYawFromHeading(e){return-e}getHeadingFromSceneYaw(e){return-e}getSceneYawForDirection(e){return this.getSceneYawFromHeading(this.getHeadingFromDirection(e))}getRouteLateralPoint(e,t){return{x:e.x+e.normal.x*t,z:e.z+e.normal.z*t}}getDrivingLanePoint(e){return this.getRouteLateralPoint(this.getSurfacePoint(e),this.getDrivingLaneOffset(e))}getBoxWidthAxis(e){return this.getRightVector(e)}getSegmentRoadWidth(e){return Math.max(2.8,(e==null?void 0:e.roadWidth)??this.defaultRoadWidth)}getSegmentLaneCount(e){return Math.max(1,Math.round((e==null?void 0:e.laneCount)??2))}getSegmentLaneWidth(e){return this.getSegmentRoadWidth(e)/this.getSegmentLaneCount(e)}getLaneDividerOffsets(e){const t=this.getSegmentLaneCount(e);if(t<=1)return[];const n=this.getSegmentLaneWidth(e),r=-Math.min(this.getSegmentRoadWidth(e)-1.1,t*n)/2,a=[];for(let o=1;o<t;o+=1)a.push(r+o*n);return a}isProtectedLaneMarkingCrossed(e,t){const n=this.getRoutePoint(e),i=this.route[n.segmentIndex],r=this.getSegmentLaneWidth(i),a=this.vehicleHalfWidth+.18;return!n.oneWay&&this.getSegmentLaneCount(i)>=3&&Math.abs(t)<=a+.1?!0:this.isNearIntersection(e,38)?this.getLaneDividerOffsets(i).some(l=>!n.oneWay&&Math.abs(l)<r*.35?!1:Math.abs(t-l)<=a):!1}getRoadWidthAtDistance(e){return this.getRoutePoint(e).roadWidth}getInitialRouteDistance(){return this.getStableRouteDistance(this.initialRouteDistance)}getStableRouteDistance(e){const n=Math.max(2,this.routeLength-12);let i=this.clamp(e,2,n);const r=this.routeTurnBlendDistance+2;for(let a=0;a<this.route.length;a+=1){const o=this.getRouteAt(i),l=this.routeSegmentStarts[o.index]??0,c=l+o.segment.length;let h=i;if(o.index>0&&i-l<r&&(h=l+r),o.index<this.route.length-1&&c-i<r&&(h=c+r),h=this.clamp(h,2,n),Math.abs(h-i)<.001)return h;i=h}return i}getDrivingLaneOffset(e){const t=this.getRoutePoint(e),n=this.route[t.segmentIndex],i=this.getSegmentLaneWidth(n),r=this.getSegmentLaneCount(n);if(t.oneWay){const c=-Math.min(t.roadWidth-1.1,r*i)/2+i/2,h=Math.floor((r-1)/2);return c+h*i}const a=Math.max(1,Math.floor(r/2));return this.getTravelLaneOffsets(n,1)[Math.floor(a/2)]??Math.min(t.roadWidth/2-i/2,i*.5)}getLaneDeviationLimit(e){return Math.max(this.minLaneDeviationLimit,this.getRoadWidthAtDistance(e)/2-.35)}getRouteBounds(){return this.route.reduce((e,t)=>{const n=t.start.x+t.dir.x*t.length,i=t.start.z+t.dir.z*t.length;return{minX:Math.min(e.minX,t.start.x,n),maxX:Math.max(e.maxX,t.start.x,n),minZ:Math.min(e.minZ,t.start.z,i),maxZ:Math.max(e.maxZ,t.start.z,i)}},{minX:1/0,maxX:-1/0,minZ:1/0,maxZ:-1/0})}getDistanceToRoute(e,t){let n=1/0;for(const i of this.route){const r=e-i.start.x,a=t-i.start.z,o=r*i.dir.x+a*i.dir.z,l=this.clamp(o,0,i.length),c=i.start.x+i.dir.x*l,h=i.start.z+i.dir.z*l;n=Math.min(n,(e-c)**2+(t-h)**2)}return Math.sqrt(n)}isBoxNearRoute(e,t){const n=Math.hypot(e.halfWidth,e.halfLength)+t;return this.getDistanceToRoute(e.centerX,e.centerZ)<=n}ensureRoute(e){const t=e.filter(n=>Number.isFinite(n.length)&&n.length>.5&&Number.isFinite(n.start.x)&&Number.isFinite(n.start.z)&&Number.isFinite(n.dir.x)&&Number.isFinite(n.dir.z)&&Number.isFinite(n.roadWidth)&&Number.isFinite(n.laneCount));return t.length>0?t:[{start:{x:0,z:0},dir:{x:0,z:-1},length:160,roadWidth:this.defaultRoadWidth,laneCount:2,oneWay:!0,name:"fallback-road"}]}getRouteAt(e){const t=Math.max(0,this.routeLength),n=this.clamp(e,0,t);let i=0,r=0,a=this.route.length-1;for(;r<=a;){const c=Math.floor((r+a)/2);(this.routeSegmentStarts[c]??0)<=n?(i=c,r=c+1):a=c-1}const o=this.route[i]??this.route[0],l=this.routeSegmentStarts[i]??0;return{segment:o,index:i,local:this.clamp(n-l,0,o.length)}}getRouteHeading(e){const t=this.getRoutePoint(e);return this.getHeadingFromDirection(t.dir)}getRoutePoint(e){const t=this.getRouteAt(e),{index:n,local:i}=t,r=this.getSmoothedDirection(n,i);return this.makeRoutePoint(t,r)}getSurfacePoint(e){const t=this.getRouteAt(e);return this.makeRoutePoint(t,t.segment.dir)}makeRoutePoint(e,t){const{segment:n,index:i,local:r}=e,a=this.getRouteRightVector(t);return{x:n.start.x+n.dir.x*r,z:n.start.z+n.dir.z*r,dir:t,normal:a,segmentIndex:i,localDistance:r,roadWidth:this.getSegmentRoadWidth(n),laneCount:this.getSegmentLaneCount(n),oneWay:n.oneWay}}getSmoothedDirection(e,t){const n=this.route[e],i=this.routeTurnBlendDistance;if(t>n.length-i&&this.route[e+1]){const r=(t-(n.length-i))/i;return this.normalizeDir({x:n.dir.x*(1-r)+this.route[e+1].dir.x*r,z:n.dir.z*(1-r)+this.route[e+1].dir.z*r})}if(t<i&&this.route[e-1]){const r=t/i;return this.normalizeDir({x:this.route[e-1].dir.x*(1-r)+n.dir.x*r,z:this.route[e-1].dir.z*(1-r)+n.dir.z*r})}return n.dir}normalizeDir(e){const t=Math.hypot(e.x,e.z)||1;return{x:e.x/t,z:e.z/t}}getRouteTurn(e,t){const n=e.x*t.z-e.z*t.x,i=e.x*t.x+e.z*t.z,r=Math.atan2(n,i);return Math.abs(r)<Math.PI/12?null:r>0?"right":"left"}getTurnInstruction(e){return e==="left"?this.text.turnLeft:e==="right"?this.text.turnRight:this.text.straight}getNavigationArrow(e){return e==="left"?"←":e==="right"?"→":"↑"}finishTrial(e,t){var h,d;if(this.finished)return;this.finished=!0;const n=this.trialStartTime>0?Math.round(Math.max(0,this.simulationTime-this.trialStartTime)):0,i=this.eventResults.filter(u=>u.event_id==="wrong-way-driver");for(const u of i)u.response==="pending"&&(u.response="no-response");const r=i.filter(u=>u.valid),a=r.filter(u=>u.rt_ms!==null).map(u=>u.rt_ms),o=q_(a),l=this.eventResults.filter(u=>u.collision).length,c=this.fpsSamples.length?Math.round(this.fpsSamples.reduce((u,f)=>u+f,0)/this.fpsSamples.length):0;this.detachGlobalListeners(),this.cleanupRenderResources(),e.replaceChildren(),this.jsPsych.finishTrial({rt:o.averageMs,correct:t==="completed"&&i.length>0&&i.every(u=>u.avoidance_success===!0),target:this.text.deliveryTarget,response:t,duration_ms:n,average_rt:o.averageMs,median_rt:o.medianMs,valid_event_count:r.length,reaction_event_count:a.length,successful_avoidance_count:i.filter(u=>u.avoidance_success===!0).length,event_count:i.length,collisions:l,lane_deviations:this.laneDeviationCount,average_fps:c,display_refresh_hz:this.refreshMeasured?Math.round(this.displayRefreshHz*100)/100:0,display_refresh_ms:this.refreshMeasured?Math.round(this.displayRefreshMs*1e3)/1e3:0,refresh_sample_count:this.refreshSampleCount,refresh_measurement_valid:this.refreshMeasured,rendering_quality:this.renderQuality.level,control_mode:this.controlMode,route_id:((h=this.selectedRouteVariant)==null?void 0:h.id)??"unknown",route_label:((d=this.selectedRouteVariant)==null?void 0:d.label)??"Unknown route",route_progress:Math.round(this.progress*10)/10,driving_events:i})}detachGlobalListeners(){cancelAnimationFrame(this.raf),this.keydownListener&&(window.removeEventListener("keydown",this.keydownListener),this.keydownListener=null),this.keyupListener&&(window.removeEventListener("keyup",this.keyupListener),this.keyupListener=null),this.detachResizeSync(),this.gamepadConnectedListener&&(window.removeEventListener("gamepadconnected",this.gamepadConnectedListener),this.gamepadConnectedListener=null),this.gamepadDisconnectedListener&&(window.removeEventListener("gamepaddisconnected",this.gamepadDisconnectedListener),this.gamepadDisconnectedListener=null),this.visibilityChangeListener&&(document.removeEventListener("visibilitychange",this.visibilityChangeListener),this.visibilityChangeListener=null),this.visibilityPausedAt=null}normalizeInputTimestamp(e){return G_(e,performance.now())}captureBrakeInputTimestamp(e){const t=this.normalizeInputTimestamp(e);document.visibilityState!=="visible"||this.visibilityPausedAt!==null||(this.excludeInactiveFrameGap(t),this.pendingBrakeTimestamp=t,this.lastBrakePressed=!0,this.laneResetActive||this.handleBrakePressed(t))}captureSteeringInputTimestamp(e){const t=Number(this.keyState.right)-Number(this.keyState.left),n=this.lastResponseSteering;if(this.lastResponseSteering=t,!t||t===n||this.laneResetActive||document.visibilityState!=="visible"||this.visibilityPausedAt!==null)return;const i=this.normalizeInputTimestamp(e);this.excludeInactiveFrameGap(i),this.handleHazardResponse(i,t<0?"steer-left":"steer-right")}detachResizeSync(){var e;(e=this.viewportController)==null||e.stop(),this.viewportController=null}clearLaneResetTimers(){this.laneResetBlackoutTimer!==null&&(window.clearTimeout(this.laneResetBlackoutTimer),this.laneResetBlackoutTimer=null),this.laneResetClearTimer!==null&&(window.clearTimeout(this.laneResetClearTimer),this.laneResetClearTimer=null)}cleanupRenderResources(){var e,t,n,i,r,a,o,l,c,h,d,u;(e=this.unregisterRuntimeDisposer)==null||e.call(this),this.unregisterRuntimeDisposer=null,cancelAnimationFrame(this.raf),this.clearLaneResetTimers(),this.detachResizeSync();for(const f of Object.values(this.rearviewRenderTargets))(t=f==null?void 0:f.dispose)==null||t.call(f);this.rearviewRenderTargets={},this.rearviewPixelBuffers={},this.rearviewImageData=new WeakMap,this.asphaltMaterials.clear(),this.signTextureCache.clear(),this.asphaltTexture=null,this.miniMapLastUpdateTime=0,this.miniMapLastDirectionText="",this.miniMapRouteSamples=[],this.sideRearviewMirrorsEnabled=!0,this.rearviewQualityLevel="high",this.needsFirstFrameCameraSnap=!1,this.scene&&(this.disposeObject(this.scene),(i=(n=this.scene).clear)==null||i.call(n),this.scene=null),this.renderer&&((a=(r=this.renderer).dispose)==null||a.call(r),(l=(o=this.renderer).forceContextLoss)==null||l.call(o),(h=(c=this.renderer.domElement)==null?void 0:c.remove)==null||h.call(c),this.renderer=null),(d=this.touchControlsRoot)==null||d.remove(),this.touchControlsRoot=null,(u=this.inputPauseOverlay)==null||u.remove(),this.inputPauseOverlay=null,this.inputPausedAt=0,this.visibilityPausedAt=null,this.camera=null,this.rearviewCamera=null,this.rearviewLookAt=null,this.vehicleRoot=null,this.vehicleModel=null,this.fallbackVehicle=null,this.vehicleBlobShadow=null,this.blobShadowTexture=null,this.wheelBindings=[],this.ambientTrafficActors=[],this.hud=null,this.miniMapCanvas=null,this.miniMapCtx=null,this.miniMapDirectionLabel=null,this.rearviewMirrorCanvases={},this.cockpitSteeringWheel=null,this.cockpitSpeedNeedle=null,this.cockpitSpeedText=null}disposeObject(e){var t;(t=e==null?void 0:e.traverse)==null||t.call(e,n=>{var i,r;(r=(i=n.geometry)==null?void 0:i.dispose)==null||r.call(i),this.disposeMaterial(n.material)})}disposeMaterial(e){var n,i,r;if(!e)return;const t=Array.isArray(e)?e:[e];for(const a of t){for(const o of["map","alphaMap","aoMap","bumpMap","emissiveMap","metalnessMap","normalMap","roughnessMap"])(i=(n=a[o])==null?void 0:n.dispose)==null||i.call(n);(r=a.dispose)==null||r.call(a)}}requireThree(){return wc}}X(j_,"info",Y_);function Nc(s,e){const t=document.createElement("button");t.type="button",t.textContent=s,t.setAttribute("aria-label",e),Object.assign(t.style,{minWidth:"58px",height:"58px",padding:"0 14px",border:"1px solid var(--border-hover)",borderRadius:"12px",background:"var(--bg-overlay)",color:"var(--text-primary)",boxShadow:"var(--shadow-floating)",cursor:"pointer",fontFamily:cs.fontFamily,fontSize:"22px",fontWeight:"900",lineHeight:"1",touchAction:"none",userSelect:"none",WebkitUserSelect:"none",WebkitTapHighlightColor:"transparent",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}),t.addEventListener("pointerdown",()=>{t.style.setProperty("scale","0.96"),t.style.filter="brightness(0.84)"});const n=()=>{t.style.setProperty("scale","1"),t.style.filter=""};return t.addEventListener("pointerup",n),t.addEventListener("pointercancel",n),t.addEventListener("pointerleave",n),t}export{j_ as default};

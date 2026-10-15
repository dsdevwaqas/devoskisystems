const decode=s=>s.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#8217;/g,"'").replace(/&#8211;/g,'�');
function parse(h){let root={tag:'root',attrs:{},children:[]},stack=[root];for(const m of h.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+/g)){let t=m[0];if(t.startsWith('</')){let name=t.slice(2,-1).trim();for(let i=stack.length-1;i>0;i--)if(stack[i].tag===name){stack.length=i;break}}else if(/^<[a-zA-Z]/.test(t)){let tag=t.match(/^<(\w[\w-]*)/)[1],attrs={};for(const a of t.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[a[1]]=decode(a[2]??a[3]);let n={tag,attrs,children:[]};stack.at(-1).children.push(n);if(!['img','br','hr','input','meta','link','source','wbr','area','embed'].includes(tag)&&!t.endsWith('/>'))stack.push(n)}else if(!t.startsWith('<'))stack.at(-1).children.push(decode(t))}return root}
function text(n){return typeof n==='string'?n:n.children.map(text).join(' ').replace(/\s+/g,' ').trim()}
function walk(n,fn){if(typeof n==='string')return;fn(n);n.children.forEach(c=>walk(c,fn))}

module.exports={parse,text,walk,decode};

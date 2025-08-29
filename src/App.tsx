import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Image as ImageIcon, Loader2, Plus, Trash2, UploadCloud, RefreshCw, Users, Wrench, X, Download, ShieldCheck, Settings } from 'lucide-react';

// Copied logic from original chores_familias_mvp_react_app.jsx (trimmed comments for brevity)
const LS_KEY = 'choresFamilias:v1';
function uid(prefix = 'id'): string { return `${prefix}_${Math.random().toString(36).slice(2,9)}`; }
function todayKey(d = new Date()): string { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
const WEEKDAY_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'] as const;
const WEEKDAY_LONG = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'] as const;

// Types
interface Kid { id: string; nombre: string; color?: string; avatarDataUrl?: string; }
type Frequency = 'diaria' | 'semanal' | 'una_vez';
interface Chore { id: string; titulo: string; descripcion?: string; frecuencia: Frequency; diasSemana?: number[]; asignadoA: string[]; horaLimite?: string; requiereAprobacion?: boolean; }
type SubmissionStatus = 'hecha' | 'pendiente' | 'aprobada' | 'rechazada';
interface Submission { status: SubmissionStatus; fotoDataUrl: string; timestamp: number; nota?: string; }
interface DB { kids: Kid[]; chores: Chore[]; submissions: Record<string, Record<string, Record<string, Submission>>>; }

// Local DB hook
function useLocalDB() {
  const [db,setDb] = useState<DB>(()=>{ try { const raw = localStorage.getItem(LS_KEY); if(raw) return JSON.parse(raw); } catch {} return seedDB(); });
  useEffect(()=>{ localStorage.setItem(LS_KEY, JSON.stringify(db)); },[db]);
  return { db, setDb: (next: DB)=>setDb(next) };
}
function seedDB(): DB { const k1:Kid={id:uid('kid'),nombre:'Ana'}; const k2:Kid={id:uid('kid'),nombre:'Leo'}; const c1:Chore={id:uid('chore'),titulo:'Lavar los platos',descripcion:'Platos, vasos y cubiertos después de la cena.',frecuencia:'diaria',asignadoA:[k1.id,k2.id],requiereAprobacion:false}; const c2:Chore={id:uid('chore'),titulo:'Barrer la sala',descripcion:'Piso sin migas ni polvo.',frecuencia:'semanal',diasSemana:[1,3,5],asignadoA:[k2.id],requiereAprobacion:false}; const c3:Chore={id:uid('chore'),titulo:'Limpiar mesa comedor',descripcion:'Quitar manchas y dejar seca.',frecuencia:'una_vez',asignadoA:[k1.id]}; return { kids:[k1,k2], chores:[c1,c2,c3], submissions:{} }; }
function choresForDay(chore:Chore,d=new Date()):boolean { if(chore.frecuencia==='diaria') return true; if(chore.frecuencia==='una_vez') return true; if(chore.frecuencia==='semanal'){ const dow=d.getDay(); return !!chore.diasSemana?.includes(dow);} return true; }
function getSubmission(db:DB,dateKey:string,kidId:string,choreId:string){ return db.submissions?.[dateKey]?.[kidId]?.[choreId]; }
function setSubmission(db:DB,dateKey:string,kidId:string,choreId:string, sub:Submission):DB { const next:DB = JSON.parse(JSON.stringify(db)); next.submissions[dateKey]=next.submissions[dateKey]||{}; next.submissions[dateKey][kidId]=next.submissions[dateKey][kidId]||{}; next.submissions[dateKey][kidId][choreId]=sub; return next; }
function removeSubmission(db:DB,dateKey:string,kidId:string,choreId:string):DB { const next:DB = JSON.parse(JSON.stringify(db)); const level = next.submissions?.[dateKey]?.[kidId]; if(level && level[choreId]) delete level[choreId]; return next; }

// UI primitives
const Badge: React.FC<React.PropsWithChildren> = ({children})=> <span className="px-2.5 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-neutral-800">{children}</span>;
const Button: React.FC<React.PropsWithChildren<{onClick?:()=>void;type?:'button'|'submit';disabled?:boolean;variant?:'default'|'outline'|'ghost'|'destructive'}>> = ({children,onClick,type='button',disabled,variant='default'})=>{ const styles={default:'bg-black text-white hover:opacity-90',outline:'border border-gray-300 hover:bg-gray-50',ghost:'hover:bg-gray-100',destructive:'bg-red-600 text-white hover:bg-red-700'} as const; return <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50 ${styles[variant]}`}>{children}</button>; };
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props)=> <input {...props} className={`w-full rounded-xl border border-gray-300 px-3 py-2 text-sm ${props.className||''}`} />;
const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props)=> <textarea {...props} className={`w-full rounded-xl border border-gray-300 px-3 py-2 text-sm ${props.className||''}`} />;
const Select: React.FC<{value:string; onChange:(v:string)=>void; children:React.ReactNode}> = ({value,onChange,children})=> <select value={value} onChange={e=>onChange(e.target.value)} className='w-full rounded-xl border border-gray-300 px-3 py-2 text-sm'>{children}</select>;
const Toggle: React.FC<{checked:boolean; onChange:(v:boolean)=>void; label:string}> = ({checked,onChange,label})=> <label className='flex items-center gap-3 select-none'><input type='checkbox' checked={checked} onChange={e=>onChange(e.target.checked)} className='h-4 w-4' /><span className='text-sm'>{label}</span></label>;
const Card: React.FC<React.PropsWithChildren> = ({children})=> <div className='rounded-2xl border border-gray-200/30 bg-white/70 dark:bg-neutral-900/70 shadow-sm p-4'>{children}</div>;
const Section: React.FC<{title:string; right?:React.ReactNode; children:React.ReactNode}> = ({title,right,children})=> <div className='mb-6'><div className='flex items-center justify-between mb-2'><h2 className='text-xl font-semibold'>{title}</h2>{right}</div><div className='grid gap-3'>{children}</div></div>;

// Photo upload
function FileToDataUrl(file:File):Promise<string>{ return new Promise((res,rej)=>{ const reader=new FileReader(); reader.onload=()=>res(String(reader.result)); reader.onerror=rej; reader.readAsDataURL(file); }); }
const PhotoUpload: React.FC<{onImage:(d:string)=>void; existing?:string}> = ({onImage,existing})=>{ const inputRef=useRef<HTMLInputElement|null>(null); const [busy,setBusy]=useState(false); return <div className='flex items-center gap-2'><input ref={inputRef} type='file' accept='image/*' capture='environment' onChange={async e=>{ const f=e.target.files?.[0]; if(!f) return; setBusy(true); try { const url=await FileToDataUrl(f); onImage(url);} finally { setBusy(false); if(inputRef.current) inputRef.current.value=''; } }} className='hidden' /> <Button onClick={()=>inputRef.current?.click()} disabled={busy}>{busy? <Loader2 className='h-4 w-4 animate-spin'/> : <Camera className='h-4 w-4'/>} Tomar/Subir foto</Button>{existing && <Button variant='outline' onClick={()=> window.open(existing,'_blank')!}><ImageIcon className='h-4 w-4'/> Ver foto</Button>}</div>; };

// Admin Panel
const AdminPanel: React.FC<{db:DB; setDb:(n:DB)=>void}> = ({db,setDb})=>{ const [kidNombre,setKidNombre]=useState(''); const [choreDraft,setChoreDraft]=useState<Partial<Chore>>({frecuencia:'diaria', asignadoA:[]}); const today=new Date(); const dateKey=todayKey(today); function addKid(){ if(!kidNombre.trim()) return; const k:Kid={id:uid('kid'), nombre:kidNombre.trim()}; setDb({...db, kids:[...db.kids,k]}); setKidNombre(''); } function addChore(){ if(!choreDraft.titulo||!choreDraft.frecuencia) return; const c:Chore={ id:uid('chore'), titulo:choreDraft.titulo!, descripcion:choreDraft.descripcion||'', frecuencia:choreDraft.frecuencia as Frequency, diasSemana: choreDraft.frecuencia==='semanal' ? (choreDraft.diasSemana||[1,3,5]) : undefined, asignadoA: (choreDraft.asignadoA||[]).length ? choreDraft.asignadoA as string[] : db.kids.map(k=>k.id), horaLimite: choreDraft.horaLimite||undefined, requiereAprobacion: choreDraft.requiereAprobacion||false }; setDb({...db, chores:[c, ...db.chores]}); setChoreDraft({frecuencia:'diaria', asignadoA:[]}); } function deleteChore(id:string){ setDb({...db, chores: db.chores.filter(c=>c.id!==id)}); } function approve(dateKey:string,kidId:string,choreId:string){ const sub=getSubmission(db,dateKey,kidId,choreId); if(!sub) return; setDb(setSubmission(db,dateKey,kidId,choreId,{...sub,status:'aprobada'})); } function reject(dateKey:string,kidId:string,choreId:string){ const sub=getSubmission(db,dateKey,kidId,choreId); if(!sub) return; setDb(setSubmission(db,dateKey,kidId,choreId,{...sub,status:'rechazada'})); } function exportJSON(){ const data=JSON.stringify(db,null,2); const blob=new Blob([data],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`chores-${dateKey}.json`; document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove(); }
  async function importJSON(file:File){ const text=await file.text(); try { const parsed=JSON.parse(text); setDb(parsed);} catch { alert('Archivo inválido'); } }
  const [impBusy,setImpBusy]=useState(false); const importRef=useRef<HTMLInputElement|null>(null);
  const perKidProgress = useMemo(()=>{ const map:Record<string,{done:number; total:number}>={}; db.kids.forEach(k=> map[k.id]={done:0,total:0}); db.chores.forEach(ch=>{ if(!choresForDay(ch,today)) return; db.kids.forEach(k=>{ if(!ch.asignadoA.includes(k.id)) return; map[k.id].total+=1; const sub=getSubmission(db,dateKey,k.id,ch.id); const countAsDone = sub && (sub.status==='hecha'||sub.status==='aprobada'); if(countAsDone) map[k.id].done+=1; }); }); return map; },[db,dateKey]);
  return <div className='grid gap-6'>
    <Section title='Panel de administrador' right={<div className='flex items-center gap-2'>
      <Button onClick={exportJSON}><Download className='h-4 w-4'/> Exportar</Button>
      <input ref={importRef} type='file' accept='application/json' className='hidden' onChange={async e=>{ const f=e.target.files?.[0]; if(!f) return; setImpBusy(true); try { await importJSON(f);} finally { setImpBusy(false); if(importRef.current) importRef.current.value=''; }}} />
      <Button onClick={()=>importRef.current?.click()} disabled={impBusy} variant='outline'>{impBusy? <Loader2 className='h-4 w-4 animate-spin'/> : <UploadCloud className='h-4 w-4'/>} Importar</Button>
      <Button variant='outline' onClick={()=> { if(confirm('¿Restablecer datos de ejemplo?')) setDb(seedDB()); }}><RefreshCw className='h-4 w-4'/> Reset demo</Button>
    </div>}>
      <Card>
        <div className='grid md:grid-cols-3 gap-4'>
          <div>
            <h3 className='font-medium mb-2'>Añadir niño</h3>
            <div className='flex items-center gap-2'>
              <Input placeholder='Nombre del niño' value={kidNombre} onChange={e=>setKidNombre(e.target.value)} />
              <Button onClick={addKid}><Plus className='h-4 w-4'/>Agregar</Button>
            </div>
            <div className='mt-3 flex flex-wrap gap-2'>
              {db.kids.map(k=> <span key={k.id} className='px-3 py-1 rounded-full bg-gray-100 text-sm'>{k.nombre}</span>)}
            </div>
          </div>
          <div className='md:col-span-2'>
            <h3 className='font-medium mb-2'>Crear tarea</h3>
            <div className='grid sm:grid-cols-2 gap-3'>
              <Input placeholder='Título (p.ej. Lavar platos)' value={choreDraft.titulo||''} onChange={e=>setChoreDraft(d=>({...d,titulo:e.target.value}))} />
              <Input placeholder='Hora límite (opcional, HH:MM)' value={choreDraft.horaLimite||''} onChange={e=>setChoreDraft(d=>({...d,horaLimite:e.target.value}))} />
              <Textarea placeholder='Descripción (opcional)' value={choreDraft.descripcion||''} onChange={e=>setChoreDraft(d=>({...d,descripcion:e.target.value}))} />
              <div className='grid gap-2'>
                <label className='text-sm'>Frecuencia</label>
                <Select value={choreDraft.frecuencia||'diaria'} onChange={v=>setChoreDraft(d=>({...d,frecuencia:v as Frequency}))}>
                  <option value='diaria'>Diaria</option>
                  <option value='semanal'>Semanal</option>
                  <option value='una_vez'>Una vez</option>
                </Select>
              </div>
              {choreDraft.frecuencia==='semanal' && <div className='sm:col-span-2'>
                <label className='text-sm'>Días de la semana</label>
                <div className='mt-2 flex flex-wrap gap-2'>
                  {WEEKDAY_LABELS.map((lbl,idx)=> <button key={idx} onClick={()=>{ const arr=new Set(choreDraft.diasSemana||[]); if(arr.has(idx)) arr.delete(idx); else arr.add(idx); setChoreDraft(d=>({...d,diasSemana:Array.from(arr).sort((a,b)=>a-b)})); }} className={`px-3 py-1 rounded-full text-sm border ${choreDraft.diasSemana?.includes(idx)?'bg-black text-white':'bg-white'}`}>{lbl}</button>)}
                </div>
              </div>}
              <div className='sm:col-span-2'>
                <label className='text-sm'>Asignar a</label>
                <div className='mt-2 flex flex-wrap gap-2'>
                  {db.kids.map(k=> <button key={k.id} onClick={()=>{ const set=new Set(choreDraft.asignadoA||[]); if(set.has(k.id)) set.delete(k.id); else set.add(k.id); setChoreDraft(d=>({...d, asignadoA:Array.from(set)})); }} className={`px-3 py-1 rounded-full text-sm border ${choreDraft.asignadoA?.includes(k.id)?'bg-black text-white':'bg-white'}`}>{k.nombre}</button>)}
                </div>
              </div>
              <div className='sm:col-span-2'>
                <Toggle checked={!!choreDraft.requiereAprobacion} onChange={v=>setChoreDraft(d=>({...d,requiereAprobacion:v}))} label='Requiere aprobación del adulto (opcional)' />
              </div>
              <div className='sm:col-span-2 flex items-center gap-2'>
                <Button onClick={addChore}><Plus className='h-4 w-4'/>Crear tarea</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Section>
    <Section title='Tareas creadas'>
      <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-3'>
        {db.chores.map(ch=> <Card key={ch.id}><div className='flex items-start justify-between gap-2'><div><div className='font-medium'>{ch.titulo}</div>{ch.descripcion && <div className='text-sm text-gray-600 mt-1'>{ch.descripcion}</div>}</div><Button variant='destructive' onClick={()=>deleteChore(ch.id)}><Trash2 className='h-4 w-4'/></Button></div><div className='mt-2 flex flex-wrap gap-2 text-xs'><Badge>{ch.frecuencia==='diaria'? 'Diaria' : ch.frecuencia==='semanal'? `Semanal ${(ch.diasSemana||[]).map(d=>WEEKDAY_LABELS[d]).join(',')||'-'}` : 'Una vez'}</Badge>{ch.horaLimite && <Badge>Limite {ch.horaLimite}</Badge>}{ch.requiereAprobacion && <Badge>Con aprobación</Badge>}<Badge>{(ch.asignadoA||[]).length} asignado(s)</Badge></div></Card>)}
      </div>
    </Section>
    <Section title={`Progreso de hoy (${WEEKDAY_LONG[today.getDay()]} ${dateKey})`}>
      <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-3'>
        {db.kids.map(k=>{ const prog=perKidProgress[k.id]||{done:0,total:0}; const pct=prog.total? Math.round(100*prog.done/prog.total):0; return <Card key={k.id}><div className='flex items-center justify-between'><div className='font-medium'>{k.nombre}</div><div className='text-sm text-gray-600'>{prog.done}/{prog.total} ({pct}%)</div></div><div className='mt-3 grid gap-2'>{db.chores.filter(ch=> ch.asignadoA.includes(k.id) && choresForDay(ch,today)).map(ch=>{ const sub=getSubmission(db,dateKey,k.id,ch.id); return <div key={ch.id} className='flex items-center justify-between rounded-xl border p-2'><div className='text-sm'><div className='font-medium'>{ch.titulo}</div><div className='text-xs text-gray-600'>{sub? (sub.status==='aprobada'? 'Aprobada' : sub.status==='hecha'? 'Hecha' : sub.status==='rechazada'? 'Rechazada' : 'Pendiente'): 'Sin entregar'}</div></div><div className='flex items-center gap-2'>{sub?.fotoDataUrl && <Button variant='outline' onClick={()=> window.open(sub.fotoDataUrl,'_blank')!}><ImageIcon className='h-4 w-4'/></Button>}{sub && ch.requiereAprobacion && sub.status!=='aprobada' && <><Button onClick={()=>approve(dateKey,k.id,ch.id)}><ShieldCheck className='h-4 w-4'/> Aprobar</Button><Button variant='outline' onClick={()=>reject(dateKey,k.id,ch.id)}><X className='h-4 w-4'/> Rechazar</Button></>}</div></div>; })}</div></Card>; })}
      </div>
    </Section>
  </div>; };

// Kid Panel
const KidPanel: React.FC<{db:DB; setDb:(n:DB)=>void}> = ({db,setDb})=>{ const [kidId,setKidId]=useState<string>(db.kids[0]?.id||''); const [note,setNote]=useState(''); const dateKey=todayKey(); const today=new Date(); const choresToday=useMemo(()=>{ if(!kidId) return []; return db.chores.filter(c=> c.asignadoA.includes(kidId) && choresForDay(c,today)); },[db,kidId]); async function handleUpload(ch:Chore,fileDataUrl:string){ const sub0=getSubmission(db,dateKey,kidId,ch.id); const status:SubmissionStatus = ch.requiereAprobacion? 'pendiente' : 'hecha'; const sub:Submission={ status, fotoDataUrl:fileDataUrl, timestamp:Date.now(), nota: note || sub0?.nota }; setDb(setSubmission(db,dateKey,kidId,ch.id,sub)); setNote(''); } function borrar(ch:Chore){ if(!confirm('¿Eliminar esta entrega (foto) y marcar como no hecha?')) return; setDb(removeSubmission(db,dateKey,kidId,ch.id)); }
  return <div className='grid gap-6'>
    <Section title='Soy el niño' right={<Badge>Hoy: {WEEKDAY_LONG[today.getDay()]} {dateKey}</Badge>}>
      <Card>
        <div className='grid sm:grid-cols-3 gap-3 items-end'>
          <div className='sm:col-span-2'>
            <label className='text-sm'>Selecciona tu perfil</label>
            <Select value={kidId} onChange={v=>setKidId(v)}>{db.kids.map(k=> <option key={k.id} value={k.id}>{k.nombre}</option>)}</Select>
          </div>
          <div className='sm:col-span-1'>
            <label className='text-sm'>Nota para papá/mamá (opcional)</label>
            <Input placeholder='Ej: ya limpié la mesa' value={note} onChange={e=>setNote(e.target.value)} />
          </div>
        </div>
      </Card>
    </Section>
    <Section title='Mis tareas de hoy'>
      {choresToday.length===0? <Card><div className='text-sm text-gray-600'>No tienes tareas asignadas hoy. 🎉</div></Card> : <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-3'>
        {choresToday.map(ch=>{ const sub=getSubmission(db,dateKey,kidId,ch.id); const status=sub?.status||'sin_entregar'; const estadoLabel=sub? (sub.status==='aprobada'? 'Aprobada' : sub.status==='hecha'? 'Hecha' : sub.status==='rechazada'? 'Rechazada' : 'Pendiente de aprobación') : 'Sin entregar'; return <Card key={ch.id}><div className='flex items-start justify-between gap-2'><div><div className='font-medium'>{ch.titulo}</div>{ch.descripcion && <div className='text-sm text-gray-600 mt-1'>{ch.descripcion}</div>}{ch.horaLimite && <div className='text-xs text-gray-500 mt-1'>Hora límite: {ch.horaLimite}</div>}</div>{(status==='hecha'||status==='aprobada') && <span className='inline-flex items-center gap-1 text-green-700 text-sm'><CheckCircle2 className='h-4 w-4'/> Hecha</span>}</div><div className='mt-3 flex items-center gap-2'><PhotoUpload onImage={url=>handleUpload(ch,url)} existing={sub?.fotoDataUrl} />{sub?.fotoDataUrl && <Button variant='outline' onClick={()=>borrar(ch)}><Trash2 className='h-4 w-4'/> Borrar entrega</Button>}</div><div className='mt-2 text-xs text-gray-600'>Estado: {estadoLabel}</div>{sub?.timestamp && <div className='text-xs text-gray-500'>Entregado: {new Date(sub.timestamp).toLocaleTimeString()}</div>}</Card>; })}
      </div>}
    </Section>
  </div>; };

// App
const App: React.FC = ()=>{ const {db,setDb}=useLocalDB(); const [tab,setTab]=useState<'admin'|'kid'>('admin'); return <div className='min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-neutral-950 dark:to-neutral-900 text-neutral-900 dark:text-neutral-100'>
  <div className='max-w-6xl mx-auto p-4 md:p-6'>
    <header className='flex items-center justify-between mb-6'>
      <div className='flex items-center gap-3'>
        <Wrench className='h-6 w-6'/>
        <h1 className='text-2xl font-bold'>Chores Familias</h1>
        <Badge>MVP</Badge>
      </div>
      <nav className='flex items-center gap-2'>
        <Button variant={tab==='admin'? 'default':'outline'} onClick={()=>setTab('admin')}><Settings className='h-4 w-4'/> Administrador</Button>
        <Button variant={tab==='kid'? 'default':'outline'} onClick={()=>setTab('kid')}><Users className='h-4 w-4'/> Niños</Button>
      </nav>
    </header>
    {tab==='admin'? <AdminPanel db={db} setDb={setDb}/> : <KidPanel db={db} setDb={setDb}/>} 
    <footer className='mt-10 text-xs text-gray-500'>
      <p>⚠️ Este demo guarda datos y fotos en tu navegador (LocalStorage). Para uso real con múltiples dispositivos, será necesario un backend (por ejemplo, Firebase Auth + Firestore + Storage).</p>
    </footer>
  </div>
</div>; };

export default App;
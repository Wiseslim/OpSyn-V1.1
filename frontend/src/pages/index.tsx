// ============================================================
// OPSYN — ALL PAGE COMPONENTS (fully wired to real API)
// Dashboard · Tasks · Staff · Outage · Onboarding
// Roles · Reports · Audit · Notifications · Projects
// ============================================================

import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.api';
import { staffApi } from '../api/staff.api';
import {
  outageApi, onboardingApi, notificationsApi,
  auditApi, reportsApi, projectsApi, rolesApi, orgApi, infrastructureApi, dashboardApi, settingsApi, activityApi,
  formsApi, webhooksApi,
} from '../api/index';
import DynamicForm from '../components/forms/DynamicForm';
const InfraMapView = lazy(() => import('./infrastructure/InfraMapView'));
import { useAuthStore } from '../store/auth.store';
import OpsynMark from '../components/brand/OpsynMark';
import { PoweredBy } from '../components/brand/OpsynMark';
import { useUIStore } from '../store/ui.store';

// ── Normalise backend responses: flat array OR paginated {items:[]} ──
const toArr = (d: any): any[] => Array.isArray(d) ? d : (d?.items ?? []);

// ── Shared design primitives ──────────────────────────────────
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background:'var(--bg2)',border:'1px solid var(--wire)',
  borderRadius:12,padding:16,position:'relative',overflow:'hidden',...extra,
});
const badge=(color:string,bg:string):React.CSSProperties=>({
  display:'inline-flex',alignItems:'center',gap:3,
  padding:'2px 7px',borderRadius:5,fontSize:11,fontWeight:600,color,background:bg,
});
const dot:React.CSSProperties={width:5,height:5,borderRadius:'50%',background:'currentColor',flexShrink:0};

function Btn({variant='ghost',onClick,children,style,disabled}:any){
  const bg=variant==='brand'?'var(--brand)':variant==='rose'?'rgba(248,113,113,.15)':
           variant==='jade'?'rgba(74,222,128,.15)':variant==='amber'?'rgba(251,191,36,.12)':'rgba(255,255,255,.05)';
  const col=variant==='brand'?'#050810':variant==='rose'?'var(--rose)':
            variant==='jade'?'var(--green)':variant==='amber'?'var(--amber)':'var(--chalk2)';
  return(
    <button disabled={disabled} onClick={onClick} style={{
      display:'inline-flex',alignItems:'center',gap:5,
      padding:'6px 13px',borderRadius:8,fontSize:12,fontWeight:600,
      cursor:disabled?'not-allowed':'pointer',fontFamily:'var(--font)',
      transition:'all .15s',whiteSpace:'nowrap',opacity:disabled?0.5:1,
      background:bg,color:col,border:variant==='ghost'?'1px solid var(--wire2)':'none',
      boxShadow:variant==='brand'?'0 0 16px rgba(6,182,212,.25)':'none',...style,
    }}>{children}</button>
  );
}

function Inp({label,value,onChange,type='text',placeholder,id}:any){
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return(
    <div style={{marginBottom:14}}>
      <label htmlFor={inputId} style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>{label}</label>
      <input id={inputId} name={inputId} type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none'}}/>
    </div>
  );
}

function Sel({label,value,onChange,options,id}:{label:string;value:string;onChange:(v:string)=>void;options:{label:string;value:string}[];id?:string}){
  const selectId = id || label.toLowerCase().replace(/\s+/g, '-');
  return(
    <div style={{marginBottom:14}}>
      <label htmlFor={selectId} style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>{label}</label>
      <select id={selectId} name={selectId} value={value} onChange={e=>onChange(e.target.value)}
        style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none'}}>
        <option value="">— {label} —</option>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Pbar({fill,pct}:{fill:string;pct:number}){
  return(
    <div style={{background:'var(--bg4)',borderRadius:3,height:4,overflow:'hidden'}}>
      <div style={{width:`${pct}%`,height:'100%',borderRadius:3,background:fill,transition:'width .8s cubic-bezier(.34,1.56,.64,1)'}}/>
    </div>
  );
}

function SectionHeader({title,sub,action,onAction}:any){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
      <div>
        <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>{title}</div>
        {sub&&<div style={{fontSize:11,color:'var(--chalk3)',marginTop:2}}>{sub}</div>}
      </div>
      {action&&<Btn onClick={onAction} style={{fontSize:11,padding:'4px 10px'}}>{action}</Btn>}
    </div>
  );
}

function KpiCard({label,value,delta,deltaUp,color,pct,pfill}:any){
  return(
    <div style={card()}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(6,182,212,.2),transparent)'}}/>
      <div style={{fontSize:10,fontWeight:600,color:'var(--chalk3)',marginBottom:5,letterSpacing:'.08em',textTransform:'uppercase'}}>{label}</div>
      <div style={{fontFamily:'var(--mono)',fontSize:26,fontWeight:600,color:color||'var(--chalk)'}}>{value}</div>
      {delta&&<div style={{fontSize:11,marginTop:3,color:deltaUp?'var(--green)':'var(--rose)'}}>{deltaUp?'↑':'↓'} {delta}</div>}
      {pct!==undefined&&pfill&&<div style={{marginTop:14}}><Pbar fill={pfill} pct={pct}/></div>}
    </div>
  );
}

function Modal({open,onClose,title,children,footer}:any){
  if(!open)return null;
  return(
    <div onClick={(e:any)=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(2,4,12,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,backdropFilter:'blur(4px)'}}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--wire2)',borderRadius:16,padding:22,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,.7)',scrollbarWidth:'none'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18,fontSize:15,fontWeight:800,color:'var(--chalk)',letterSpacing:'-.02em'}}>
          {title}
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--chalk3)',cursor:'pointer',fontSize:20,lineHeight:1}}>✕</button>
        </div>
        {children}
        {footer&&<div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:18,paddingTop:14,borderTop:'1px solid var(--wire)'}}>{footer}</div>}
      </div>
    </div>
  );
}

function useToast(){
  const {addToast}=useUIStore();
  return{
    success:(title:string,message?:string)=>addToast({type:'success',title,message}),
    error:  (title:string,message?:string)=>addToast({type:'error',title,message}),
    info:   (title:string,message?:string)=>addToast({type:'info',title,message}),
  };
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════
export function DashboardPage(){
  const navigate=useNavigate();
  const user=useAuthStore(s=>s.user);
  const firstName=user?.username?.split('_')[0]??'there';

  const {data:kpi}       =useQuery({queryKey:['dashboard','summary'],queryFn:()=>dashboardApi.getSummary(),refetchInterval:30000});
  const {data:board}     =useQuery({queryKey:['tasks','board'],queryFn:()=>tasksApi.getBoard(),refetchInterval:60000});
  const {data:outages}   =useQuery({queryKey:['outages','live'],queryFn:()=>outageApi.getLive(),refetchInterval:30000});
  const {data:onboarding}=useQuery({queryKey:['onboarding','pending'],queryFn:()=>onboardingApi.list({status:'pending'})});

  const k=kpi as any;

  const totalStaff     =k?.staff?.total??0;
  const pendingOnboard =k?.staff?.pending_onboarding??toArr(onboarding).length;
  const liveOutages    =k?.outages?.live??toArr(outages).length;
  const openTasks      =k?.tasks?.open??0;
  const overdueTasks   =k?.tasks?.overdue??0;
  const uptimePct      =k?.infrastructure?.network_uptime_pct??100;
  const totalNodes     =k?.infrastructure?.total_nodes??0;
  const activeNodes    =k?.infrastructure?.active_nodes??0;
  const unread         =k?.notifications?.unread??0;
  const activeProjects =k?.projects?.active??0;

  const hour=new Date().getHours();
  const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{display:'flex',alignItems:'center',overflow:'hidden',background:'linear-gradient(135deg,rgba(74,222,128,.04),rgba(6,182,212,.04))',borderBottom:'1px solid var(--wire)',padding:'8px 20px',fontSize:11,flexShrink:0}}>
        {[
          {val:String(totalStaff),      label:'Active Personnel',   color:'var(--cyan)'},
          {val:String(liveOutages),     label:'Live Outages',       color:liveOutages>0?'var(--rose)':'var(--chalk3)'},
          {val:String(openTasks),       label:'Open Tasks',         color:'var(--amber)'},
          {val:`${uptimePct}%`,         label:'Network Uptime',     color:uptimePct>=99?'var(--green)':'var(--amber)'},
          {val:String(k?.staff?.pending_onboarding??0), label:'Pending Onboarding', color:'var(--violet)'},
        ].map((item,i,arr)=>(
          <div key={item.label} style={{display:'flex',alignItems:'center',gap:8,paddingRight:20,marginRight:20,borderRight:i<arr.length-1?'1px solid var(--wire)':'none'}}>
            <span style={{fontFamily:'var(--mono)',fontWeight:600,fontSize:13,color:item.color}}>{item.val}</span>
            <span style={{color:'var(--chalk3)'}}>{item.label}</span>
          </div>
        ))}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,fontSize:10,color:'var(--chalk3)'}}>
          <span style={{width:5,height:5,borderRadius:'50%',background:'var(--green)',display:'block'}}/>
          Live · 30s refresh
        </div>
      </div>

      <div style={{padding:20}}>
        <div style={{marginBottom:22}}>
          <div style={{fontFamily:'var(--font)',fontSize:20,fontWeight:800,color:'var(--chalk)',letterSpacing:'-.03em'}}>{greeting}, {firstName}</div>
          <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>Opsyn Command Center · Powered by SlimTech</div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:18}}>
          <KpiCard label="Active Personnel" value={totalStaff}    color="var(--chalk)"/>
          <KpiCard label="Open Tasks"       value={openTasks}     color="var(--cyan)"  delta={overdueTasks>0?`${overdueTasks} overdue`:undefined} pct={overdueTasks>0?Math.round((overdueTasks/Math.max(openTasks,1))*100):0} pfill="linear-gradient(90deg,#06b6d4,#3b82f6)"/>
          <KpiCard label="Active Outages"   value={liveOutages}   color={liveOutages>0?'var(--rose)':'var(--green)'} delta={liveOutages>0?'needs attention':'all clear'} deltaUp={liveOutages===0}/>
          <KpiCard label="Network Uptime"   value={`${uptimePct}%`} color={uptimePct>=99?'var(--green)':'var(--amber)'} delta={totalNodes>0?`${activeNodes}/${totalNodes} nodes`:'no nodes registered'} deltaUp={uptimePct>=99} pct={uptimePct} pfill="linear-gradient(90deg,#4ade80,#22d3a0)"/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:14}}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={card()}>
              <SectionHeader title="Task Pipeline" sub="Real-time operational task status" action="Open Board →" onAction={()=>navigate('/tasks')}/>
              <div style={{display:'flex',gap:10,marginBottom:14}}>
                {[
                  {n:overdueTasks,                             label:'Overdue',   color:'var(--rose)'},
                  {n:(board as any)?.today?.length??0,         label:'Due Today',  color:'var(--amber)'},
                  {n:(board as any)?.this_week?.length??0,     label:'This Week',  color:'var(--cyan)'},
                  {n:(board as any)?.backlog?.length??0,       label:'Backlog',    color:'var(--chalk3)'},
                ].map(item=>(
                  <div key={item.label} style={{flex:1,padding:'10px 12px',background:'var(--bg3)',borderRadius:8,borderLeft:`3px solid ${item.color}`}}>
                    <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:600,color:item.color}}>{item.n}</div>
                    <div style={{fontSize:9,color:'var(--chalk3)',marginTop:2,textTransform:'uppercase',letterSpacing:'.08em'}}>{item.label}</div>
                  </div>
                ))}
              </div>
              {[...((board as any)?.overdue??[]),...((board as any)?.today??[]),...((board as any)?.this_week??[])].slice(0,3).map((t:any,i:number)=>(
                <div key={t.id??i} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:5}}>
                    <span style={{color:'var(--chalk)'}}>{t.title}</span>
                    <span style={badge(t.priority==='critical'?'var(--rose)':t.priority==='high'?'var(--amber)':'var(--cyan)',t.priority==='critical'?'rgba(248,113,113,.1)':t.priority==='high'?'rgba(251,191,36,.1)':'rgba(6,182,212,.1)')}>{t.priority}</span>
                  </div>
                  <Pbar fill="var(--brand)" pct={t.status==='done'?100:t.status==='in_review'?80:t.status==='in_progress'?50:10}/>
                </div>
              ))}
              {openTasks===0&&<div style={{textAlign:'center',color:'var(--chalk3)',fontSize:12,padding:16}}>No open tasks. Create your first task from the Task Board.</div>}
            </div>

            {activeProjects>0&&(
              <div style={card({cursor:'pointer'})} onClick={()=>navigate('/projects')}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>Active Projects</div>
                    <div style={{fontSize:11,color:'var(--chalk3)',marginTop:2}}>Currently in pipeline</div>
                  </div>
                  <div style={{fontFamily:'var(--mono)',fontSize:28,fontWeight:600,color:'var(--cyan)'}}>{activeProjects}</div>
                </div>
              </div>
            )}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={card()}>
              <SectionHeader title="Live Outages" action="Monitor →" onAction={()=>navigate('/outage')}/>
              {toArr(outages).length===0
                ?<div style={{fontSize:12,color:'var(--green)',textAlign:'center',padding:12}}>✓ No active outages</div>
                :toArr(outages).slice(0,2).map((o:any)=>(
                  <div key={o.id??o.reference} style={{padding:'10px 12px',marginBottom:8,background:o.severity==='critical'?'rgba(248,113,113,.06)':'rgba(251,191,36,.06)',border:`1px solid ${o.severity==='critical'?'rgba(248,113,113,.2)':'rgba(251,191,36,.2)'}`,borderRadius:8,borderLeft:`3px solid ${o.severity==='critical'?'var(--rose)':'var(--amber)'}`}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--chalk)',marginBottom:3}}>{o.title}</div>
                    <div style={{fontSize:10,color:'var(--chalk3)'}}>{o.reference}</div>
                    <div style={{marginTop:5}}><span style={badge(o.severity==='critical'?'var(--rose)':'var(--amber)',o.severity==='critical'?'rgba(248,113,113,.1)':'rgba(251,191,36,.1)')}>{o.severity}</span></div>
                  </div>
                ))
              }
            </div>

            <div style={card()}>
              <SectionHeader title="Pending Onboarding" action="Review →" onAction={()=>navigate('/onboarding')}/>
              {toArr(onboarding).slice(0,3).length===0
                ?<div style={{fontSize:12,color:'var(--chalk3)',textAlign:'center',padding:8}}>No pending requests</div>
                :toArr(onboarding).slice(0,3).map((r:any)=>(
                  <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--wire)'}}>
                    <div>
                      <div style={{fontSize:12,color:'var(--chalk)',fontWeight:500}}>{r.proposed_first_name} {r.proposed_last_name}</div>
                      <div style={{fontSize:10,color:'var(--chalk3)'}}>{r.approval_status}</div>
                    </div>
                    <span style={badge(r.approval_status==='pending'?'var(--amber)':'var(--rose)',r.approval_status==='pending'?'rgba(251,191,36,.1)':'rgba(248,113,113,.1)')}>{r.approval_status}</span>
                  </div>
                ))
              }
            </div>

            {unread>0&&(
              <div style={{...card(),cursor:'pointer'}} onClick={()=>navigate('/notifications')}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:'var(--cyan)',boxShadow:'0 0 8px rgba(6,182,212,.5)'}}/>
                  <span style={{fontSize:12,fontWeight:600,color:'var(--cyan)'}}>{unread} unread notification{unread>1?'s':''}</span>
                </div>
                <div style={{fontSize:11,color:'var(--chalk3)',marginTop:4}}>Click to view →</div>
              </div>
            )}

            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:16,background:'var(--bg2)',borderRadius:12,border:'1px solid var(--wire)'}}>
              <OpsynMark size={28}/>
              <div style={{textAlign:'center'}}>
                <div style={{fontWeight:800,fontSize:13,background:'var(--brand)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Opsyn</div>
                <div style={{fontSize:9,color:'var(--chalk3)',letterSpacing:'.08em',textTransform:'uppercase',marginTop:2}}>Operational Intelligence Platform</div>
                <div style={{marginTop:4,display:'flex',justifyContent:'center'}}><PoweredBy/></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TASKS — KANBAN BOARD
// ════════════════════════════════════════════════════════════════
export function TasksPage(){
  const [view,setView]          =useState<'kanban'|'gantt'>('kanban');
  const [panelOpen,setPanel]    =useState(false);
  const [newTask,setNewTask]    =useState(false);
  const [selectedTask,setTask]  =useState<any>(null);
  const [form,setForm]          =useState({title:'',description:'',priority:'medium',status:'backlog',deadline:'',tags:'',department_id:''});
  const toast=useToast();
  const qc=useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn:  () => orgApi.getDepartments(),
    staleTime: 5 * 60 * 1000,
  });

  const {data:board,isLoading}=useQuery({queryKey:['tasks','board',form.department_id],queryFn:()=>tasksApi.getBoard({ dept_id: form.department_id || undefined }),refetchInterval:60000});
  const {data:myTasks}        =useQuery({queryKey:['tasks','my'],queryFn:tasksApi.getMyTasks});

  const createTask=useMutation({
    mutationFn:()=>tasksApi.create({
      title: form.title,
      description: form.description,
      priority: form.priority as any,
      status: form.status as any,
      deadline: form.deadline || undefined,
      department_id: form.department_id || undefined,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
    }),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['tasks']});setNewTask(false);setForm({title:'',description:'',priority:'medium',status:'backlog',deadline:'',tags:'',department_id:''});toast.success('Task created');},
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });
  const moveTask=useMutation({
    mutationFn:({id,status}:{id:string;status:string})=>tasksApi.updateStatus(id,status),
    onSuccess:()=>qc.invalidateQueries({queryKey:['tasks']}),
    onError:()=>toast.error('Failed to update task'),
  });

  const COLS=[
    {key:'overdue',    label:'OVERDUE',    color:'var(--rose)',  bg:'rgba(248,113,113,.08)',border:'rgba(248,113,113,.2)'},
    {key:'today',      label:'DUE TODAY',  color:'var(--amber)', bg:'rgba(251,191,36,.08)', border:'rgba(251,191,36,.2)'},
    {key:'this_week',  label:'THIS WEEK',  color:'var(--cyan)',  bg:'rgba(6,182,212,.08)',  border:'rgba(6,182,212,.2)'},
    {key:'next_week',  label:'NEXT WEEK',  color:'var(--green)', bg:'rgba(74,222,128,.08)', border:'rgba(74,222,128,.2)'},
    {key:'no_deadline',label:'NO DEADLINE',color:'var(--chalk3)',bg:'rgba(255,255,255,.03)',border:'var(--wire2)'},
    {key:'backlog',    label:'BACKLOG',    color:'var(--violet)',bg:'rgba(167,139,250,.08)',border:'rgba(167,139,250,.2)'},
  ];
  const PC:Record<string,string>={critical:'var(--rose)',high:'var(--amber)',medium:'var(--cyan)',low:'var(--green)'};

  return(
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      {/* Tab bar */}
      <div style={{display:'flex',borderBottom:'1px solid var(--wire)',flexShrink:0,padding:'0 20px',background:'var(--bg2)',alignItems:'center'}}>
        {['Deadline Board','Gantt','List','Calendar'].map((t,i)=>(
          <div key={t} onClick={()=>{if(i===0)setView('kanban');if(i===1)setView('gantt');}}
            style={{padding:'11px 14px',fontSize:12,fontWeight:((i===0&&view==='kanban')||(i===1&&view==='gantt'))?700:400,
              color:(i===0&&view==='kanban')||(i===1&&view==='gantt')?'var(--cyan)':'var(--chalk3)',
              cursor:'pointer',borderBottom:(i===0&&view==='kanban')||(i===1&&view==='gantt')?'2px solid var(--cyan)':'2px solid transparent',
              marginBottom:-1,display:'flex',alignItems:'center',gap:5}}>
            {t}
            {t==='Deadline Board'&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4,background:'rgba(34,211,238,.12)',color:'var(--cyan)'}}>{(board as any)?.total??0}</span>}
          </div>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:7,padding:'6px 0',alignItems:'center'}}>
          <Btn onClick={()=>setPanel(p=>!p)} style={{fontSize:11,padding:'4px 10px'}}>☰ My List</Btn>
          <Btn variant="brand" onClick={()=>setNewTask(true)} style={{fontSize:11,padding:'5px 12px'}}>+ New Task</Btn>
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 20px',flexShrink:0,borderBottom:'1px solid var(--wire)',background:'var(--bg2)'}}>
        <span style={{fontSize:11,color:'var(--chalk3)'}}>
          {isLoading?'Loading…':`${(board as any)?.total??0} tasks`}
          {(((board as any)?.overdue)||[]).length>0&&<span style={{color:'var(--rose)',marginLeft:6}}>· {((board as any)?.overdue||[]).length} overdue</span>}
        </span>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {view==='kanban'&&(
          <div style={{display:'flex',gap:12,overflow:'auto',flex:1,padding:'16px 20px 20px',alignItems:'flex-start'}}>
            {COLS.map(col=>{
              const tasks:any[]=((board as any)?.[col.key])||[];
              return(
                <div key={col.key} style={{flexShrink:0,width:268}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderRadius:'12px 12px 0 0',background:col.bg,border:`1px solid ${col.border}`,borderBottom:'none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <div style={{width:20,height:20,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,background:`${col.color}22`,color:col.color}}>{tasks.length}</div>
                      <span style={{fontSize:11,fontWeight:800,letterSpacing:'.06em',color:col.color}}>{col.label}</span>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8,padding:'10px 8px',borderRadius:'0 0 12px 12px',background:'var(--bg3)',border:`1px solid ${col.border}`,borderTop:'none',minHeight:80}}>
                    {tasks.map((task:any)=>(
                      <div key={task.id} onClick={()=>setTask(task)}
                        style={{background:'var(--bg2)',border:'1px solid var(--wire2)',borderRadius:12,padding:'11px 11px 11px 14px',cursor:'pointer',transition:'all .2s',position:'relative'}}>
                        <div style={{position:'absolute',top:0,bottom:0,left:0,width:3,borderRadius:'12px 0 0 12px',background:PC[task.priority]||'var(--chalk3)'}}/>
                        <div style={{fontSize:12,fontWeight:500,color:'var(--chalk)',lineHeight:1.4,marginBottom:8}}>{task.title}</div>
                        {task.tags?.length>0&&(
                          <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
                            {task.tags.map((t:string)=><span key={t} style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'var(--bg4)',color:'var(--chalk3)'}}>#{t}</span>)}
                          </div>
                        )}
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--chalk3)'}}>
                            {col.key==='today'?'Today':col.key==='overdue'?'Overdue':col.key==='no_deadline'?'No deadline':col.key==='backlog'?'Backlog':task.deadline?new Date(task.deadline).toLocaleDateString('en-GB',{month:'short',day:'numeric'}):'—'}
                          </span>
                          {task.comment_count>0&&<span style={{fontSize:10,color:'var(--chalk3)'}}>💬 {task.comment_count}</span>}
                        </div>
                      </div>
                    ))}
                    {tasks.length===0&&col.key!=='overdue'&&(
                      <div style={{padding:'12px 8px',textAlign:'center',fontSize:11,color:'var(--chalk3)',border:'1px dashed var(--wire2)',borderRadius:8}}>No tasks here</div>
                    )}
                    <div onClick={()=>setNewTask(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',borderRadius:8,color:'var(--chalk3)',fontSize:11,cursor:'pointer',border:'1px dashed var(--wire2)'}}>+ Add task</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view==='gantt'&&(
          <div style={{flex:1,overflow:'auto',padding:20}}>
            <div style={card()}>
              <SectionHeader title="Gantt Timeline" sub="Task schedule by deadline"/>
              {[...((board as any)?.overdue??[]),...((board as any)?.today??[]),...((board as any)?.this_week??[]),...((board as any)?.next_week??[])].slice(0,12).map((t:any,i:number)=>(
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--wire)'}}>
                  <div style={{width:180,flexShrink:0,fontSize:12,color:'var(--chalk)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                  <div style={{flex:1,position:'relative',height:22}}>
                    <div style={{position:'absolute',left:`${(i*10)%55}%`,width:`${20+(i*7)%40}%`,height:14,borderRadius:4,top:4,background:['var(--rose)','var(--amber)','var(--cyan)','var(--green)','var(--violet)'][i%5],fontSize:9,color:'#050810',display:'flex',alignItems:'center',padding:'0 6px',fontWeight:700}}>{t.priority}</div>
                  </div>
                </div>
              ))}
              {((board as any)?.total??0)===0&&<div style={{textAlign:'center',color:'var(--chalk3)',fontSize:12,padding:20}}>No tasks to display</div>}
            </div>
          </div>
        )}

        {panelOpen&&(
          <div style={{width:290,minWidth:290,background:'var(--bg2)',borderLeft:'1px solid var(--wire)',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid var(--wire)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>My Task List</span>
              <Btn onClick={()=>setPanel(false)} style={{padding:'3px 8px',fontSize:11}}>✕</Btn>
            </div>
            <div style={{padding:'12px 14px',overflowY:'auto',flex:1}}>
              {toArr(myTasks).map((t:any)=>(
                <div key={t.id} onClick={()=>setTask(t)} style={{padding:'10px 0',borderBottom:'1px solid var(--wire)',cursor:'pointer'}}>
                  <div style={{fontSize:12,fontWeight:500,color:'var(--chalk)',marginBottom:6,lineHeight:1.4}}>{t.title}</div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontSize:10,color:'var(--chalk3)'}}>{t.deadline?new Date(t.deadline).toLocaleDateString('en-GB',{month:'short',day:'numeric'}):'No date'}</span>
                    <span style={{...badge('var(--chalk3)','var(--bg4)'),fontSize:10,padding:'2px 7px',borderRadius:4}}>{(t.deadline_bucket??'backlog').replace('_',' ')}</span>
                  </div>
                </div>
              ))}
              {toArr(myTasks).length===0&&<div style={{textAlign:'center',color:'var(--chalk3)',fontSize:12,padding:20}}>No tasks assigned to you</div>}
            </div>
          </div>
        )}
      </div>

      {/* New Task Modal */}
      <Modal open={newTask} onClose={()=>setNewTask(false)} title="Create New Task"
        footer={<><Btn onClick={()=>setNewTask(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>createTask.mutate()} disabled={!form.title||!form.department_id||createTask.isPending}>{createTask.isPending?'Creating…':'Create Task'}</Btn></>}>
        <Inp label="Task Title *" value={form.title} onChange={(v:string)=>setForm(f=>({...f,title:v}))} placeholder="What needs to be done?"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Sel label="Priority" value={form.priority} onChange={v=>setForm(f=>({...f,priority:v}))} options={[{label:'Critical',value:'critical'},{label:'High',value:'high'},{label:'Medium',value:'medium'},{label:'Low',value:'low'}]}/>
          <Sel label="Status"   value={form.status}   onChange={v=>setForm(f=>({...f,status:v}))}   options={[{label:'Backlog',value:'backlog'},{label:'In Progress',value:'in_progress'},{label:'In Review',value:'in_review'},{label:'Done',value:'done'}]}/>
        </div>
        <Inp label="Deadline" type="date" value={form.deadline} onChange={(v:string)=>setForm(f=>({...f,deadline:v}))}/>
        <Sel label="Department" value={form.department_id} onChange={v=>setForm(f=>({...f,department_id:v}))} options={
          departments && departments.length ? departments.map((d:any)=>({label:d.name,value:d.id})) : [{label:'Loading departments…', value:''}]
        } />
        <Inp label="Tags (comma-separated)" value={form.tags} onChange={(v:string)=>setForm(f=>({...f,tags:v}))} placeholder="#noc, #urgent"/>
        <div style={{marginBottom:14}}>
          <label htmlFor="task-description" style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>Description</label>
          <textarea id="task-description" name="task-description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Task details…" rows={3}
            style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none',resize:'vertical'}}/>
        </div>
      </Modal>

      {/* Task Detail Modal */}
      {selectedTask&&(
        <Modal open={!!selectedTask} onClose={()=>setTask(null)} title={selectedTask.title}
          footer={<><Btn onClick={()=>setTask(null)}>Close</Btn><Btn variant="jade" onClick={()=>{moveTask.mutate({id:selectedTask.id,status:'done'});setTask(null);}}>✓ Mark Done</Btn></>}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
            <span style={badge(PC[selectedTask.priority]||'var(--chalk3)',`${PC[selectedTask.priority]||'var(--chalk3)'}22`)}>{selectedTask.priority}</span>
            <span style={badge('var(--cyan)','rgba(6,182,212,.1)')}>{selectedTask.status?.replace('_',' ')}</span>
            {selectedTask.deadline&&<span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--chalk2)',padding:'2px 8px',background:'var(--bg3)',borderRadius:5}}>{new Date(selectedTask.deadline).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>}
          </div>
          {selectedTask.description&&<p style={{fontSize:12,color:'var(--chalk2)',lineHeight:1.6,marginBottom:14}}>{selectedTask.description}</p>}
          <div>
            <div style={{fontSize:10,fontWeight:700,color:'var(--chalk3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.1em'}}>Move to status</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {['backlog','in_progress','in_review','done'].map(s=>(
                <Btn key={s} variant={selectedTask.status===s?'brand':'ghost'} onClick={()=>{moveTask.mutate({id:selectedTask.id,status:s});setTask({...selectedTask,status:s});}} style={{fontSize:11,padding:'4px 10px'}}>{s.replace('_',' ')}</Btn>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// STAFF LIST
// ════════════════════════════════════════════════════════════════
export function StaffListPage(){
  const navigate=useNavigate();
  const [search,setSearch]      =useState('');
  const [deptFilter,setDept]    =useState('');
  const [roleFilter,setRole]    =useState('');
  const [statusFilter,setStatus]=useState('');
  const [page,setPage]          =useState(1);
  const [deactivateTarget,setDeact]=useState<any>(null);
  const toast=useToast();
  const qc=useQueryClient();

  const {data,isLoading}=useQuery({
    queryKey:['staff','list',{search,deptFilter,roleFilter,statusFilter,page}],
    queryFn:()=>staffApi.list({search:search||undefined,dept_id:deptFilter||undefined,role_id:roleFilter||undefined,status:statusFilter||undefined,page,size:20}),
  } as any);
  const {data:depts}=useQuery({queryKey:['departments'],queryFn:()=>orgApi.getDepartments()});
  const {data:roles}=useQuery({queryKey:['roles'],queryFn:()=>rolesApi.getRoles()});

  const deactivate=useMutation({
    mutationFn:(id:string)=>staffApi.updateStatus(id,'inactive'),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['staff']});setDeact(null);toast.success('Staff deactivated');},
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });
  const activate=(id:string)=>staffApi.updateStatus(id,'active').then(()=>{qc.invalidateQueries({queryKey:['staff']});toast.success('Reactivated');});

  const items     =(data as any)?.items??[];
  const total     =(data as any)?.total??0;
  const totalPages=(data as any)?.total_pages??1;

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>Personnel Directory</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>{total} total staff members</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn style={{fontSize:11,padding:'5px 10px'}}>Export CSV</Btn>
            <Btn variant="brand" onClick={()=>navigate('/staff/new')} style={{fontSize:11,padding:'5px 12px'}}>+ Add Personnel</Btn>
          </div>
        </div>

        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'7px 12px',flex:1,maxWidth:280}}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="var(--chalk3)"><circle cx="5.5" cy="5.5" r="4" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <input id="staff-search" name="staff-search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Name, email, staff ID…" style={{background:'none',border:'none',outline:'none',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,width:'100%'}}/>
          </div>
          {([
            {id:'dept-filter',val:deptFilter,set:setDept, opts:toArr(depts).map((d:any)=>({label:d.name,value:d.id})),placeholder:'All Departments'},
            {id:'role-filter',val:roleFilter,set:setRole, opts:toArr(roles).map((r:any)=>({label:r.name,value:r.id})),placeholder:'All Roles'},
            {id:'status-filter',val:statusFilter,set:setStatus,opts:[{label:'Active',value:'active'},{label:'Inactive',value:'inactive'},{label:'Suspended',value:'suspended'}],placeholder:'All Statuses'},
          ] as any[]).map((f:any,i:number)=>(
            <select key={i} id={f.id} name={f.id} value={f.val} onChange={e=>{f.set(e.target.value);setPage(1);}} style={{background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,color:'var(--chalk2)',padding:'7px 10px',fontFamily:'var(--font)',fontSize:12,cursor:'pointer',outline:'none'}}>
              <option value="">{f.placeholder}</option>
              {f.opts.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
        </div>

        <div style={card({padding:0})}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>{['Personnel','Role','Department','Team','Region','Last Active','Status','Actions'].map(h=>(
                  <th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 14px',borderBottom:'1px solid var(--wire)'}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {isLoading
                  ?<tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>Loading personnel…</td></tr>
                  :items.length===0
                    ?<tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>No staff members found</td></tr>
                    :items.map((s:any)=>{
                      const p=s.staff_profile;
                      const r=s.role;
                      const initials=p?`${p.first_name?.[0]??''}${p.last_name?.[0]??''}`:s.username?.slice(0,2).toUpperCase();
                      return(
                        <tr key={s.id} style={{transition:'background .15s'}}>
                          <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}>
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              <div style={{width:28,height:28,borderRadius:'50%',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#050810',flexShrink:0}}>{initials}</div>
                              <div>
                                <div style={{fontWeight:500,color:'var(--chalk)',fontSize:12}}>{p?`${p.first_name} ${p.last_name}`:s.username}</div>
                                <div style={{fontSize:10,color:'var(--chalk3)'}}>{p?.staff_code} · {s.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge('var(--violet)','rgba(167,139,250,.1)')}>{r?.name??'—'}</span></td>
                          <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontWeight:500,color:'var(--chalk)',fontSize:12}}>{p?.department?.name??'—'}</td>
                          <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:12,color:'var(--chalk2)'}}>{p?.team?.name??'—'}</td>
                          <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:12,color:'var(--chalk2)'}}>{p?.region?.name??'—'}</td>
                          <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:12,color:'var(--chalk2)'}}>{s.last_login_at?new Date(s.last_login_at).toLocaleDateString('en-GB'):'—'}</td>
                          <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}>
                            <span style={badge(p?.status==='active'?'var(--green)':p?.status==='suspended'?'var(--rose)':'var(--amber)',p?.status==='active'?'rgba(74,222,128,.1)':p?.status==='suspended'?'rgba(248,113,113,.1)':'rgba(251,191,36,.1)')}><span style={dot}/>{p?.status??'active'}</span>
                          </td>
                          <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}>
                            <div style={{display:'flex',gap:4}}>
                              <Btn onClick={()=>navigate(`/staff/${s.id}`)} style={{padding:'3px 8px',fontSize:11}}>View</Btn>
                              {p?.status==='active'
                                ?<Btn variant="rose" onClick={()=>setDeact(s)} style={{padding:'3px 8px',fontSize:11}}>Deactivate</Btn>
                                :<Btn variant="jade" onClick={()=>activate(s.id)} style={{padding:'3px 8px',fontSize:11}}>Activate</Btn>
                              }
                            </div>
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderTop:'1px solid var(--wire)'}}>
            <div style={{fontSize:11,color:'var(--chalk3)'}}>Showing {((page-1)*20)+1}–{Math.min(page*20,total)} of {total}</div>
            <div style={{display:'flex',gap:4}}>
              <Btn onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:'3px 8px',fontSize:11}}>Prev</Btn>
              {Array.from({length:Math.min(5,totalPages)},(_,i)=>i+1).map(p=>(
                <Btn key={p} variant={p===page?'brand':'ghost'} onClick={()=>setPage(p)} style={{padding:'3px 8px',fontSize:11}}>{p}</Btn>
              ))}
              <Btn onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} style={{padding:'3px 8px',fontSize:11}}>Next</Btn>
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!deactivateTarget} onClose={()=>setDeact(null)} title="Confirm Deactivation"
        footer={<><Btn onClick={()=>setDeact(null)}>Cancel</Btn><Btn variant="rose" onClick={()=>deactivate.mutate(deactivateTarget.id)} disabled={deactivate.isPending}>{deactivate.isPending?'Deactivating…':'Deactivate'}</Btn></>}>
        <p style={{fontSize:13,color:'var(--chalk2)',lineHeight:1.6}}>Are you sure you want to deactivate <strong style={{color:'var(--chalk)'}}>{deactivateTarget?.staff_profile?.first_name} {deactivateTarget?.staff_profile?.last_name}</strong>? They will lose access immediately.</p>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// STAFF CREATE — 5-step wizard
// ════════════════════════════════════════════════════════════════
export function StaffCreatePage(){
  const navigate=useNavigate();
  const [step,setStep]=useState(0);
  const toast=useToast();
  const qc=useQueryClient();
  const [form,setForm]=useState<any>({first_name:'',last_name:'',email:'',phone:'',username:'',department_id:'',team_id:'',role_id:'',job_title:'',employment_type:'permanent',region_id:'',olt_domain:'',status:'active',invite_method:'email',specialization:'',work_location:'',notes:'',joined_at:'',end_date:''});

  const {data:depts}  =useQuery({queryKey:['departments'],queryFn:()=>orgApi.getDepartments()});
  const {data:teams}  =useQuery({queryKey:['teams',form.department_id],queryFn:()=>orgApi.getTeams(form.department_id),enabled:!!form.department_id});
  const {data:regions}=useQuery({queryKey:['regions'],queryFn:orgApi.getRegions});
  const {data:roles}  =useQuery({queryKey:['roles','assignable'],queryFn:()=>rolesApi.getRoles(true)});

  const set=(k:string,v:any)=>setForm((f:any)=>({...f,[k]:v}));

  const create=useMutation({
    mutationFn:()=>staffApi.create(form),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['staff']});toast.success('Account activated on Opsyn!','Powered by SlimTech');navigate('/staff');},
    onError:(e:any)=>toast.error('Failed to create staff',e?.detail||e?.message),
  });

  const STEPS=['Basic Info','Organisation','Access Control','Operational','Status'];
  const canNext=[
    form.first_name&&form.last_name&&form.email&&form.username,
    form.department_id&&form.role_id&&form.job_title,
    true,
    true,
    true,
  ];

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>Create New Personnel</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>Complete all sections to provision an Opsyn account</div>
          </div>
          <Btn onClick={()=>navigate('/staff')} style={{fontSize:11}}>← Back</Btn>
        </div>

        {/* Steps indicator */}
        <div style={{display:'flex',alignItems:'center',marginBottom:22,overflowX:'auto'}}>
          {STEPS.map((s,i)=>(
            <div key={s} style={{display:'flex',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:7,cursor:i<step?'pointer':'default'}} onClick={()=>i<step&&setStep(i)}>
                <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0,background:i<step?'var(--green)':i===step?'var(--brand)':'transparent',border:i<=step?'none':'2px solid var(--wire2)',color:i<=step?'#050810':'var(--chalk3)'}}>{i<step?'✓':i+1}</div>
                <span style={{fontSize:11,color:i===step?'var(--cyan)':i<step?'var(--green)':'var(--chalk3)',fontWeight:i===step?700:400,whiteSpace:'nowrap'}}>{s}</span>
              </div>
              {i<STEPS.length-1&&<div style={{flex:1,height:1,background:'var(--wire2)',minWidth:14,margin:'0 7px'}}/>}
            </div>
          ))}
        </div>

        <div style={card()}>
          <div style={{fontWeight:800,fontSize:14,color:'var(--chalk)',marginBottom:18,letterSpacing:'-.02em'}}>{STEPS[step]}</div>

          {step===0&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Inp label="First Name *"    value={form.first_name}  onChange={(v:string)=>set('first_name',v)}  placeholder="e.g. Olumide"/>
              <Inp label="Last Name *"     value={form.last_name}   onChange={(v:string)=>set('last_name',v)}   placeholder="e.g. Adesanya"/>
              <Inp label="Email Address *" type="email" value={form.email} onChange={(v:string)=>set('email',v)} placeholder="firstname.last@opsyn.ng"/>
              <Inp label="Phone Number"    value={form.phone}       onChange={(v:string)=>set('phone',v)}       placeholder="+234 801 000 0000"/>
              <Inp label="Username *"      value={form.username}    onChange={(v:string)=>set('username',v)}    placeholder="e.g. olumide.adesanya"/>
              <Inp label="Staff ID"        value={form.staff_code??''} onChange={(v:string)=>set('staff_code',v)} placeholder="Auto-generated if blank"/>
            </div>
          )}

          {step===1&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Sel label="Department *"      value={form.department_id}   onChange={v=>set('department_id',v)}  options={toArr(depts).map((d:any)=>({label:d.name,value:d.id}))}/>
              <Sel label="Team"              value={form.team_id}         onChange={v=>set('team_id',v)}        options={toArr(teams).map((t:any)=>({label:t.name,value:t.id}))}/>
              <Sel label="Role *"            value={form.role_id}         onChange={v=>set('role_id',v)}        options={toArr(roles).map((r:any)=>({label:`${r.name} (L${r.level})`,value:r.id}))}/>
              <Sel label="Employment Type"   value={form.employment_type} onChange={v=>set('employment_type',v)} options={[{label:'Permanent',value:'permanent'},{label:'Contract',value:'contract'},{label:'Intern',value:'intern'}]}/>
              <div style={{gridColumn:'1/-1'}}><Inp label="Job Title *" value={form.job_title} onChange={(v:string)=>set('job_title',v)} placeholder="e.g. Senior NOC Operator"/></div>
            </div>
          )}

          {step===2&&(
            <div>
              <Sel label="Scope Level" value={form.scope_level??'department'} onChange={v=>set('scope_level',v)} options={[{label:'Department',value:'department'},{label:'Team',value:'team'},{label:'Region',value:'region'},{label:'System-wide (Admin only)',value:'system'}]}/>
              <div style={{marginBottom:14}}>
                <label style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.1em'}}>Invite Method</label>
                <div style={{display:'flex',gap:20}}>
                  {['email','password'].map(m=>(
                    <label key={m} htmlFor={`invite-${m}`} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--chalk2)',cursor:'pointer'}}>
                      <input id={`invite-${m}`} type="radio" name="invite" checked={form.invite_method===m} onChange={()=>set('invite_method',m)}/>
                      {m==='email'?'Email invite link':'Temporary password'}
                    </label>
                  ))}
                </div>
              </div>
              {form.invite_method==='password'&&<Inp label="Temporary Password" type="password" value={form.temporary_password??''} onChange={(v:string)=>set('temporary_password',v)} placeholder="Min 8 characters"/>}
            </div>
          )}

          {step===3&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Sel label="Region" value={form.region_id} onChange={v=>set('region_id',v)} options={toArr(regions).map((r:any)=>({label:r.name,value:r.id}))}/>
              <Inp label="OLT Domain"     value={form.olt_domain??''}    onChange={(v:string)=>set('olt_domain',v)}    placeholder="e.g. Lagos Island Core"/>
              <Inp label="Work Location"  value={form.work_location??''} onChange={(v:string)=>set('work_location',v)} placeholder="Office address"/>
              <Inp label="Specialization" value={form.specialization??''} onChange={(v:string)=>set('specialization',v)} placeholder="e.g. OLT Configuration"/>
            </div>
          )}

          {step===4&&(
            <div>
              <Sel label="Initial Status" value={form.status} onChange={v=>set('status',v)} options={[{label:'Active — immediately accessible',value:'active'},{label:'Inactive',value:'inactive'}]}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Inp label="Start Date" type="date" value={form.joined_at??''} onChange={(v:string)=>set('joined_at',v)}/>
                <Inp label="End Date (contracts)" type="date" value={form.end_date??''} onChange={(v:string)=>set('end_date',v)}/>
              </div>
              <div style={{background:'rgba(74,222,128,.06)',border:'1px solid rgba(74,222,128,.2)',borderRadius:12,padding:16,marginTop:8}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--green)',marginBottom:4}}>✓ Ready to provision on Opsyn</div>
                <div style={{fontSize:11,color:'var(--chalk3)'}}>All required fields complete. Click Activate to create the account and dispatch the invite — Powered by SlimTech.</div>
              </div>
            </div>
          )}

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:20,paddingTop:16,borderTop:'1px solid var(--wire)'}}>
            <Btn onClick={()=>setStep(s=>Math.max(0,s-1))} style={{visibility:step===0?'hidden':'visible'}}>← Previous</Btn>
            <div style={{fontSize:11,color:'var(--chalk3)'}}>Step {step+1} of {STEPS.length}</div>
            <Btn variant={step===STEPS.length-1?'jade':'brand'}
              onClick={()=>step<STEPS.length-1?setStep(s=>s+1):create.mutate()}
              disabled={!canNext[step]||create.isPending}>
              {create.isPending?'Activating…':step===STEPS.length-1?'✓ Activate on Opsyn':'Next →'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// STAFF DETAIL
// ════════════════════════════════════════════════════════════════
export function StaffDetailPage(){
  const navigate=useNavigate();
  const id=window.location.pathname.split('/').pop()!;
  const toast=useToast();
  const qc=useQueryClient();

  const {data:user,isLoading}=useQuery({queryKey:['staff',id],queryFn:()=>staffApi.get(id),enabled:!!id&&id!=='new'});
  const {data:perf}=useQuery({queryKey:['staff',id,'performance'],queryFn:()=>staffApi.getPerformance(id),enabled:!!id&&id!=='new',refetchInterval:3600000});
  const u:any=user;
  const p=u?.staff_profile;
  const perfData:any=perf;

  const updateStatus=useMutation({
    mutationFn:(status:'active'|'inactive'|'suspended')=>staffApi.updateStatus(id,status),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['staff',id]});toast.success('Status updated');},
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });

  if(isLoading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--chalk3)'}}>Loading…</div>;
  if(!u)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--chalk3)'}}>Staff member not found.</div>;

  const initials=p?`${p.first_name?.[0]??''}${p.last_name?.[0]??''}`:u.username?.slice(0,2).toUpperCase();

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Btn onClick={()=>navigate('/staff')} style={{fontSize:11}}>← Back</Btn>
            <div>
              <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>{p?`${p.first_name} ${p.last_name}`:u.username}</div>
              <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>{p?.staff_code} · {p?.department?.name??'—'}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            {p?.status==='active'&&<Btn variant="rose" onClick={()=>updateStatus.mutate('inactive')} style={{fontSize:11}}>Deactivate</Btn>}
            {p?.status!=='active'&&<Btn variant="jade" onClick={()=>updateStatus.mutate('active')} style={{fontSize:11}}>Activate</Btn>}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div style={card()}>
            <div style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:16}}>
              <div style={{width:46,height:46,borderRadius:12,background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:'#050810',flexShrink:0}}>{initials}</div>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:'var(--chalk)',letterSpacing:'-.02em'}}>{p?`${p.first_name} ${p.last_name}`:u.username}</div>
                <div style={{fontSize:11,color:'var(--chalk3)',marginTop:2}}>{p?.job_title??'—'}</div>
                <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}>
                  <span style={badge('var(--violet)','rgba(167,139,250,.1)')}>{u.role?.name}</span>
                  <span style={badge(p?.status==='active'?'var(--green)':'var(--rose)',p?.status==='active'?'rgba(74,222,128,.1)':'rgba(248,113,113,.1)')}><span style={dot}/>{p?.status??'unknown'}</span>
                  {p?.region&&<span style={badge('var(--cyan)','rgba(6,182,212,.1)')}>{p.region.name}</span>}
                </div>
              </div>
            </div>
            {[
              ['Email',       u.email,                 'var(--cyan)'],
              ['Phone',       p?.phone??'—',            null],
              ['Department',  p?.department?.name??'—', null],
              ['Team',        p?.team?.name??'—',       null],
              ['OLT Domain',  p?.olt_domain??'—',       null],
              ['Employment',  p?.employment_type??'—',  null],
              ['Joined',      p?.joined_at??'—',        null],
              ['Last Active', u.last_login_at?new Date(u.last_login_at).toLocaleDateString('en-GB'):'—', p?.status==='active'?'var(--green)':null],
            ].map(([l,v,c])=>(
              <div key={String(l)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--wire)'}}>
                <span style={{fontSize:11,color:'var(--chalk3)'}}>{l as string}</span>
                <span style={{fontSize:12,color:(c as string)||'var(--chalk)',fontWeight:500,textAlign:'right'}}>{v as string}</span>
              </div>
            ))}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={card()}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:12}}>Operational Details</div>
              {[
                ['Specialization',      p?.specialization??'—'],
                ['Work Location',       p?.work_location??'—'],
                ['Outage Resp.',        p?.outage_responsibility??'—'],
                ['MEC Resp.',           p?.mec_responsibility??'—'],
                ['Approval Authority',  `Level ${p?.approval_authority_level??0}`],
              ].map(([l,v])=>(
                <div key={String(l)} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--wire)'}}>
                  <span style={{fontSize:11,color:'var(--chalk3)'}}>{l as string}</span>
                  <span style={{fontSize:12,color:'var(--chalk)',fontWeight:500}}>{v as string}</span>
                </div>
              ))}
            </div>
            <div style={card()}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:12}}>Account Info</div>
              {[
                ['Username',       u.username],
                ['Account Status', u.is_active?'Active':'Inactive'],
              ].map(([l,v])=>(
                <div key={String(l)} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--wire)'}}>
                  <span style={{fontSize:11,color:'var(--chalk3)'}}>{l as string}</span>
                  <span style={{fontSize:12,color:'var(--chalk)',fontWeight:500}}>{v as string}</span>
                </div>
              ))}
            </div>
            <div style={card()}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>Efficiency Score</div>
                {perfData?.efficiency_computed_at&&<span style={{fontSize:10,color:'var(--chalk3)'}}>Updated {new Date(perfData.efficiency_computed_at).toLocaleDateString('en-GB')}</span>}
              </div>
              {perfData?(()=>{
                const score=perfData.efficiency_score??0;
                const scoreColor=score>=75?'var(--green)':score>=50?'var(--amber)':'var(--rose)';
                return(<>
                  <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
                    <div style={{width:56,height:56,borderRadius:'50%',background:`conic-gradient(${scoreColor} ${score*3.6}deg,var(--bg4) 0deg)`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <div style={{width:42,height:42,borderRadius:'50%',background:'var(--bg2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--mono)',fontWeight:800,fontSize:13,color:scoreColor}}>{score!=null?Math.round(score):'—'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:'var(--chalk3)',marginBottom:4}}>30-day performance</div>
                      <div style={{fontSize:10,color:'var(--chalk3)'}}>{perfData.tasks_assigned} tasks assigned · {perfData.tasks_done} done</div>
                    </div>
                  </div>
                  {[
                    {label:'Completion Rate', val:`${perfData.completion_rate_pct}%`, color:'var(--cyan)'},
                    {label:'SLA Adherence',   val:`${perfData.sla_adherence_pct}%`,   color:'var(--green)'},
                    {label:'Avg Resolution',  val:`${perfData.avg_resolution_hours}h`, color:'var(--violet)'},
                    {label:'Tasks Open',      val:String(perfData.tasks_open),         color:'var(--amber)'},
                  ].map(row=>(
                    <div key={row.label} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--wire)'}}>
                      <span style={{fontSize:11,color:'var(--chalk3)'}}>{row.label}</span>
                      <span style={{fontSize:12,fontFamily:'var(--mono)',fontWeight:700,color:row.color}}>{row.val}</span>
                    </div>
                  ))}
                </>);
              })():(
                <div style={{textAlign:'center',padding:'20px 0',color:'var(--chalk3)',fontSize:12}}>Score not yet computed — runs hourly</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// OUTAGE MONITOR
// ════════════════════════════════════════════════════════════════
export function OutagePage(){
  const [logModal,setLogModal]=useState(false);
  const [form,setForm]=useState({title:'',severity:'warning',description:'',olt_reference:''});
  const toast=useToast();
  const qc=useQueryClient();

  const {data,isLoading}=useQuery({queryKey:['outages'],queryFn:()=>outageApi.list(),refetchInterval:30000});

  const log=useMutation({
    mutationFn:()=>outageApi.log(form as any),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['outages']});setLogModal(false);setForm({title:'',severity:'warning',description:'',olt_reference:''});toast.info('Outage logged');},
    onError:(e:any)=>toast.error('Failed to log',e?.detail),
  });
  const resolve=useMutation({
    mutationFn:(id:string)=>outageApi.resolve(id),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['outages']});toast.success('Outage resolved');},
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });
  const setMonitoring=useMutation({
    mutationFn:(id:string)=>outageApi.updateStatus(id,'monitoring'),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['outages']});toast.info('Status set to Monitoring');},
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });

  const items     =(data as any)?.items??[];
  const active    =items.filter((o:any)=>o.status==='active'||o.status==='monitoring');
  const resolved  =items.filter((o:any)=>o.status==='resolved');
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));

  function SlaChip({o}:{o:any}){
    const [label,setLabel]=useState('');
    const [color,setColor]=useState('var(--chalk3)');
    useState(()=>{
      if(!o.sla_deadline)return;
      const update=()=>{
        if(o.breached_sla){setLabel('BREACHED');setColor('var(--rose)');return;}
        const diff=Math.floor((new Date(o.sla_deadline).getTime()-Date.now())/60000);
        if(diff<=0){setLabel('Expired');setColor('var(--rose)');}
        else if(diff<30){setLabel(`${diff}m`);setColor('var(--rose)');}
        else if(diff<60){setLabel(`${diff}m`);setColor('var(--amber)');}
        else{setLabel(`${Math.floor(diff/60)}h ${diff%60}m`);setColor('var(--green)');}
      };
      update();
      const t=setInterval(update,30000);
      return()=>clearInterval(t);
    });
    if(!o.sla_deadline)return null;
    return <span style={{fontSize:10,fontWeight:600,color,fontFamily:'var(--mono)',whiteSpace:'nowrap'}}>{label}</span>;
  }

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{display:'flex',alignItems:'center',background:'linear-gradient(135deg,rgba(248,113,113,.04),rgba(6,182,212,.04))',borderBottom:'1px solid var(--wire)',padding:'8px 20px',fontSize:11,gap:24}}>
        {[{val:String(active.length),label:'Active Incidents',color:'var(--rose)'},{val:String(resolved.length),label:'Resolved Today',color:'var(--green)'},{val:String(items.length),label:'Total Incidents',color:'var(--chalk)'}].map(item=>(
          <div key={item.label} style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontFamily:'var(--mono)',fontWeight:600,fontSize:13,color:item.color}}>{item.val}</span>
            <span style={{color:'var(--chalk3)'}}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>Outage Monitor</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>Real-time network incident command</div>
          </div>
          <Btn variant="rose" onClick={()=>setLogModal(true)} style={{fontSize:11,padding:'5px 12px'}}>+ Log Outage</Btn>
        </div>
        <div style={card({padding:0})}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Incident ID','Title','Severity','Status','SLA','OLT Ref','Subs','Created','Actions'].map(h=>(
                <th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 14px',borderBottom:'1px solid var(--wire)'}}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {isLoading?<tr><td colSpan={9} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>Loading incidents…</td></tr>
                :items.length===0?<tr><td colSpan={9} style={{textAlign:'center',padding:40,color:'var(--green)',fontSize:12}}>✓ No incidents recorded</td></tr>
                :items.map((o:any)=>{
                  const sc=o.severity==='critical'?'var(--rose)':o.severity==='high'?'var(--amber)':'var(--amber)';
                  const ss=o.status==='active'?'var(--rose)':o.status==='resolved'?'var(--green)':o.status==='monitoring'?'var(--amber)':'var(--cyan)';
                  return(
                    <tr key={o.id} style={{cursor:'pointer'}} onClick={()=>navigate(`/outage/${o.id}`)}>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontFamily:'var(--mono)',fontSize:11,color:'var(--cyan)'}}>{o.reference}</td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}>
                        <div style={{fontWeight:500,color:'var(--chalk)',fontSize:12}}>{o.title}</div>
                        {o.description&&<div style={{fontSize:10,color:'var(--chalk3)',marginTop:2,maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.description}</div>}
                      </td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge(sc,`${sc}1a`)}>{o.severity}</span></td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge(ss,`${ss}1a`)}><span style={dot}/>{o.status}</span></td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}} onClick={e=>e.stopPropagation()}><SlaChip o={o}/></td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk2)'}}>{o.olt_reference??'—'}</td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk2)',fontFamily:'var(--mono)'}}>{o.affected_subscribers??0}</td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk2)'}}>{new Date(o.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}} onClick={e=>e.stopPropagation()}>
                        {o.status==='resolved'?(
                          <span style={{fontSize:11,color:'var(--chalk3)'}}>Resolved</span>
                        ):(
                          <div style={{display:'flex',gap:4}}>
                            {o.status==='active'&&<Btn variant="amber" onClick={()=>setMonitoring.mutate(o.id)} disabled={setMonitoring.isPending} style={{fontSize:10,padding:'3px 7px'}}>Monitor</Btn>}
                            <Btn variant="jade" onClick={()=>resolve.mutate(o.id)} disabled={resolve.isPending} style={{fontSize:10,padding:'3px 7px'}}>Resolve</Btn>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Modal open={logModal} onClose={()=>setLogModal(false)} title="Log New Outage"
        footer={<><Btn onClick={()=>setLogModal(false)}>Cancel</Btn><Btn variant="rose" onClick={()=>log.mutate()} disabled={!form.title||log.isPending}>{log.isPending?'Logging…':'Log Outage'}</Btn></>}>
        <Inp label="Title *" value={form.title} onChange={(v:string)=>set('title',v)} placeholder="e.g. Lagos Island · OLT-024 Fibre Cut"/>
        <Sel label="Severity" value={form.severity} onChange={v=>set('severity',v)} options={[{label:'Critical',value:'critical'},{label:'High',value:'high'},{label:'Warning',value:'warning'},{label:'Low',value:'low'}]}/>
        <Inp label="OLT Reference" value={form.olt_reference} onChange={(v:string)=>set('olt_reference',v)} placeholder="e.g. OLT-024"/>
        <div style={{marginBottom:14}}>
          <label htmlFor="outage-description" style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>Description</label>
          <textarea id="outage-description" name="outage-description" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Nature of the incident…" rows={3}
            style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none',resize:'vertical'}}/>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════════════════════════════════
const STATUS_COLOR: Record<string,string> = {
  pending_manager: 'var(--amber)',
  pending_admin:   'var(--violet)',
  approved:        'var(--green)',
  rejected:        'var(--rose)',
};
const STATUS_LABEL: Record<string,string> = {
  pending_manager: 'Awaiting Manager',
  pending_admin:   'Awaiting Admin',
  approved:        'Approved',
  rejected:        'Rejected',
};

export function OnboardingPage(){
  const [submitModal,setSubmitModal]=useState(false);
  const [rejectModal,setRejectModal]=useState<{id:string}|null>(null);
  const [rejectReason,setRejectReason]=useState('');
  const [form,setForm]=useState({proposed_first_name:'',proposed_last_name:'',proposed_email:'',proposed_role_id:'',department_id:'',justification:''});
  const toast=useToast();
  const qc=useQueryClient();
  const roleLevel = useAuthStore(s=>s.roleLevel ?? 1);

  const {data,isLoading}=useQuery({queryKey:['onboarding'],queryFn:()=>onboardingApi.list()});
  const {data:roles}    =useQuery({queryKey:['roles'],queryFn:()=>rolesApi.getRoles()});
  const {data:depts}    =useQuery({queryKey:['departments'],queryFn:()=>orgApi.getDepartments()});

  const mgrApprove=useMutation({mutationFn:(id:string)=>onboardingApi.managerApprove(id),onSuccess:()=>{qc.invalidateQueries({queryKey:['onboarding']});toast.success('Phase 1 approved','Forwarded to admin for final approval');},onError:(e:any)=>toast.error('Failed',e?.response?.data?.detail??e?.message)});
  const approve   =useMutation({mutationFn:(id:string)=>onboardingApi.approve(id),onSuccess:()=>{qc.invalidateQueries({queryKey:['onboarding']});toast.success('Request approved','Account provisioned on Opsyn');},onError:(e:any)=>toast.error('Failed',e?.response?.data?.detail??e?.message)});
  const reject    =useMutation({mutationFn:({id,reason}:{id:string,reason?:string})=>onboardingApi.reject(id,reason),onSuccess:()=>{qc.invalidateQueries({queryKey:['onboarding']});setRejectModal(null);setRejectReason('');toast.info('Request rejected');},onError:(e:any)=>toast.error('Failed',e?.response?.data?.detail??e?.message)});
  const submit    =useMutation({mutationFn:()=>onboardingApi.submit(form as any),onSuccess:()=>{qc.invalidateQueries({queryKey:['onboarding']});setSubmitModal(false);setForm({proposed_first_name:'',proposed_last_name:'',proposed_email:'',proposed_role_id:'',department_id:'',justification:''});toast.success('Request submitted','Pending manager approval');},onError:(e:any)=>toast.error('Failed',e?.response?.data?.detail??e?.message)});

  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));
  const items=(data as any)?.items??[];
  const awaitingMgr  =items.filter((r:any)=>r.approval_status==='pending_manager').length;
  const awaitingAdmin=items.filter((r:any)=>r.approval_status==='pending_admin').length;

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>Onboarding Requests</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>{awaitingMgr} awaiting manager · {awaitingAdmin} awaiting admin · Two-phase approval</div>
          </div>
          <Btn variant="brand" onClick={()=>setSubmitModal(true)} style={{fontSize:11,padding:'5px 12px'}}>+ Submit Request</Btn>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:18}}>
          <KpiCard label="Awaiting Manager" value={awaitingMgr}                                                                          color="var(--amber)"/>
          <KpiCard label="Awaiting Admin"   value={awaitingAdmin}                                                                        color="var(--violet)"/>
          <KpiCard label="Approved"         value={items.filter((r:any)=>r.approval_status==='approved').length}                         color="var(--green)"/>
          <KpiCard label="Rejected"         value={items.filter((r:any)=>r.approval_status==='rejected').length}                         color="var(--rose)"/>
        </div>

        <div style={card({padding:0})}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Proposed Personnel','Email','Department','Submitted','Status','Actions'].map(h=>(
                <th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 14px',borderBottom:'1px solid var(--wire)'}}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {isLoading?<tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>Loading…</td></tr>
                :items.length===0?<tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>No onboarding requests</td></tr>
                :items.map((r:any)=>{
                  const sc=STATUS_COLOR[r.approval_status]??'var(--chalk3)';
                  const sl=STATUS_LABEL[r.approval_status]??r.approval_status;
                  const deptList=toArr(depts);
                  const deptName=deptList.find((d:any)=>d.id===r.department_id)?.name??r.department_id?.slice(0,8)??'—';
                  return(
                    <tr key={r.id}>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontWeight:500,color:'var(--chalk)',fontSize:12}}>{r.proposed_first_name} {r.proposed_last_name}</td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--cyan)'}}>{r.proposed_email}</td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:12,color:'var(--chalk2)'}}>{deptName}</td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk2)'}}>{new Date(r.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge(sc,`${sc}1a`)}><span style={dot}/>{sl}</span></td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {r.approval_status==='pending_manager'&&roleLevel>=4&&(
                            <Btn variant="jade" onClick={()=>mgrApprove.mutate(r.id)} disabled={mgrApprove.isPending} style={{padding:'3px 8px',fontSize:11}}>Manager Approve</Btn>
                          )}
                          {r.approval_status==='pending_admin'&&roleLevel>=5&&(
                            <Btn variant="jade" onClick={()=>approve.mutate(r.id)} disabled={approve.isPending} style={{padding:'3px 8px',fontSize:11}}>Final Approve</Btn>
                          )}
                          {(r.approval_status==='pending_manager'||r.approval_status==='pending_admin')&&(
                            <Btn variant="rose" onClick={()=>{setRejectModal({id:r.id});setRejectReason('');}} style={{padding:'3px 8px',fontSize:11}}>Reject</Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Submit request modal */}
      <Modal open={submitModal} onClose={()=>setSubmitModal(false)} title="Submit Onboarding Request"
        footer={<><Btn onClick={()=>setSubmitModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>submit.mutate()} disabled={!form.proposed_first_name||!form.proposed_email||!form.proposed_role_id||!form.department_id||submit.isPending}>{submit.isPending?'Submitting…':'Submit Request'}</Btn></>}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Inp label="First Name *" value={form.proposed_first_name} onChange={(v:string)=>set('proposed_first_name',v)} placeholder="First name"/>
          <Inp label="Last Name *"  value={form.proposed_last_name}  onChange={(v:string)=>set('proposed_last_name',v)}  placeholder="Last name"/>
        </div>
        <Inp label="Email Address *" type="email" value={form.proposed_email} onChange={(v:string)=>set('proposed_email',v)} placeholder="candidate@email.com"/>
        <Sel label="Proposed Role *" value={form.proposed_role_id} onChange={v=>set('proposed_role_id',v)} options={toArr(roles).map((r:any)=>({label:r.name,value:r.id}))}/>
        <Sel label="Department *"    value={form.department_id}    onChange={v=>set('department_id',v)}    options={toArr(depts).map((d:any)=>({label:d.name,value:d.id}))}/>
        <div style={{marginBottom:14}}>
          <label style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>Justification</label>
          <textarea value={form.justification} onChange={e=>set('justification',e.target.value)} placeholder="Why is this person needed?" rows={3}
            style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none',resize:'vertical'}}/>
        </div>
      </Modal>

      {/* Reject reason modal */}
      <Modal open={!!rejectModal} onClose={()=>setRejectModal(null)} title="Reject Onboarding Request"
        footer={<><Btn onClick={()=>setRejectModal(null)}>Cancel</Btn><Btn variant="rose" onClick={()=>rejectModal&&reject.mutate({id:rejectModal.id,reason:rejectReason||undefined})} disabled={reject.isPending}>{reject.isPending?'Rejecting…':'Reject Request'}</Btn></>}>
        <p style={{fontSize:12,color:'var(--chalk3)',marginBottom:14,lineHeight:1.5}}>Optionally provide a reason for rejecting this request.</p>
        <div style={{marginBottom:14}}>
          <label style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>Reason <span style={{fontWeight:400}}>(optional)</span></label>
          <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Reason for rejection…" rows={3}
            style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none',resize:'vertical'}}/>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ROLES & PERMISSIONS
// ════════════════════════════════════════════════════════════════
export function RolesPage(){
  const [addModal,setAddModal]=useState(false);
  const [form,setForm]=useState({name:'',level:'1',description:''});
  const toast=useToast();
  const qc=useQueryClient();

  const {data:roles,isLoading}=useQuery({queryKey:['roles','all'],queryFn:()=>rolesApi.getRoles()});

  const createRole=useMutation({
    mutationFn:()=>rolesApi.createRole({name:form.name,level:parseInt(form.level),description:form.description} as any),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['roles']});setAddModal(false);setForm({name:'',level:'1',description:''});toast.success('Role created');},
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });

  const PERM_MATRIX=[
    {key:'Create personnel',  vals:[true,true,false,false,false,false,false]},
    {key:'Assign roles',      vals:[true,false,false,false,false,false,false]},
    {key:'Approve onboarding',vals:[true,false,false,false,false,false,false]},
    {key:'Submit onboarding', vals:[true,true,true,false,false,false,false]},
    {key:'View audit logs',   vals:[true,false,false,false,false,false,false]},
    {key:'Manage outages',    vals:[true,true,true,true,false,false,false]},
    {key:'MEC review',        vals:[true,true,false,false,true,false,false]},
    {key:'Manage tasks',      vals:[true,true,true,true,true,true,true]},
  ];
  const LC:Record<number,string>={5:'var(--rose)',4:'var(--amber)',3:'var(--green)',2:'var(--cyan)',1:'var(--chalk3)'};

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>Roles & Permissions</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>{toArr(roles).length} roles · decision access matrix</div>
          </div>
          <Btn variant="brand" onClick={()=>setAddModal(true)} style={{fontSize:11,padding:'5px 12px'}}>+ Add Role</Btn>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div style={card()}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>Defined Roles</div>
            {isLoading?<div style={{color:'var(--chalk3)',fontSize:12}}>Loading…</div>
            :toArr(roles).sort((a:any,b:any)=>b.level-a.level).map((r:any)=>(
              <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 11px',background:'var(--bg3)',borderRadius:8,border:'1px solid var(--wire)',marginBottom:6}}>
                <div style={{width:7,height:7,borderRadius:2,flexShrink:0,background:LC[r.level]||'var(--chalk3)'}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--chalk)'}}>{r.name}</div>
                  <div style={{fontSize:10,color:'var(--chalk3)'}}>Level {r.level} · {r.is_system_role?'System role':'Custom role'}</div>
                </div>
                {r.is_system_role&&<span style={badge('var(--rose)','rgba(248,113,113,.1)')}>System</span>}
              </div>
            ))}
          </div>
          <div style={card()}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>Permission Matrix</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  <th style={{textAlign:'left',fontSize:9,fontWeight:700,color:'var(--chalk3)',padding:'7px 8px',minWidth:130}}>Permission</th>
                  {['Admin','Mgr','TL','NOC','MEC','EV','Staff'].map(h=>(
                    <th key={h} style={{fontSize:9,fontWeight:700,color:'var(--chalk3)',padding:'7px 8px',textAlign:'center'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {PERM_MATRIX.map(p=>(
                    <tr key={p.key}>
                      <td style={{fontSize:11,color:'var(--chalk2)',padding:'7px 8px'}}>{p.key}</td>
                      {p.vals.map((v,i)=>(
                        <td key={i} style={{textAlign:'center',padding:'7px 8px'}}>
                          <div style={{width:18,height:18,borderRadius:4,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,background:v?'rgba(74,222,128,.15)':'var(--bg4)',color:v?'var(--green)':'var(--chalk3)'}}>{v?'✓':'–'}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <Modal open={addModal} onClose={()=>setAddModal(false)} title="Add New Role"
        footer={<><Btn onClick={()=>setAddModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>createRole.mutate()} disabled={!form.name||createRole.isPending}>{createRole.isPending?'Creating…':'Create Role'}</Btn></>}>
        <Inp label="Role Name *" value={form.name} onChange={(v:string)=>setForm(f=>({...f,name:v}))} placeholder="e.g. Senior NOC Operator"/>
        <Sel label="Level" value={form.level} onChange={v=>setForm(f=>({...f,level:v}))} options={[1,2,3,4].map(n=>({label:`Level ${n}`,value:String(n)}))}/>
        <div style={{marginBottom:14}}>
          <label htmlFor="role-description" style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>Description</label>
          <textarea id="role-description" name="role-description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What can this role do?" rows={3}
            style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none',resize:'vertical'}}/>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PROJECTS
// ════════════════════════════════════════════════════════════════
export function ProjectsPage(){
  const [addModal,setAddModal]=useState(false);
  const [form,setForm]=useState({name:'',description:'',department_id:'',due_date:'',project_type:'internal',owner_id:''});
  const [createdProjectId,setCreatedProjectId]=useState<string|null>(null);
  const toast=useToast();
  const qc=useQueryClient();

  const {data,isLoading}=useQuery({queryKey:['projects'],queryFn:()=>projectsApi.list()});
  const {data:depts}    =useQuery({queryKey:['departments'],queryFn:()=>orgApi.getDepartments()});
  const {data:staffData,isLoading:staffLoading}=useQuery({
    queryKey:['staff','list',{status:'active',size:100}],
    queryFn:()=>staffApi.list({status:'active',size:100}),
  });
  const {data:projectSchema}=useQuery({
    queryKey:['form-schema','project'],
    queryFn:()=>formsApi.getSchema('project'),
    retry:false,
    staleTime:5*60*1000,
  });

  const resetForm=()=>{setForm({name:'',description:'',department_id:'',due_date:'',project_type:'internal',owner_id:''});setCreatedProjectId(null);};

  const create=useMutation({
    mutationFn:()=>projectsApi.create(form as any),
    onSuccess:(proj:any)=>{
      qc.invalidateQueries({queryKey:['projects']});
      toast.success('Project created');
      if(projectSchema?.is_published){
        setAddModal(false);
        setCreatedProjectId(proj?.id??proj?.data?.id??null);
      } else {
        setAddModal(false);resetForm();
      }
    },
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });

  const navigate = useNavigate();
  const items=(data as any)?.items??[];
  const SC:Record<string,string>={active:'var(--cyan)',completed:'var(--green)',paused:'var(--amber)'};
  const staffOptions = toArr(staffData).map((s:any)=>({label:`${s.staff_profile?.first_name} ${s.staff_profile?.last_name}`.trim(), value:s.id}));
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>Project Monitor</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>{items.length} projects tracked</div>
          </div>
          <Btn variant="brand" onClick={()=>setAddModal(true)} style={{fontSize:11,padding:'5px 12px'}}>+ New Project</Btn>
        </div>
        {isLoading?<div style={{color:'var(--chalk3)',fontSize:12,padding:20}}>Loading…</div>:(
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
            {items.map((p:any)=>(
              <div key={p.id} style={card({cursor:'pointer'})} onClick={()=>navigate(`/projects/${p.id}/pipeline`)}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                  <div style={{width:38,height:38,borderRadius:10,background:'rgba(6,182,212,.1)',border:'1px solid rgba(6,182,212,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🔌</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--chalk)'}}>{p.name}</div>
                    <div style={{fontSize:10,color:'var(--chalk3)'}}>{p.due_date?`Due: ${new Date(p.due_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`:'No due date'}</div>
                  </div>
                </div>
                <Pbar fill="var(--brand)" pct={p.completion_pct??0}/>
                <div style={{fontSize:10,color:'var(--chalk3)',textAlign:'right',margin:'4px 0 12px'}}>{p.completion_pct??0}% complete</div>
                <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--wire)',paddingTop:10}}>
                  <span style={{fontSize:11,color:'var(--chalk3)'}}>Status</span>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span style={badge(SC[p.status]||'var(--chalk3)',`${SC[p.status]||'var(--chalk3)'}1a`)}>{p.status}</span>
                    {p.pipeline_status && (
                      <span style={badge(
                        p.pipeline_status === 'active' ? 'var(--brand)' :
                        p.pipeline_status === 'completed' ? 'var(--green)' :
                        p.pipeline_status === 'paused' ? 'var(--amber)' :
                        'var(--chalk3)',
                        p.pipeline_status === 'active' ? 'rgba(6,182,212,.1)' :
                        p.pipeline_status === 'completed' ? 'rgba(74,222,128,.1)' :
                        p.pipeline_status === 'paused' ? 'rgba(251,191,36,.1)' :
                        'rgba(156,163,175,.1)'
                      )}>
                        {p.pipeline_status.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {items.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',color:'var(--chalk3)',fontSize:12,padding:40}}>No projects yet. Create your first project.</div>}
          </div>
        )}
      </div>
      <Modal open={addModal} onClose={()=>{setAddModal(false);}} title="Create New Project"
        footer={<><Btn onClick={()=>setAddModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>create.mutate()} disabled={!form.name||create.isPending||(form.project_type==='internal'&&!form.owner_id)||(form.project_type==='external'&&!form.department_id)}>{create.isPending?'Creating…':projectSchema?.is_published?'Create & Continue →':'Create Project'}</Btn></>}>
        <Inp label="Project Name *"   value={form.name}          onChange={(v:string)=>set('name',v)}          placeholder="e.g. Fibre Expansion Phase 4"/>
        <Sel label="Project Type *"   value={form.project_type}  onChange={(v:string)=>setForm(f=>({
          ...f,
          project_type:v,
          owner_id: '',
          department_id: '',
        }))}
          options={[{label:'Internal Project',value:'internal'},{label:'External Project',value:'external'}]}/>
        {form.project_type === 'internal' ? (
          <Sel label="Assign To *" value={form.owner_id} onChange={v=>set('owner_id',v)}
            options={staffOptions.length ? staffOptions : [{label: staffLoading ? 'Loading staff…' : 'No active staff found', value:''}]}/>
        ) : (
          <Sel label="Department *" value={form.department_id} onChange={v=>set('department_id',v)}
            options={toArr(depts).map((d:any)=>({label:d.name,value:d.id}))}/>
        )}
        <Inp label="Due Date" type="date" value={form.due_date}  onChange={(v:string)=>set('due_date',v)}/>
        <div style={{marginBottom:14}}>
          <label htmlFor="project-description" style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>Description</label>
          <textarea id="project-description" name="project-description" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Project scope and objectives…" rows={3}
            style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none',resize:'vertical'}}/>
        </div>
      </Modal>

      {/* ── Post-creation dynamic form overlay ── */}
      {createdProjectId&&projectSchema?.is_published&&(
        <div style={{position:'fixed',inset:0,background:'rgba(2,4,12,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,backdropFilter:'blur(4px)'}}>
          <div style={{background:'var(--bg2)',border:'1px solid var(--wire2)',borderRadius:16,padding:22,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto',scrollbarWidth:'none',boxShadow:'0 24px 64px rgba(0,0,0,.7)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:'var(--chalk)'}}>Project Details Form</div>
                <div style={{fontSize:10,color:'var(--chalk3)',marginTop:2}}>Step 2 of 2 — optional additional data</div>
              </div>
              <button onClick={()=>{resetForm();}} style={{background:'none',border:'none',color:'var(--chalk3)',cursor:'pointer',fontSize:20}}>✕</button>
            </div>
            <DynamicForm
              schema={projectSchema}
              entityType="project"
              entityId={createdProjectId}
              onSuccess={()=>{toast.success('Form submitted');resetForm();}}
              onCancel={()=>resetForm()}
              submitLabel="Submit & Close"
            />
            <div style={{textAlign:'center',marginTop:8}}>
              <button onClick={()=>resetForm()} style={{background:'none',border:'none',color:'var(--chalk3)',cursor:'pointer',fontSize:11,fontFamily:'var(--font)',textDecoration:'underline'}}>
                Skip form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════
export function NotificationsPage(){
  const toast=useToast();
  const qc=useQueryClient();
  const {data,isLoading}=useQuery({queryKey:['notifications'],queryFn:notificationsApi.list,refetchInterval:30000});

  const markRead=useMutation({mutationFn:(id:string)=>notificationsApi.markRead(id),onSuccess:()=>qc.invalidateQueries({queryKey:['notifications']})});
  const markAll =useMutation({mutationFn:notificationsApi.markAllRead,onSuccess:()=>{qc.invalidateQueries({queryKey:['notifications']});toast.success('All marked as read');}});

  const notifs=toArr(data);
  const unread=notifs.filter((n:any)=>!n.is_read).length;
  const TYPE_ICONS:Record<string,string>={onboarding_pending:'📋',onboarding_approved:'✅',onboarding_rejected:'❌',outage_critical:'🔴',outage_warning:'⚠️',outage_resolved:'✅',role_changed:'⭐',staff_created:'👤',task_assigned:'✅',task_overdue:'⏰'};

  return(
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:'1px solid var(--wire)',flexShrink:0,background:'var(--bg2)'}}>
        <div style={{fontWeight:700,fontSize:14,color:'var(--chalk)'}}>
          Notifications
          {unread>0&&<span style={{fontSize:11,color:'var(--chalk3)',fontWeight:400,marginLeft:8}}>{unread} unread</span>}
        </div>
        {unread>0&&<Btn onClick={()=>markAll.mutate()} style={{fontSize:11,padding:'4px 10px'}}>Mark All Read</Btn>}
      </div>
      <div style={{overflow:'auto',flex:1}}>
        {isLoading
          ?<div style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>Loading…</div>
          :notifs.length===0
            ?<div style={{textAlign:'center',padding:60,color:'var(--chalk3)',fontSize:12}}><div style={{fontSize:32,marginBottom:12}}>🔔</div><div>No notifications yet</div></div>
            :notifs.map((n:any)=>(
              <div key={n.id} onClick={()=>!n.is_read&&markRead.mutate(n.id)}
                style={{display:'flex',gap:12,alignItems:'flex-start',padding:'14px 20px',borderBottom:'1px solid var(--wire)',cursor:n.is_read?'default':'pointer',background:!n.is_read?'rgba(6,182,212,.025)':'transparent',borderLeft:!n.is_read?'2px solid rgba(6,182,212,.4)':'2px solid transparent'}}>
                {!n.is_read&&<div style={{width:7,height:7,borderRadius:'50%',background:'var(--cyan)',flexShrink:0,marginTop:6,boxShadow:'0 0 8px rgba(6,182,212,.5)'}}/>}
                {n.is_read&&<div style={{width:7}}/>}
                <div style={{width:34,height:34,borderRadius:9,background:'var(--bg4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{TYPE_ICONS[n.type]??'📬'}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--chalk)'}}>{n.title}</div>
                  {n.body&&<div style={{fontSize:11,color:'var(--chalk3)',marginTop:3}}>{n.body}</div>}
                  <div style={{fontSize:10,color:'var(--chalk3)',marginTop:4}}>{new Date(n.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
                {!n.is_read&&<Btn onClick={(e:any)=>{e.stopPropagation();markRead.mutate(n.id);}} style={{padding:'3px 8px',fontSize:10}}>Read</Btn>}
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════════════════════════
// ── helpers for breakdown bars ──
function BreakdownBar({label,count,total,color='var(--brand)'}:{label:string;count:number;total:number;color?:string}){
  const pct=total>0?Math.round((count/total)*100):0;
  return(
    <div style={{marginBottom:10}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:12,color:'var(--chalk2)',fontWeight:500}}>{label}</span>
        <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--chalk3)'}}>{count} <span style={{color:'var(--chalk4)',fontSize:10}}>({pct}%)</span></span>
      </div>
      <div style={{height:6,background:'var(--bg4)',borderRadius:3,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:3,transition:'width .4s ease'}}/>
      </div>
    </div>
  );
}

const TASK_STATUS_COLORS:Record<string,string>={new:'var(--chalk3)',assigned:'var(--cyan)',in_progress:'var(--brand)',review:'var(--violet)',blocked:'var(--rose)',done:'var(--green)',archived:'var(--chalk4)'};
const SEVERITY_COLORS:Record<string,string>={critical:'var(--rose)',major:'var(--amber)',warning:'var(--violet)',info:'var(--cyan)'};
const PROJECT_TYPE_COLORS:Record<string,string>={external:'var(--cyan)',internal:'var(--violet)',cable_upgrade:'var(--amber)',olt_installation:'var(--brand)',procurement:'var(--green)'};

export function ReportsPage(){
  const [tab,setTab]=useState<'overview'|'staff'|'tasks'|'projects'|'outages'|'infrastructure'|'shifts'|'sla'>('overview');
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const params={date_from:dateFrom||undefined,date_to:dateTo||undefined};

  const {data:summary,isLoading:sumLoading}=useQuery({queryKey:['reports','summary',dateFrom,dateTo],queryFn:()=>reportsApi.getSummary(params)});
  const {data:staffBd,isLoading:staffLoading}=useQuery({queryKey:['reports','staff-breakdown'],queryFn:()=>reportsApi.getStaffBreakdown(),enabled:tab==='staff'});
  const {data:tasksBd,isLoading:tasksLoading}=useQuery({queryKey:['reports','tasks-breakdown'],queryFn:()=>reportsApi.getTasksBreakdown(),enabled:tab==='tasks'});
  const {data:projBd,isLoading:projLoading}=useQuery({queryKey:['reports','projects-breakdown'],queryFn:()=>reportsApi.getProjectsBreakdown(),enabled:tab==='projects'});
  const {data:mttr,isLoading:mttrLoading}=useQuery({queryKey:['reports','mttr',dateFrom,dateTo],queryFn:()=>reportsApi.getOutageMttr(params),enabled:tab==='outages'});
  const {data:infraRpt,isLoading:infraLoading}=useQuery({queryKey:['reports','infrastructure'],queryFn:()=>reportsApi.getInfrastructureReport(),enabled:tab==='infrastructure'});
  const {data:shiftsRpt,isLoading:shiftsLoading}=useQuery({queryKey:['reports','shifts'],queryFn:()=>reportsApi.getShiftsReport(),enabled:tab==='shifts'});
  const {data:slaRpt,isLoading:slaLoading}=useQuery({queryKey:['reports','sla'],queryFn:()=>reportsApi.getSlaReport(),enabled:tab==='sla'});

  const d:any=summary??{};
  const sb:any=staffBd??{};
  const tb:any=tasksBd??{};
  const pb:any=projBd??{};
  const mt:any=mttr??{};
  const ir:any=infraRpt??{};
  const sr:any=shiftsRpt??{};
  const sl:any=slaRpt??{};

  const exportCSV=()=>reportsApi.exportCSV(params).then((blob:any)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='opsyn-staff-report.csv';a.click();URL.revokeObjectURL(url);}).catch(()=>{});

  const TABS=[
    {key:'overview'      as const,label:'Overview'},
    {key:'staff'         as const,label:'Staff'},
    {key:'tasks'         as const,label:'Tasks'},
    {key:'projects'      as const,label:'Projects'},
    {key:'outages'       as const,label:'Outages & MTTR'},
    {key:'infrastructure'as const,label:'Infrastructure'},
    {key:'shifts'        as const,label:'Shifts'},
    {key:'sla'           as const,label:'SLA Compliance'},
  ];

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{padding:20}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>Operational Intelligence</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>Workforce &amp; Network Analytics · Live Data</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'6px 10px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none'}}/>
            <span style={{color:'var(--chalk3)',fontSize:12}}>→</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'6px 10px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none'}}/>
            <Btn onClick={exportCSV} style={{fontSize:11,padding:'5px 10px'}}>Export CSV</Btn>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:6,marginBottom:18,flexWrap:'wrap'}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)',
                border:tab===t.key?'1px solid rgba(6,182,212,.3)':'1px solid var(--wire2)',
                background:tab===t.key?'linear-gradient(135deg,rgba(74,222,128,.08),rgba(6,182,212,.08))':'transparent',
                color:tab===t.key?'var(--cyan)':'var(--chalk3)',transition:'all .15s'}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab==='overview'&&(sumLoading?<div style={{color:'var(--chalk3)',fontSize:12,padding:20}}>Loading…</div>:(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:14}}>
              <KpiCard label="Total Personnel"  value={d.staff_total??0}       color="var(--cyan)"/>
              <KpiCard label="Active Personnel" value={d.staff_active??0}      color="var(--green)"/>
              <KpiCard label="Outages Resolved" value={d.outages_resolved??0}  color="var(--rose)"/>
              <KpiCard label="Tasks Completed"  value={d.tasks_completed??0}   color="var(--violet)"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:18}}>
              <KpiCard label="Staff Added"     value={d.staff_added??0}       color="var(--amber)"/>
              <KpiCard label="Avg MTTR (hrs)"  value={d.avg_mttr_hours!=null?`${d.avg_mttr_hours}h`:'N/A'} color="var(--cyan)"/>
              <KpiCard label="Active Sites"    value={d.active_sites??0}      color="var(--chalk)"/>
              <KpiCard label="Network Nodes"   value={d.active_network_nodes??0} color="var(--chalk)"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>Workforce Snapshot</div>
                <div style={{display:'flex',gap:10,marginBottom:16}}>
                  {[{label:'Total',val:d.staff_total??0,c:'var(--cyan)'},{label:'Active',val:d.staff_active??0,c:'var(--green)'},{label:'Added',val:`+${d.staff_added??0}`,c:'var(--amber)'}].map(s=>(
                    <div key={s.label} style={{flex:1,padding:10,background:'var(--bg3)',borderRadius:8,textAlign:'center'}}>
                      <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:600,color:s.c}}>{s.val}</div>
                      <div style={{fontSize:10,color:'var(--chalk3)',marginTop:2}}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11,color:'var(--chalk3)',marginTop:4}}>Active rate: <span style={{color:'var(--green)',fontWeight:600}}>{d.staff_total>0?Math.round((d.staff_active/d.staff_total)*100):0}%</span></div>
                <Pbar fill="var(--green)" pct={d.staff_total>0?Math.round((d.staff_active/d.staff_total)*100):0}/>
              </div>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>Task Completion Rate</div>
                <div style={{textAlign:'center',padding:'16px 0'}}>
                  <div style={{fontFamily:'var(--mono)',fontSize:48,fontWeight:600,background:'var(--brand)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>{Math.round((d.task_completion_rate??0)*100)}%</div>
                  <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>{d.tasks_completed??0} tasks completed</div>
                </div>
                <Pbar fill="var(--brand)" pct={Math.round((d.task_completion_rate??0)*100)}/>
                {d.avg_mttr_hours!=null&&(
                  <div style={{marginTop:14,padding:'8px 12px',background:'var(--bg3)',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:11,color:'var(--chalk3)'}}>Mean Time to Resolution</span>
                    <span style={{fontFamily:'var(--mono)',fontWeight:600,color:'var(--cyan)',fontSize:13}}>{d.avg_mttr_hours}h</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ))}

        {/* ── Staff ── */}
        {tab==='staff'&&(staffLoading?<div style={{color:'var(--chalk3)',fontSize:12,padding:20}}>Loading…</div>:(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div style={card()}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>By Department</div>
              {(sb.by_department??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No data</div>:
                (sb.by_department??[]).map((r:any)=><BreakdownBar key={r.name} label={r.name} count={r.count} total={sb.total??1} color="var(--cyan)"/>)}
            </div>
            <div style={card()}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>By Region</div>
              {(sb.by_region??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No data</div>:
                (sb.by_region??[]).map((r:any)=><BreakdownBar key={r.name} label={r.name} count={r.count} total={sb.total??1} color="var(--violet)"/>)}
            </div>
            <div style={card()}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>By Employment Type</div>
              {(sb.by_employment_type??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No data</div>:
                (sb.by_employment_type??[]).map((r:any)=><BreakdownBar key={r.type} label={r.type} count={r.count} total={sb.total??1} color="var(--amber)"/>)}
            </div>
            <div style={card()}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>By Status</div>
              {(sb.by_status??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No data</div>:
                (sb.by_status??[]).map((r:any)=><BreakdownBar key={r.status} label={r.status} count={r.count} total={sb.total??1} color={r.status==='active'?'var(--green)':r.status==='terminated'?'var(--rose)':'var(--chalk3)'}/>)}
            </div>
          </div>
        ))}

        {/* ── Tasks ── */}
        {tab==='tasks'&&(tasksLoading?<div style={{color:'var(--chalk3)',fontSize:12,padding:20}}>Loading…</div>:(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:14}}>
              <KpiCard label="Total Tasks"  value={tb.total??0}   color="var(--chalk)"/>
              <KpiCard label="Overdue"      value={tb.overdue??0} color="var(--rose)"/>
              <KpiCard label="Completion"   value={tb.total>0?`${Math.round(((tb.by_status??[]).find((s:any)=>s.status==='done')?.count??0)/tb.total*100)}%`:'0%'} color="var(--green)"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>By Status</div>
                {(tb.by_status??[]).map((r:any)=><BreakdownBar key={r.status} label={r.status} count={r.count} total={tb.total??1} color={TASK_STATUS_COLORS[r.status]??'var(--brand)'}/>)}
              </div>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>By Department</div>
                {(tb.by_department??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>Tasks not yet assigned to depts</div>:
                  (tb.by_department??[]).map((r:any)=><BreakdownBar key={r.name} label={r.name} count={r.count} total={tb.total??1} color="var(--brand)"/>)}
              </div>
            </div>
          </>
        ))}

        {/* ── Projects ── */}
        {tab==='projects'&&(projLoading?<div style={{color:'var(--chalk3)',fontSize:12,padding:20}}>Loading…</div>:(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14,marginBottom:14}}>
              <KpiCard label="Total Projects" value={pb.total??0} color="var(--violet)"/>
              <KpiCard label="Active"         value={(pb.by_status??[]).find((s:any)=>s.status==='active')?.count??0} color="var(--green)"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>By Type</div>
                {(pb.by_type??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No projects yet</div>:
                  (pb.by_type??[]).map((r:any)=><BreakdownBar key={r.type} label={r.type} count={r.count} total={pb.total??1} color={PROJECT_TYPE_COLORS[r.type]??'var(--brand)'}/>)}
              </div>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>Pipeline Status</div>
                {(pb.by_pipeline_status??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No data</div>:
                  (pb.by_pipeline_status??[]).map((r:any)=><BreakdownBar key={r.status} label={r.status} count={r.count} total={pb.total??1} color="var(--violet)"/>)}
              </div>
            </div>
          </>
        ))}

        {/* ── Outages & MTTR ── */}
        {tab==='outages'&&(mttrLoading?<div style={{color:'var(--chalk3)',fontSize:12,padding:20}}>Loading…</div>:(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14,marginBottom:14}}>
              <KpiCard label="Total Resolved"    value={mt.total_resolved??0}                                              color="var(--green)"/>
              <KpiCard label="Overall Avg MTTR"  value={mt.overall_mttr_hours!=null?`${mt.overall_mttr_hours}h`:'N/A'}   color="var(--cyan)"/>
            </div>
            <div style={card()}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:16}}>MTTR by Severity</div>
              {Object.keys(mt.by_severity??{}).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No resolved outages in this period</div>:(
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                  {Object.entries(mt.by_severity??{}).map(([sev,data]:any)=>(
                    <div key={sev} style={{padding:14,background:'var(--bg3)',borderRadius:10,border:`1px solid ${SEVERITY_COLORS[sev]??'var(--wire2)'}22`}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:SEVERITY_COLORS[sev]??'var(--chalk3)'}}/>
                        <span style={{fontSize:12,fontWeight:700,color:'var(--chalk)',textTransform:'capitalize'}}>{sev}</span>
                        <span style={badge(SEVERITY_COLORS[sev]??'var(--chalk3)',`${SEVERITY_COLORS[sev]??'var(--chalk3)'}18`,8)}>{data.count} incident{data.count!==1?'s':''}</span>
                      </div>
                      <div style={{display:'flex',gap:12}}>
                        <div style={{textAlign:'center'}}>
                          <div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:600,color:SEVERITY_COLORS[sev]??'var(--chalk)'}}>{data.avg_hours}h</div>
                          <div style={{fontSize:9,color:'var(--chalk3)'}}>Avg MTTR</div>
                        </div>
                        <div style={{textAlign:'center'}}>
                          <div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:600,color:'var(--chalk3)'}}>{data.max_hours}h</div>
                          <div style={{fontSize:9,color:'var(--chalk3)'}}>Max MTTR</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ))}

        {/* ── Infrastructure ── */}
        {tab==='infrastructure'&&(infraLoading?<div style={{color:'var(--chalk3)',fontSize:12,padding:20}}>Loading…</div>:(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:14}}>
              <KpiCard label="Sites"           value={(ir.sites??[]).length}                               color="var(--cyan)"/>
              <KpiCard label="Unresolved Alerts" value={Object.values(ir.alert_summary??{}).reduce((a:any,b:any)=>a+b,0) as number} color="var(--rose)"/>
              <KpiCard label="Critical Alerts" value={(ir.alert_summary??{})['critical']??0}               color="var(--rose)"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={card({padding:0})}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',padding:'12px 14px 0'}}>Site Utilisation</div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Site','Type','Used/Total','Utilisation'].map(h=><th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 14px',borderBottom:'1px solid var(--wire)'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(ir.sites??[]).length===0?<tr><td colSpan={4} style={{textAlign:'center',padding:30,color:'var(--chalk3)',fontSize:12}}>No sites yet</td></tr>
                    :(ir.sites??[]).map((s:any)=>{
                      const pct=s.utilisation_pct??0;
                      const barC=pct>=90?'var(--rose)':pct>=70?'var(--amber)':'var(--green)';
                      return(<tr key={s.id}>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid var(--wire)',fontWeight:600,color:'var(--chalk)',fontSize:12}}>{s.name}</td>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge('var(--cyan)','rgba(6,182,212,.1)')}>{s.site_type}</span></td>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid var(--wire)',fontFamily:'var(--mono)',fontSize:11,color:'var(--chalk3)'}}>{s.used}/{s.total}</td>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid var(--wire)',minWidth:100}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div style={{flex:1,height:5,background:'var(--wire)',borderRadius:3,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:barC,borderRadius:3}}/></div>
                            <span style={{fontSize:10,color:barC,fontFamily:'var(--mono)',fontWeight:700}}>{pct}%</span>
                          </div>
                        </td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>Recent Capacity Alerts</div>
                {(ir.recent_alerts??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No active alerts</div>:
                  (ir.recent_alerts??[]).slice(0,8).map((a:any)=>(
                    <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'7px 0',borderBottom:'1px solid var(--wire)'}}>
                      <div>
                        <div style={{fontSize:11,color:'var(--chalk)',fontWeight:500}}>{a.site_name??a.node_name??'Unknown'}</div>
                        <div style={{fontSize:10,color:'var(--chalk3)',marginTop:2}}>{a.message}</div>
                      </div>
                      <span style={badge(a.severity==='critical'?'var(--rose)':'var(--amber)',a.severity==='critical'?'rgba(244,63,94,.1)':'rgba(251,191,36,.1)')}>{a.severity}</span>
                    </div>
                  ))}
              </div>
            </div>
          </>
        ))}

        {/* ── Shifts ── */}
        {tab==='shifts'&&(shiftsLoading?<div style={{color:'var(--chalk3)',fontSize:12,padding:20}}>Loading…</div>:(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:14}}>
              <KpiCard label="Shift Types"       value={(sr.coverage??[]).length}                              color="var(--violet)"/>
              <KpiCard label="Swap Requests"     value={Object.values(sr.swap_requests??{}).reduce((a:any,b:any)=>a+b,0) as number} color="var(--amber)"/>
              <KpiCard label="Approved Swaps"    value={(sr.swap_requests??{})['approved']??0}                color="var(--green)"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>On-Call Load (30 days)</div>
                {(sr.oncall_load??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No on-call shifts recorded</div>:
                  (sr.oncall_load??[]).map((r:any,i:number)=><BreakdownBar key={i} label={r.staff_name} count={r.oncall_shifts} total={(sr.oncall_load??[]).reduce((a:any,x:any)=>a+x.oncall_shifts,0)||1} color="var(--violet)"/>)}
              </div>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>Swap Request Status</div>
                {Object.entries(sr.swap_requests??{}).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No swap requests in 30 days</div>:
                  Object.entries(sr.swap_requests??{}).map(([status,count]:any)=>(
                    <div key={status} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--wire)'}}>
                      <span style={{fontSize:12,color:'var(--chalk)',textTransform:'capitalize'}}>{status}</span>
                      <span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--amber)',fontSize:13}}>{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </>
        ))}

        {/* ── SLA Compliance ── */}
        {tab==='sla'&&(slaLoading?<div style={{color:'var(--chalk3)',fontSize:12,padding:20}}>Loading…</div>:(
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>Breach Rate by Severity (90 days)</div>
                {(sl.by_severity??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No outage SLA data yet</div>:
                  (sl.by_severity??[]).map((r:any)=>(
                    <div key={r.severity} style={{marginBottom:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:600,color:'var(--chalk)',textTransform:'capitalize'}}>{r.severity}</span>
                        <span style={{fontFamily:'var(--mono)',fontSize:12,color:r.breach_rate_pct>=50?'var(--rose)':'var(--green)',fontWeight:700}}>{r.breach_rate_pct}% breached</span>
                      </div>
                      <div style={{height:6,background:'var(--wire)',borderRadius:3,overflow:'hidden'}}>
                        <div style={{width:`${r.breach_rate_pct}%`,height:'100%',background:r.breach_rate_pct>=50?'var(--rose)':'var(--amber)',borderRadius:3}}/>
                      </div>
                      <div style={{fontSize:10,color:'var(--chalk3)',marginTop:3}}>{r.breached}/{r.total} incidents · {r.avg_mins_to_breach!=null?`avg ${r.avg_mins_to_breach} min to breach`:'n/a'}</div>
                    </div>
                  ))}
              </div>
              <div style={card()}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>Worst OLTs (breach rate)</div>
                {(sl.worst_olts??[]).length===0?<div style={{color:'var(--chalk3)',fontSize:12}}>No OLT data yet</div>:
                  (sl.worst_olts??[]).map((r:any,i:number)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--wire)'}}>
                      <div>
                        <div style={{fontSize:12,color:'var(--chalk)',fontWeight:500,fontFamily:'var(--mono)'}}>{r.olt_reference}</div>
                        <div style={{fontSize:10,color:'var(--chalk3)',marginTop:1}}>{r.total_outages} outages · avg {r.avg_mttr_hours}h MTTR</div>
                      </div>
                      <span style={badge(r.breach_rate_pct>=50?'var(--rose)':'var(--amber)',r.breach_rate_pct>=50?'rgba(244,63,94,.1)':'rgba(251,191,36,.1)')}>{r.breach_rate_pct}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ════════════════════════════════════════════════════════════════
export function AuditPage(){
  const [actionFilter,setActionFilter]=useState('');
  const [page,setPage]=useState(1);

  const {data,isLoading}=useQuery({
    queryKey:['audit',actionFilter,page],
    queryFn:()=>auditApi.list({action:actionFilter||undefined,page}),
  } as any);

  const exportCSV=()=>auditApi.exportCSV().then((blob:any)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='opsyn-audit.csv';a.click();URL.revokeObjectURL(url);}).catch(()=>{});

  const items     =(data as any)?.items??[];
  const total     =(data as any)?.total??0;
  const totalPages=(data as any)?.total_pages??1;
  const AC:Record<string,string>={'staff.created':'var(--green)','staff.status_changed':'var(--amber)','staff.deactivated':'var(--rose)','role.changed':'var(--violet)','onboarding.approved':'var(--cyan)','onboarding.rejected':'var(--rose)','auth.login':'var(--chalk3)','auth.logout':'var(--chalk3)'};

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>Audit Logs</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>Immutable record · {total} total events</div>
          </div>
          <Btn onClick={exportCSV} style={{fontSize:11,padding:'5px 10px'}}>Export CSV</Btn>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          <select id="action-filter" name="action-filter" value={actionFilter} onChange={e=>{setActionFilter(e.target.value);setPage(1);}} style={{background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,color:'var(--chalk2)',padding:'7px 10px',fontFamily:'var(--font)',fontSize:12,cursor:'pointer',outline:'none'}}>
            <option value="">All Actions</option>
            {['staff.created','staff.status_changed','role.changed','onboarding.approved','onboarding.rejected','auth.login','auth.logout'].map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={card({padding:0})}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Timestamp','Actor','Action','Target','IP Address'].map(h=>(
                <th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 14px',borderBottom:'1px solid var(--wire)'}}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {isLoading?<tr><td colSpan={5} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>Loading audit log…</td></tr>
                :items.length===0?<tr><td colSpan={5} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>No audit events found</td></tr>
                :items.map((e:any)=>(
                  <tr key={e.id}>
                    <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontFamily:'var(--mono)',fontSize:11,color:'var(--chalk2)'}}>{new Date(e.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                    <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:12,color:'var(--chalk)'}}>{e.actor_id?e.actor_id.slice(0,8)+'…':'System'}</td>
                    <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge(AC[e.action]||'var(--chalk3)',`${AC[e.action]||'var(--chalk3)'}1a`)}>{e.action}</span></td>
                    <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk2)'}}>{e.target_type}{e.target_id?` · ${e.target_id.slice(0,8)}…`:''}</td>
                    <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontFamily:'var(--mono)',fontSize:11,color:'var(--chalk3)'}}>{e.ip_address??'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderTop:'1px solid var(--wire)'}}>
            <div style={{fontSize:11,color:'var(--chalk3)'}}>Page {page} of {totalPages} · {total} events</div>
            <div style={{display:'flex',gap:4}}>
              <Btn onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:'3px 8px',fontSize:11}}>Prev</Btn>
              <Btn onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} style={{padding:'3px 8px',fontSize:11}}>Next</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// INFRASTRUCTURE MAP
// ════════════════════════════════════════════════════════════════
export function InfrastructurePage(){
  const [tab,setTab]=useState<'sites'|'nodes'|'routes'|'map'>('sites');
  const [siteModal,setSiteModal]=useState(false);
  const [nodeModal,setNodeModal]=useState(false);
  const [routeModal,setRouteModal]=useState(false);
  const [siteForm,setSiteForm]=useState({name:'',site_type:'POP',address:'',status:'active',notes:''});
  const [nodeForm,setNodeForm]=useState({name:'',node_type:'OLT',site_id:'',manufacturer:'',model:'',ip_address:'',status:'active'});
  const [routeForm,setRouteForm]=useState({from_node_id:'',to_node_id:'',cable_type:'',length_km:'',capacity_gbps:'',status:'active'});
  const toast=useToast();
  const qc=useQueryClient();

  const {data:summary}=useQuery({queryKey:['infra','summary'],queryFn:()=>infrastructureApi.getSummary(),refetchInterval:60000});
  const {data:sitesData,isLoading:sitesLoading}=useQuery({queryKey:['infra','sites'],queryFn:()=>infrastructureApi.listSites({size:200})});
  const {data:nodesData,isLoading:nodesLoading}=useQuery({queryKey:['infra','nodes'],queryFn:()=>infrastructureApi.listNodes({size:200})});
  const {data:routesData,isLoading:routesLoading}=useQuery({queryKey:['infra','routes'],queryFn:()=>infrastructureApi.listRoutes({size:200})});

  const sites  = toArr((sitesData  as any)?.items  ?? sitesData);
  const nodes  = toArr((nodesData  as any)?.items  ?? nodesData);
  const routes = toArr((routesData as any)?.items  ?? routesData);

  const nodeOptions = nodes.map((n:any)=>({label:`${n.name} (${n.node_type})`,value:n.id}));
  const siteOptions = sites.map((s:any)=>({label:s.name,value:s.id}));

  const createSite=useMutation({
    mutationFn:()=>infrastructureApi.createSite(siteForm as any),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['infra']});setSiteModal(false);setSiteForm({name:'',site_type:'POP',address:'',status:'active',notes:''});toast.success('Site created');},
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });
  const createNode=useMutation({
    mutationFn:()=>infrastructureApi.createNode(nodeForm as any),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['infra']});setNodeModal(false);setNodeForm({name:'',node_type:'OLT',site_id:'',manufacturer:'',model:'',ip_address:'',status:'active'});toast.success('Node created');},
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });
  const createRoute=useMutation({
    mutationFn:()=>infrastructureApi.createRoute({...routeForm,length_km:routeForm.length_km?parseFloat(routeForm.length_km):undefined,capacity_gbps:routeForm.capacity_gbps?parseFloat(routeForm.capacity_gbps):undefined} as any),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['infra']});setRouteModal(false);setRouteForm({from_node_id:'',to_node_id:'',cable_type:'',length_km:'',capacity_gbps:'',status:'active'});toast.success('Route created');},
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });
  const deleteRoute=useMutation({
    mutationFn:(id:string)=>infrastructureApi.deleteRoute(id),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['infra']});toast.info('Route removed');},
    onError:(e:any)=>toast.error('Failed',e?.detail),
  });

  const STAT_COLOR=(s:string)=>s==='active'?'var(--green)':s==='maintenance'?'var(--amber)':'var(--rose)';
  const summ=summary as any;

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{display:'flex',alignItems:'center',background:'linear-gradient(135deg,rgba(6,182,212,.04),rgba(74,222,128,.04))',borderBottom:'1px solid var(--wire)',padding:'8px 20px',fontSize:11,gap:28,flexWrap:'wrap'}}>
        {[
          {val:summ?.active_sites??'…',label:'Active Sites',color:'var(--cyan)'},
          {val:summ?.active_nodes??'…',label:'Active Nodes',color:'var(--green)'},
          {val:summ?.olt_count??'…',label:'OLTs',color:'var(--violet)'},
          {val:summ?.active_routes??'…',label:'Active Routes',color:'var(--amber)'},
          {val:summ?.total_fiber_km!=null?`${Number(summ.total_fiber_km).toFixed(1)} km`:'…',label:'Total Fiber',color:'var(--chalk)'},
        ].map(item=>(
          <div key={item.label} style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontFamily:'var(--mono)',fontWeight:600,fontSize:13,color:item.color}}>{item.val}</span>
            <span style={{color:'var(--chalk3)'}}>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>Network Infrastructure</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>FTTx asset registry · sites, nodes &amp; fiber routes</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            {tab==='sites'&&<Btn variant="brand" onClick={()=>setSiteModal(true)} style={{fontSize:11,padding:'5px 12px'}}>+ Add Site</Btn>}
            {tab==='nodes'&&<Btn variant="brand" onClick={()=>setNodeModal(true)} style={{fontSize:11,padding:'5px 12px'}}>+ Add Node</Btn>}
            {tab==='routes'&&<Btn variant="brand" onClick={()=>setRouteModal(true)} style={{fontSize:11,padding:'5px 12px'}}>+ Add Route</Btn>}
          </div>
        </div>

        <div style={{display:'flex',gap:2,marginBottom:16,background:'var(--bg2)',borderRadius:10,padding:3,width:'fit-content',border:'1px solid var(--wire)'}}>
          {(['sites','nodes','routes','map'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:'5px 14px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'var(--font)',fontSize:12,fontWeight:600,transition:'all .15s',
              background:tab===t?'var(--bg4)':'transparent',color:tab===t?'var(--chalk)':'var(--chalk3)',
            }}>{t==='map'?'GIS Map':t.charAt(0).toUpperCase()+t.slice(1)}</button>
          ))}
        </div>

        {tab==='sites'&&(
          <div style={card({padding:0})}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Type','Address','Status','Created'].map(h=>(
                  <th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 14px',borderBottom:'1px solid var(--wire)'}}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {sitesLoading?<tr><td colSpan={5} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>Loading sites…</td></tr>
                  :sites.length===0?<tr><td colSpan={5} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>No sites registered yet</td></tr>
                  :sites.map((s:any)=>(
                    <tr key={s.id}>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontWeight:600,color:'var(--chalk)',fontSize:12}}>{s.name}</td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge('var(--cyan)','rgba(6,182,212,.1)')}>{s.site_type}</span></td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk2)'}}>{s.address??'—'}</td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge(STAT_COLOR(s.status),`${STAT_COLOR(s.status)}1a`)}><span style={dot}/>{s.status}</span></td>
                      <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk3)'}}>{new Date(s.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='nodes'&&(
          <div style={card({padding:0})}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Type','IP Address','Manufacturer','Model','Status'].map(h=>(
                  <th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 14px',borderBottom:'1px solid var(--wire)'}}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {nodesLoading?<tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>Loading nodes…</td></tr>
                  :nodes.length===0?<tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>No nodes registered yet</td></tr>
                  :nodes.map((n:any)=>{
                    const tc=n.node_type==='OLT'?'var(--violet)':n.node_type==='AGG'?'var(--cyan)':'var(--amber)';
                    return(
                      <tr key={n.id}>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontWeight:600,color:'var(--chalk)',fontSize:12}}>{n.name}</td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge(tc,`${tc}1a`)}>{n.node_type}</span></td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontFamily:'var(--mono)',fontSize:11,color:'var(--cyan)'}}>{n.ip_address??'—'}</td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk2)'}}>{n.manufacturer??'—'}</td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk2)'}}>{n.model??'—'}</td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge(STAT_COLOR(n.status),`${STAT_COLOR(n.status)}1a`)}><span style={dot}/>{n.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='routes'&&(
          <div style={card({padding:0})}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['From Node','To Node','Cable Type','Length (km)','Capacity (Gbps)','Status','Actions'].map(h=>(
                  <th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 14px',borderBottom:'1px solid var(--wire)'}}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {routesLoading?<tr><td colSpan={7} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>Loading routes…</td></tr>
                  :routes.length===0?<tr><td colSpan={7} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>No fiber routes registered yet</td></tr>
                  :routes.map((r:any)=>{
                    const fn=nodes.find((n:any)=>n.id===r.from_node_id);
                    const tn=nodes.find((n:any)=>n.id===r.to_node_id);
                    return(
                      <tr key={r.id}>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:12,color:'var(--chalk)'}}>{fn?.name??r.from_node_id.slice(0,8)+'…'}</td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:12,color:'var(--chalk)'}}>{tn?.name??r.to_node_id.slice(0,8)+'…'}</td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk2)'}}>{r.cable_type??'—'}</td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontFamily:'var(--mono)',fontSize:11,color:'var(--chalk3)'}}>{r.length_km!=null?Number(r.length_km).toFixed(2):'—'}</td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)',fontFamily:'var(--mono)',fontSize:11,color:'var(--chalk3)'}}>{r.capacity_gbps!=null?Number(r.capacity_gbps).toFixed(1):'—'}</td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}><span style={badge(STAT_COLOR(r.status),`${STAT_COLOR(r.status)}1a`)}><span style={dot}/>{r.status}</span></td>
                        <td style={{padding:'11px 14px',borderBottom:'1px solid var(--wire)'}}>
                          <Btn variant="rose" onClick={()=>deleteRoute.mutate(r.id)} disabled={deleteRoute.isPending} style={{fontSize:11,padding:'3px 8px'}}>Remove</Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='map'&&(
          <div style={{marginLeft:-20,marginRight:-20,marginBottom:-20,height:'calc(100vh - 220px)',minHeight:500}}>
            <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--chalk3)',fontSize:13}}>Loading map…</div>}>
              <InfraMapView/>
            </Suspense>
          </div>
        )}
      </div>

      <Modal open={siteModal} onClose={()=>setSiteModal(false)} title="Register New Site"
        footer={<><Btn onClick={()=>setSiteModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>createSite.mutate()} disabled={!siteForm.name||createSite.isPending}>{createSite.isPending?'Saving…':'Register Site'}</Btn></>}>
        <Inp label="Site Name *" value={siteForm.name} onChange={(v:string)=>setSiteForm(f=>({...f,name:v}))} placeholder="e.g. Lagos Island POP"/>
        <Sel label="Site Type" value={siteForm.site_type} onChange={v=>setSiteForm(f=>({...f,site_type:v}))} options={[{label:'POP',value:'POP'},{label:'Exchange',value:'exchange'},{label:'Cabinet',value:'cabinet'},{label:'Data Centre',value:'data_centre'}]}/>
        <Inp label="Address" value={siteForm.address} onChange={(v:string)=>setSiteForm(f=>({...f,address:v}))} placeholder="Physical address"/>
        <Sel label="Status" value={siteForm.status} onChange={v=>setSiteForm(f=>({...f,status:v}))} options={[{label:'Active',value:'active'},{label:'Maintenance',value:'maintenance'},{label:'Decommissioned',value:'decommissioned'}]}/>
        <div style={{marginBottom:14}}>
          <label style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>Notes</label>
          <textarea value={siteForm.notes} onChange={e=>setSiteForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes…" rows={2}
            style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none',resize:'vertical'}}/>
        </div>
      </Modal>

      <Modal open={nodeModal} onClose={()=>setNodeModal(false)} title="Register New Node"
        footer={<><Btn onClick={()=>setNodeModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>createNode.mutate()} disabled={!nodeForm.name||createNode.isPending}>{createNode.isPending?'Saving…':'Register Node'}</Btn></>}>
        <Inp label="Node Name *" value={nodeForm.name} onChange={(v:string)=>setNodeForm(f=>({...f,name:v}))} placeholder="e.g. OLT-Lagos-024"/>
        <Sel label="Node Type" value={nodeForm.node_type} onChange={v=>setNodeForm(f=>({...f,node_type:v}))} options={[{label:'OLT',value:'OLT'},{label:'Aggregation Switch',value:'AGG'},{label:'Core Router',value:'CORE'},{label:'Access Switch',value:'ACCESS'}]}/>
        <Sel label="Site" value={nodeForm.site_id} onChange={v=>setNodeForm(f=>({...f,site_id:v}))} options={siteOptions}/>
        <Inp label="IP Address" value={nodeForm.ip_address} onChange={(v:string)=>setNodeForm(f=>({...f,ip_address:v}))} placeholder="e.g. 10.0.1.1"/>
        <Inp label="Manufacturer" value={nodeForm.manufacturer} onChange={(v:string)=>setNodeForm(f=>({...f,manufacturer:v}))} placeholder="e.g. Huawei"/>
        <Inp label="Model" value={nodeForm.model} onChange={(v:string)=>setNodeForm(f=>({...f,model:v}))} placeholder="e.g. MA5800-X15"/>
        <Sel label="Status" value={nodeForm.status} onChange={v=>setNodeForm(f=>({...f,status:v}))} options={[{label:'Active',value:'active'},{label:'Maintenance',value:'maintenance'},{label:'Offline',value:'offline'}]}/>
      </Modal>

      <Modal open={routeModal} onClose={()=>setRouteModal(false)} title="Register Fiber Route"
        footer={<><Btn onClick={()=>setRouteModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>createRoute.mutate()} disabled={!routeForm.from_node_id||!routeForm.to_node_id||createRoute.isPending}>{createRoute.isPending?'Saving…':'Register Route'}</Btn></>}>
        <Sel label="From Node *" value={routeForm.from_node_id} onChange={v=>setRouteForm(f=>({...f,from_node_id:v}))} options={nodeOptions}/>
        <Sel label="To Node *" value={routeForm.to_node_id} onChange={v=>setRouteForm(f=>({...f,to_node_id:v}))} options={nodeOptions}/>
        <Sel label="Cable Type" value={routeForm.cable_type} onChange={v=>setRouteForm(f=>({...f,cable_type:v}))} options={[{label:'Single-mode Fiber',value:'SMF'},{label:'Multi-mode Fiber',value:'MMF'},{label:'Aerial ADSS',value:'ADSS'},{label:'Armoured Underground',value:'ARMOURED'}]}/>
        <Inp label="Length (km)" value={routeForm.length_km} onChange={(v:string)=>setRouteForm(f=>({...f,length_km:v}))} type="number" placeholder="e.g. 12.5"/>
        <Inp label="Capacity (Gbps)" value={routeForm.capacity_gbps} onChange={(v:string)=>setRouteForm(f=>({...f,capacity_gbps:v}))} type="number" placeholder="e.g. 100"/>
        <Sel label="Status" value={routeForm.status} onChange={v=>setRouteForm(f=>({...f,status:v}))} options={[{label:'Active',value:'active'},{label:'Maintenance',value:'maintenance'},{label:'Inactive',value:'inactive'}]}/>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SETTINGS ADMIN
// ════════════════════════════════════════════════════════════════

const ROLE_LEVEL_COLOR:Record<number,string>={5:'var(--rose)',4:'var(--amber)',3:'var(--green)',2:'var(--cyan)',1:'var(--chalk3)'};

export function SettingsPage(){
  const qc=useQueryClient();
  const toast=useToast();
  const [tab,setTab]=useState<'org'|'departments'|'roles'|'regions'|'pipelines'|'integrations'|'webhooks'|'notification-rules'>('org');
  const [expandedDept,setExpandedDept]=useState<string|null>(null);
  const [deptModal,setDeptModal]=useState(false);
  const [roleModal,setRoleModal]=useState(false);
  const [regionModal,setRegionModal]=useState(false);
  const [pipelineModal,setPipelineModal]=useState(false);
  const [deptForm,setDeptForm]=useState({name:'',parent_id:''});
  const [roleForm,setRoleForm]=useState({name:'',level:'2',description:''});
  const [regionForm,setRegionForm]=useState({name:'',code:'',parent_id:''});
  const [pipelineForm,setPipelineForm]=useState({name:'',description:''});
  const [orgForm,setOrgForm]=useState({name:'',timezone:''});
  const [orgEditMode,setOrgEditMode]=useState(false);
  const [featureMinLevel,setFeatureMinLevel]=useState<Record<string,number>>({});
  const [webhookKeyModal,setWebhookKeyModal]=useState(false);
  const [webhookApp,setWebhookApp]=useState('sales');
  const [createdSecret,setCreatedSecret]=useState<{app_name:string;secret_key:string}|null>(null);
  const [secretCopied,setSecretCopied]=useState(false);
  const [ruleModal,setRuleModal]=useState(false);
  const [editRule,setEditRule]=useState<any|null>(null);
  const [ruleForm,setRuleForm]=useState({name:'',min_severity:'warning',min_subscribers:'0',channels:[] as string[],message_template:'',is_auto:true,is_active:true});

  const {data:org,isLoading:orgLoading}=useQuery({queryKey:['settings','org'],queryFn:()=>settingsApi.getOrg()});
  const {data:depts=[],isLoading:deptsLoading}=useQuery({queryKey:['settings','departments'],queryFn:()=>settingsApi.getDepartments()});
  const {data:roles=[],isLoading:rolesLoading}=useQuery({queryKey:['settings','roles'],queryFn:()=>settingsApi.getRoles()});
  const {data:regions=[],isLoading:regionsLoading}=useQuery({queryKey:['settings','regions'],queryFn:()=>settingsApi.getRegions()});
  const {data:allFeatures=[]}=useQuery({queryKey:['settings','feature-permissions'],queryFn:()=>settingsApi.getFeaturePermissions()});
  const {data:pipelines=[],isLoading:pipelinesLoading}=useQuery({queryKey:['settings','pipelines'],queryFn:()=>settingsApi.getPipelines(),enabled:tab==='pipelines'});
  const {data:integrations=[],isLoading:integrationsLoading}=useQuery({queryKey:['settings','integrations'],queryFn:()=>settingsApi.getIntegrations(),enabled:tab==='integrations'});
  const {data:webhookKeys=[],isLoading:webhookKeysLoading}=useQuery({queryKey:['settings','webhook-keys'],queryFn:()=>webhooksApi.listKeys(),enabled:tab==='webhooks'});
  const {data:notifRules=[],isLoading:notifRulesLoading}=useQuery({queryKey:['settings','notification-rules'],queryFn:()=>settingsApi.getNotificationRules(),enabled:tab==='notification-rules'});
  const {data:deptFeatures=[]}=useQuery({
    queryKey:['settings','dept-features',expandedDept],
    queryFn:()=>expandedDept?settingsApi.getDeptFeatures(expandedDept):Promise.resolve([]),
    enabled:!!expandedDept,
  });

  const updateOrg=useMutation({
    mutationFn:()=>settingsApi.updateOrg({name:orgForm.name||undefined,timezone:orgForm.timezone||undefined}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','org']});toast.success('Organisation updated');setOrgEditMode(false);},
    onError:()=>toast.error('Failed to update organisation'),
  });
  const createDept=useMutation({
    mutationFn:()=>settingsApi.createDepartment({name:deptForm.name,parent_id:deptForm.parent_id||undefined}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','departments']});toast.success('Department created');setDeptModal(false);setDeptForm({name:'',parent_id:''});},
    onError:()=>toast.error('Failed to create department'),
  });
  const deleteDept=useMutation({
    mutationFn:(id:string)=>settingsApi.deleteDepartment(id),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','departments']});toast.success('Department removed');},
    onError:(e:any)=>toast.error('Cannot delete',e?.response?.data?.detail??'Department may have active staff'),
  });
  const grantFeature=useMutation({
    mutationFn:({deptId,key,level}:{deptId:string;key:string;level:number})=>settingsApi.grantDeptFeature(deptId,key,level),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','dept-features',expandedDept]});toast.success('Feature updated');},
    onError:()=>toast.error('Failed to update feature'),
  });
  const revokeFeature=useMutation({
    mutationFn:({deptId,key}:{deptId:string;key:string})=>settingsApi.revokeDeptFeature(deptId,key),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','dept-features',expandedDept]});toast.success('Feature revoked');},
    onError:()=>toast.error('Failed to revoke feature'),
  });
  const createRole=useMutation({
    mutationFn:()=>settingsApi.createRole({name:roleForm.name,level:Number(roleForm.level),description:roleForm.description||undefined}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','roles']});toast.success('Role created');setRoleModal(false);setRoleForm({name:'',level:'2',description:''});},
    onError:()=>toast.error('Failed to create role'),
  });
  const createRegion=useMutation({
    mutationFn:()=>settingsApi.createRegion({name:regionForm.name,code:regionForm.code,parent_id:regionForm.parent_id||undefined}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','regions']});toast.success('Region created');setRegionModal(false);setRegionForm({name:'',code:'',parent_id:''});},
    onError:()=>toast.error('Failed to create region'),
  });
  const createPipeline=useMutation({
    mutationFn:()=>settingsApi.createPipeline({name:pipelineForm.name,description:pipelineForm.description||undefined}),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','pipelines']});toast.success('Pipeline template created');setPipelineModal(false);setPipelineForm({name:'',description:''});},
    onError:()=>toast.error('Failed to create pipeline'),
  });
  const createWebhookKey=useMutation({
    mutationFn:()=>webhooksApi.createKey(webhookApp),
    onSuccess:(data:any)=>{qc.invalidateQueries({queryKey:['settings','webhook-keys']});setWebhookKeyModal(false);setCreatedSecret({app_name:data.app_name,secret_key:data.secret_key});setSecretCopied(false);},
    onError:()=>toast.error('Failed to create webhook key'),
  });
  const deactivateWebhookKey=useMutation({
    mutationFn:(keyId:string)=>webhooksApi.deactivateKey(keyId),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','webhook-keys']});toast.success('Webhook key revoked');},
    onError:()=>toast.error('Failed to revoke key'),
  });

  const openNewRule=()=>{setEditRule(null);setRuleForm({name:'',min_severity:'warning',min_subscribers:'0',channels:[],message_template:'',is_auto:true,is_active:true});setRuleModal(true);};
  const openEditRule=(r:any)=>{setEditRule(r);setRuleForm({name:r.name,min_severity:r.min_severity,min_subscribers:String(r.min_subscribers),channels:r.channels??[],message_template:r.message_template??'',is_auto:r.is_auto,is_active:r.is_active});setRuleModal(true);};
  const toggleChannel=(ch:string)=>setRuleForm(f=>({...f,channels:f.channels.includes(ch)?f.channels.filter(c=>c!==ch):[...f.channels,ch]}));

  const saveRule=useMutation({
    mutationFn:()=>{
      const payload={name:ruleForm.name,min_severity:ruleForm.min_severity,min_subscribers:Number(ruleForm.min_subscribers),channels:ruleForm.channels,message_template:ruleForm.message_template||undefined,is_auto:ruleForm.is_auto,is_active:ruleForm.is_active};
      return editRule?settingsApi.updateNotificationRule(editRule.id,payload):settingsApi.createNotificationRule(payload);
    },
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','notification-rules']});toast.success(editRule?'Rule updated':'Rule created');setRuleModal(false);},
    onError:()=>toast.error('Failed to save rule'),
  });
  const deleteRule=useMutation({
    mutationFn:(id:string)=>settingsApi.deleteNotificationRule(id),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['settings','notification-rules']});toast.success('Rule deleted');},
    onError:()=>toast.error('Failed to delete rule'),
  });
  const testRule=useMutation({
    mutationFn:(id:string)=>settingsApi.testNotificationRule(id),
    onSuccess:()=>toast.success('Test notification sent'),
    onError:()=>toast.error('Test failed — check rule configuration'),
  });

  const TABS=[
    {key:'org'                as const,label:'Organisation'},
    {key:'departments'        as const,label:'Departments'},
    {key:'roles'              as const,label:'Roles'},
    {key:'regions'            as const,label:'Regions'},
    {key:'pipelines'          as const,label:'Pipelines'},
    {key:'integrations'       as const,label:'Integrations'},
    {key:'webhooks'           as const,label:'Webhooks'},
    {key:'notification-rules' as const,label:'Notification Rules'},
  ];

  const grantedMap:Record<string,number>=Object.fromEntries((deptFeatures as any[]).map((f:any)=>[f.feature_key,f.min_role_level]));
  const o=org as any;

  // Build dept tree: root departments + their children
  const deptArr=depts as any[];
  const rootDepts=deptArr.filter((d:any)=>!d.parent_id);
  const childDepts=(parentId:string)=>deptArr.filter((d:any)=>d.parent_id===parentId);

  // Group features by module
  const featuresByModule:(()=>Record<string,any[]>)=()=>{
    const grouped:Record<string,any[]>={};
    (allFeatures as any[]).forEach((f:any)=>{
      const mod=f.module??'Other';
      if(!grouped[mod])grouped[mod]=[];
      grouped[mod].push(f);
    });
    return grouped;
  };

  const INTEGRATION_CAT_COLOR:Record<string,string>={messaging:'var(--cyan)',project:'var(--violet)',alerting:'var(--rose)',email:'var(--amber)',auth:'var(--green)',automation:'var(--chalk2)'};

  return(
    <div style={{overflow:'auto',flex:1,padding:20}}>
      <div style={{marginBottom:18,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            style={{padding:'7px 16px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)',
              border:tab===t.key?'1px solid rgba(6,182,212,.3)':'1px solid var(--wire2)',
              background:tab===t.key?'linear-gradient(135deg,rgba(74,222,128,.08),rgba(6,182,212,.08))':'transparent',
              color:tab===t.key?'var(--cyan)':'var(--chalk3)',transition:'all .15s'}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==='org'&&(
        <div style={{maxWidth:560}}>
          <div style={card({padding:20})}>
            <SectionHeader title="Organisation Profile" sub="Tenant-level settings and branding"
              action={orgEditMode?undefined:'Edit'} onAction={()=>{setOrgForm({name:o?.name??'',timezone:o?.settings?.timezone??''});setOrgEditMode(true);}}/>
            {orgLoading?<div style={{color:'var(--chalk3)',fontSize:12}}>Loading…</div>:(
              orgEditMode?(
                <>
                  <Inp label="Organisation Name" value={orgForm.name} onChange={(v:string)=>setOrgForm(f=>({...f,name:v}))} placeholder={o?.name}/>
                  <Inp label="Timezone" value={orgForm.timezone} onChange={(v:string)=>setOrgForm(f=>({...f,timezone:v}))} placeholder="e.g. Africa/Lagos"/>
                  <div style={{display:'flex',gap:8,marginTop:4}}>
                    <Btn onClick={()=>setOrgEditMode(false)}>Cancel</Btn>
                    <Btn variant="brand" onClick={()=>updateOrg.mutate()} disabled={updateOrg.isPending}>{updateOrg.isPending?'Saving…':'Save Changes'}</Btn>
                  </div>
                </>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {[
                    {label:'Name',       value:o?.name},
                    {label:'Slug',       value:o?.slug},
                    {label:'Plan',       value:o?.plan},
                    {label:'Max Users',  value:String(o?.max_users??'—')},
                    {label:'Status',     value:o?.is_active?'Active':'Suspended'},
                    {label:'Timezone',   value:o?.settings?.timezone??'UTC'},
                    {label:'Logo URL',   value:o?.settings?.brand?.logo_url??o?.settings?.logo_url??'—'},
                  ].map(row=>(
                    <div key={row.label} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--wire)'}}>
                      <span style={{fontSize:11,color:'var(--chalk3)',width:96,flexShrink:0}}>{row.label}</span>
                      <span style={{fontSize:12,color:'var(--chalk)',fontWeight:500}}>{row.value??'—'}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {tab==='departments'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>Departments <span style={{fontSize:11,color:'var(--chalk3)',fontWeight:400}}>({deptArr.length})</span></div>
            <Btn variant="brand" onClick={()=>setDeptModal(true)}>+ New Department</Btn>
          </div>
          {deptsLoading?<div style={{color:'var(--chalk3)',fontSize:12}}>Loading…</div>:(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {rootDepts.length===0&&deptArr.length===0&&<div style={{textAlign:'center',color:'var(--chalk3)',fontSize:12,padding:32}}>No departments yet. Create your first department.</div>}
              {rootDepts.map((d:any)=>{
                const children=childDepts(d.id);
                const isExp=expandedDept===d.id;
                const grouped=isExp?featuresByModule():{};
                return(
                  <div key={d.id} style={card({padding:0})}>
                    <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer'}}
                      onClick={()=>setExpandedDept(isExp?null:d.id)}>
                      <div style={{fontSize:16,color:'var(--chalk3)',transform:isExp?'rotate(90deg)':'none',transition:'transform .2s',userSelect:'none'}}>›</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13,color:'var(--chalk)'}}>{d.name}</div>
                        {children.length>0&&<div style={{fontSize:10,color:'var(--chalk3)',marginTop:1}}>{children.length} sub-department{children.length!==1?'s':''}</div>}
                      </div>
                      <Btn variant="rose" onClick={(e:any)=>{e.stopPropagation();deleteDept.mutate(d.id);}}
                        disabled={deleteDept.isPending} style={{fontSize:11,padding:'3px 8px'}}>Remove</Btn>
                    </div>
                    {/* Sub-departments */}
                    {isExp&&children.map((c:any)=>(
                      <div key={c.id} style={{marginLeft:32,borderTop:'1px solid var(--wire)',padding:'8px 16px',display:'flex',alignItems:'center',gap:8}}>
                        <div style={{fontSize:11,color:'var(--chalk2)',fontWeight:500}}>↳ {c.name}</div>
                        <Btn variant="rose" onClick={()=>deleteDept.mutate(c.id)} disabled={deleteDept.isPending} style={{fontSize:10,padding:'2px 6px',marginLeft:'auto'}}>Remove</Btn>
                      </div>
                    ))}
                    {/* Feature access grouped by module */}
                    {isExp&&(
                      <div style={{borderTop:'1px solid var(--wire)',padding:'12px 16px'}}>
                        <div style={{fontSize:11,fontWeight:700,color:'var(--chalk3)',marginBottom:10,textTransform:'uppercase',letterSpacing:'.08em'}}>Feature Access</div>
                        {Object.keys(grouped).length===0?<div style={{fontSize:12,color:'var(--chalk3)'}}>No features defined</div>:(
                          Object.entries(grouped).map(([mod,features])=>(
                            <div key={mod} style={{marginBottom:14}}>
                              <div style={{fontSize:9,fontWeight:700,color:'var(--brand)',textTransform:'uppercase',letterSpacing:'.12em',marginBottom:6}}>{mod}</div>
                              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                                {(features as any[]).map((f:any)=>{
                                  const grantedLevel=grantedMap[f.feature_key];
                                  const granted=grantedLevel!==undefined;
                                  const minLevel=featureMinLevel[f.feature_key]??1;
                                  return(
                                    <div key={f.feature_key} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,fontSize:11,
                                      background:granted?'rgba(74,222,128,.1)':'rgba(255,255,255,.04)',
                                      border:`1px solid ${granted?'rgba(74,222,128,.3)':'var(--wire2)'}`,}}>
                                      <button onClick={()=>granted?revokeFeature.mutate({deptId:d.id,key:f.feature_key}):grantFeature.mutate({deptId:d.id,key:f.feature_key,level:minLevel})}
                                        title={f.description??f.feature_label}
                                        style={{background:'none',border:'none',cursor:'pointer',color:granted?'var(--green)':'var(--chalk3)',fontWeight:600,fontSize:11,fontFamily:'var(--font)',padding:0}}>
                                        {granted?'✓ ':''}{f.feature_label}
                                      </button>
                                      {granted&&(
                                        <select value={grantedLevel} onChange={e=>{const l=Number(e.target.value);grantFeature.mutate({deptId:d.id,key:f.feature_key,level:l});}}
                                          style={{background:'transparent',border:'none',color:'var(--chalk3)',fontSize:9,cursor:'pointer',outline:'none',fontFamily:'var(--font)'}}>
                                          {[1,2,3,4,5].map(l=><option key={l} value={l}>L{l}+</option>)}
                                        </select>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab==='roles'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>Roles <span style={{fontSize:11,color:'var(--chalk3)',fontWeight:400}}>({(roles as any[]).length})</span></div>
            <Btn variant="brand" onClick={()=>setRoleModal(true)}>+ New Role</Btn>
          </div>
          {rolesLoading?<div style={{color:'var(--chalk3)',fontSize:12}}>Loading…</div>:(
            <div style={card({padding:0})}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Role Name','Level','Type','Description'].map(h=>(
                  <th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 16px',borderBottom:'1px solid var(--wire)'}}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {(roles as any[]).map((r:any)=>{
                    const lc=ROLE_LEVEL_COLOR[r.level as number]??'var(--chalk3)';
                    return(
                      <tr key={r.id}>
                        <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)',fontWeight:600,fontSize:12,color:'var(--chalk)'}}>{r.name}</td>
                        <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)'}}><span style={badge(lc,`${lc}1a`)}>{r.level}</span></td>
                        <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)'}}><span style={badge(r.is_system_role?'var(--violet)':'var(--chalk3)',r.is_system_role?'rgba(139,92,246,.1)':'rgba(255,255,255,.05)')}>{r.is_system_role?'System':'Custom'}</span></td>
                        <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk3)'}}>{r.description??'—'}</td>
                      </tr>
                    );
                  })}
                  {(roles as any[]).length===0&&<tr><td colSpan={4} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>No roles defined</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab==='regions'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>Regions <span style={{fontSize:11,color:'var(--chalk3)',fontWeight:400}}>({(regions as any[]).length})</span></div>
            <Btn variant="brand" onClick={()=>setRegionModal(true)}>+ New Region</Btn>
          </div>
          {regionsLoading?<div style={{color:'var(--chalk3)',fontSize:12}}>Loading…</div>:(
            <div style={card({padding:0})}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Region Name','Code','Parent',''].map(h=>(
                  <th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 16px',borderBottom:'1px solid var(--wire)'}}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {(regions as any[]).map((r:any)=>{
                    const parent=(regions as any[]).find((x:any)=>x.id===r.parent_id);
                    return(
                      <tr key={r.id}>
                        <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)',fontWeight:600,fontSize:12,color:'var(--chalk)'}}>{r.name}</td>
                        <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)'}}><span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--cyan)'}}>{r.code}</span></td>
                        <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk3)'}}>{parent?.name??'—'}</td>
                        <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)'}}></td>
                      </tr>
                    );
                  })}
                  {(regions as any[]).length===0&&<tr><td colSpan={4} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>No regions defined</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab==='pipelines'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>Pipeline Templates <span style={{fontSize:11,color:'var(--chalk3)',fontWeight:400}}>({(pipelines as any[]).length})</span></div>
            <Btn variant="brand" onClick={()=>setPipelineModal(true)}>+ New Pipeline</Btn>
          </div>
          {pipelinesLoading?<div style={{color:'var(--chalk3)',fontSize:12}}>Loading…</div>:(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {(pipelines as any[]).map((p:any)=>(
                <div key={p.id} style={card({padding:16})}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>{p.name}</div>
                      {p.description&&<div style={{fontSize:11,color:'var(--chalk3)',marginTop:2}}>{p.description}</div>}
                    </div>
                    <span style={badge(p.is_active?'var(--green)':'var(--chalk3)',p.is_active?'rgba(74,222,128,.1)':'rgba(255,255,255,.05)')}>{p.is_active?'Active':'Inactive'}</span>
                  </div>
                  {p.stages?.length>0&&(
                    <div style={{marginTop:12,display:'flex',gap:4,flexWrap:'wrap'}}>
                      {p.stages.map((s:any,i:number)=>(
                        <span key={s.id} style={{fontSize:10,padding:'2px 8px',borderRadius:4,background:'rgba(6,182,212,.08)',border:'1px solid rgba(6,182,212,.15)',color:'var(--chalk2)'}}>
                          {i+1}. {s.stage_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {(pipelines as any[]).length===0&&<div style={{textAlign:'center',color:'var(--chalk3)',fontSize:12,padding:32}}>No pipeline templates. Create one to apply to projects.</div>}
            </div>
          )}
        </div>
      )}

      {tab==='integrations'&&(
        <div>
          <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)',marginBottom:14}}>Available Integrations</div>
          {integrationsLoading?<div style={{color:'var(--chalk3)',fontSize:12}}>Loading…</div>:(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
              {(integrations as any[]).map((i:any)=>(
                <div key={i.key} style={card({padding:16,opacity:i.status==='coming_soon'?0.6:1})}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>{i.name}</div>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      {i.status==='coming_soon'&&<span style={badge('var(--chalk3)','rgba(255,255,255,.05)')}>Soon</span>}
                      <span style={badge(INTEGRATION_CAT_COLOR[i.category]??'var(--chalk3)',`${INTEGRATION_CAT_COLOR[i.category]??'var(--chalk3)'}18`)}>{i.category}</span>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:'var(--chalk3)',lineHeight:1.5,marginBottom:12}}>{i.description}</div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:i.enabled?'var(--green)':'var(--wire2)'}}/>
                    <span style={{fontSize:11,color:i.enabled?'var(--green)':'var(--chalk3)'}}>{i.enabled?'Connected':'Not connected'}</span>
                    {i.status!=='coming_soon'&&!i.enabled&&(
                      <Btn variant="brand" style={{fontSize:10,padding:'3px 10px',marginLeft:'auto'}}>Configure</Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab==='webhooks'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>Webhook API Keys</div>
              <div style={{fontSize:11,color:'var(--chalk3)',marginTop:2}}>HMAC-SHA256 signed receiver at <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--cyan)'}}>POST /api/v1/webhooks/receive</span></div>
            </div>
            <Btn variant="brand" onClick={()=>setWebhookKeyModal(true)}>+ New Key</Btn>
          </div>
          {webhookKeysLoading?<div style={{color:'var(--chalk3)',fontSize:12}}>Loading…</div>:(
            <div style={card({padding:0})}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['App','Created','Status',''].map(h=>(
                  <th key={h} style={{textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--chalk3)',padding:'9px 16px',borderBottom:'1px solid var(--wire)'}}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {(webhookKeys as any[]).filter((k:any)=>k.is_active).map((k:any)=>(
                    <tr key={k.id}>
                      <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)'}}>
                        <span style={badge('var(--cyan)','rgba(6,182,212,.1)')}>{k.app_name}</span>
                      </td>
                      <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)',fontSize:11,color:'var(--chalk3)',fontFamily:'var(--mono)'}}>{new Date(k.created_at).toLocaleDateString()}</td>
                      <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)'}}><span style={badge('var(--green)','rgba(74,222,128,.1)')}>Active</span></td>
                      <td style={{padding:'11px 16px',borderBottom:'1px solid var(--wire)',textAlign:'right'}}>
                        <Btn variant="rose" onClick={()=>{if(confirm(`Revoke ${k.app_name} key?`))deactivateWebhookKey.mutate(k.id);}} disabled={deactivateWebhookKey.isPending} style={{fontSize:10,padding:'3px 8px'}}>Revoke</Btn>
                      </td>
                    </tr>
                  ))}
                  {(webhookKeys as any[]).filter((k:any)=>k.is_active).length===0&&(
                    <tr><td colSpan={4} style={{textAlign:'center',padding:40,color:'var(--chalk3)',fontSize:12}}>No active webhook keys. Create one to integrate external apps.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div style={{marginTop:20,padding:16,background:'rgba(6,182,212,.05)',borderRadius:10,border:'1px solid rgba(6,182,212,.15)'}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--cyan)',marginBottom:8}}>Supported Apps</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {['hr','finance','sales','field_tech','coverage'].map(a=>(
                <span key={a} style={badge('var(--chalk2)','rgba(255,255,255,.06)')}>{a}</span>
              ))}
            </div>
            <div style={{fontSize:11,color:'var(--chalk3)',marginTop:10,lineHeight:1.6}}>
              Each key is HMAC-SHA256 signed. Send <span style={{fontFamily:'var(--mono)',color:'var(--chalk2)'}}>X-Webhook-App</span>, <span style={{fontFamily:'var(--mono)',color:'var(--chalk2)'}}>X-Webhook-Tenant</span>, and <span style={{fontFamily:'var(--mono)',color:'var(--chalk2)'}}>X-Webhook-Signature: sha256=…</span> headers with every request. See <span style={{fontFamily:'var(--mono)',color:'var(--cyan)'}}>backend/demos/sales_webhook_demo.py</span> for a reference implementation.
            </div>
          </div>
        </div>
      )}

      {tab==='notification-rules'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>Outage Notification Rules</div>
              <div style={{fontSize:11,color:'var(--chalk3)',marginTop:2}}>Auto-fire SMS, Email, or WhatsApp alerts when outages match thresholds</div>
            </div>
            <Btn variant="brand" onClick={openNewRule}>+ New Rule</Btn>
          </div>
          {notifRulesLoading?<div style={{color:'var(--chalk3)',fontSize:12}}>Loading…</div>:(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {(notifRules as any[]).length===0&&<div style={{textAlign:'center',color:'var(--chalk3)',fontSize:12,padding:40}}>No notification rules yet. Create one to auto-alert customers during outages.</div>}
              {(notifRules as any[]).map((r:any)=>{
                const SEV_COLOR:Record<string,string>={critical:'var(--rose)',high:'var(--amber)',warning:'var(--cyan)',low:'var(--chalk3)'};
                const sc=SEV_COLOR[r.min_severity]??'var(--chalk3)';
                return(
                  <div key={r.id} style={{...card({padding:16}),opacity:r.is_active?1:0.55}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                          <span style={{fontWeight:700,fontSize:13,color:'var(--chalk)'}}>{r.name}</span>
                          {r.is_auto&&<span style={badge('var(--green)','rgba(74,222,128,.1)')}>Auto</span>}
                          <span style={badge(r.is_active?'var(--green)':'var(--chalk3)',r.is_active?'rgba(74,222,128,.1)':'rgba(255,255,255,.05)')}>{r.is_active?'Active':'Inactive'}</span>
                        </div>
                        <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:11,color:'var(--chalk3)'}}>
                          <span>Min severity: <span style={{color:sc,fontWeight:600}}>{r.min_severity}</span></span>
                          <span>Min subscribers: <span style={{color:'var(--chalk2)',fontWeight:600}}>{r.min_subscribers}</span></span>
                          <span>Channels: {(r.channels??[]).map((ch:string)=>(
                            <span key={ch} style={{...badge('var(--cyan)','rgba(6,182,212,.1)'),marginLeft:4,fontSize:10}}>{ch}</span>
                          ))}</span>
                        </div>
                        {r.message_template&&<div style={{marginTop:8,fontFamily:'var(--mono)',fontSize:10,color:'var(--chalk3)',background:'var(--bg3)',borderRadius:6,padding:'6px 10px',lineHeight:1.5,whiteSpace:'pre-wrap'}}>{r.message_template}</div>}
                      </div>
                      <div style={{display:'flex',gap:6,flexShrink:0}}>
                        <Btn onClick={()=>testRule.mutate(r.id)} disabled={testRule.isPending} style={{fontSize:10,padding:'4px 10px'}}>Test</Btn>
                        <Btn onClick={()=>openEditRule(r)} style={{fontSize:10,padding:'4px 10px'}}>Edit</Btn>
                        <Btn variant="rose" onClick={()=>{if(confirm(`Delete rule "${r.name}"?`))deleteRule.mutate(r.id);}} disabled={deleteRule.isPending} style={{fontSize:10,padding:'4px 10px'}}>Delete</Btn>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Created-secret reveal modal ── */}
      {createdSecret&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'var(--bg2)',borderRadius:14,padding:28,width:520,maxWidth:'95vw',border:'1px solid var(--wire2)',boxShadow:'0 24px 64px rgba(0,0,0,.5)'}}>
            <div style={{fontWeight:800,fontSize:16,color:'var(--chalk)',marginBottom:4}}>Webhook Key Created</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginBottom:20}}>App: <span style={badge('var(--cyan)','rgba(6,182,212,.1)')}>{createdSecret.app_name}</span></div>
            <div style={{padding:14,background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.25)',borderRadius:8,marginBottom:16,fontSize:11,color:'var(--amber)',lineHeight:1.5}}>
              ⚠ Store this secret immediately — it will not be shown again.
            </div>
            <div style={{fontWeight:700,fontSize:11,color:'var(--chalk3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'.08em'}}>Secret Key</div>
            <div style={{display:'flex',gap:8,alignItems:'stretch',marginBottom:20}}>
              <div style={{flex:1,fontFamily:'var(--mono)',fontSize:12,padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,color:'var(--chalk)',wordBreak:'break-all',lineHeight:1.6}}>{createdSecret.secret_key}</div>
              <Btn onClick={()=>{navigator.clipboard.writeText(createdSecret.secret_key).then(()=>setSecretCopied(true));}} style={{padding:'0 14px',whiteSpace:'nowrap',alignSelf:'stretch'}}>{secretCopied?'Copied ✓':'Copy'}</Btn>
            </div>
            <div style={{fontSize:11,color:'var(--chalk3)',marginBottom:20,lineHeight:1.6}}>
              Use as <span style={{fontFamily:'var(--mono)',color:'var(--chalk2)'}}>X-Webhook-Signature: sha256=HMAC_SHA256(secret, body)</span> in your integration.
            </div>
            <Btn variant="brand" onClick={()=>setCreatedSecret(null)} style={{width:'100%'}}>Done — I've saved the secret</Btn>
          </div>
        </div>
      )}

      <Modal open={deptModal} onClose={()=>setDeptModal(false)} title="New Department"
        footer={<><Btn onClick={()=>setDeptModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>createDept.mutate()} disabled={!deptForm.name||createDept.isPending}>{createDept.isPending?'Creating…':'Create Department'}</Btn></>}>
        <Inp label="Department Name *" value={deptForm.name} onChange={(v:string)=>setDeptForm(f=>({...f,name:v}))} placeholder="e.g. Field Operations"/>
        <Sel label="Parent Department (optional)" value={deptForm.parent_id} onChange={v=>setDeptForm(f=>({...f,parent_id:v}))}
          options={[{label:'— None (root department) —',value:''},...rootDepts.map((d:any)=>({label:d.name,value:d.id}))]}/>
      </Modal>

      <Modal open={roleModal} onClose={()=>setRoleModal(false)} title="New Custom Role"
        footer={<><Btn onClick={()=>setRoleModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>createRole.mutate()} disabled={!roleForm.name||createRole.isPending}>{createRole.isPending?'Creating…':'Create Role'}</Btn></>}>
        <Inp label="Role Name *" value={roleForm.name} onChange={(v:string)=>setRoleForm(f=>({...f,name:v}))} placeholder="e.g. Network Technician"/>
        <Sel label="Level (1–4)" value={roleForm.level} onChange={v=>setRoleForm(f=>({...f,level:v}))} options={[{label:'1 — Basic Staff',value:'1'},{label:'2 — Standard',value:'2'},{label:'3 — Team Lead',value:'3'},{label:'4 — Manager',value:'4'}]}/>
        <Inp label="Description" value={roleForm.description} onChange={(v:string)=>setRoleForm(f=>({...f,description:v}))} placeholder="Optional description"/>
      </Modal>

      <Modal open={regionModal} onClose={()=>setRegionModal(false)} title="New Region"
        footer={<><Btn onClick={()=>setRegionModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>createRegion.mutate()} disabled={!regionForm.name||!regionForm.code||createRegion.isPending}>{createRegion.isPending?'Creating…':'Create Region'}</Btn></>}>
        <Inp label="Region Name *" value={regionForm.name} onChange={(v:string)=>setRegionForm(f=>({...f,name:v}))} placeholder="e.g. South-West Zone"/>
        <Inp label="Region Code *" value={regionForm.code} onChange={(v:string)=>setRegionForm(f=>({...f,code:v.toUpperCase()}))} placeholder="e.g. SWZ"/>
        <Sel label="Parent Region (optional)" value={regionForm.parent_id} onChange={v=>setRegionForm(f=>({...f,parent_id:v}))}
          options={[{label:'— None —',value:''},...(regions as any[]).map((r:any)=>({label:`${r.name} (${r.code})`,value:r.id}))]}/>
      </Modal>

      <Modal open={pipelineModal} onClose={()=>setPipelineModal(false)} title="New Pipeline Template"
        footer={<><Btn onClick={()=>setPipelineModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>createPipeline.mutate()} disabled={!pipelineForm.name||createPipeline.isPending}>{createPipeline.isPending?'Creating…':'Create Pipeline'}</Btn></>}>
        <Inp label="Pipeline Name *" value={pipelineForm.name} onChange={(v:string)=>setPipelineForm(f=>({...f,name:v}))} placeholder="e.g. Cable Upgrade Workflow"/>
        <div style={{marginBottom:14}}>
          <label style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>Description</label>
          <textarea value={pipelineForm.description} onChange={e=>setPipelineForm(f=>({...f,description:e.target.value}))} rows={2}
            placeholder="Optional description of this pipeline template…"
            style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--font)',fontSize:12,outline:'none',resize:'vertical'}}/>
        </div>
      </Modal>

      <Modal open={webhookKeyModal} onClose={()=>setWebhookKeyModal(false)} title="New Webhook Key"
        footer={<><Btn onClick={()=>setWebhookKeyModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>createWebhookKey.mutate()} disabled={createWebhookKey.isPending}>{createWebhookKey.isPending?'Creating…':'Generate Key'}</Btn></>}>
        <Sel label="App *" value={webhookApp} onChange={(v:string)=>setWebhookApp(v)}
          options={[
            {label:'HR — staff lifecycle events',    value:'hr'},
            {label:'Finance — project budget events', value:'finance'},
            {label:'Sales — lead events',             value:'sales'},
            {label:'Field Tech — outage signals',     value:'field_tech'},
            {label:'Coverage — network events',       value:'coverage'},
          ]}/>
        <div style={{padding:'10px 12px',background:'rgba(6,182,212,.05)',borderRadius:8,fontSize:11,color:'var(--chalk3)',lineHeight:1.5}}>
          A unique HMAC-SHA256 secret will be generated. You will only see it once — store it securely in your integration.
        </div>
      </Modal>

      <Modal open={ruleModal} onClose={()=>setRuleModal(false)} title={editRule?'Edit Notification Rule':'New Notification Rule'}
        footer={<><Btn onClick={()=>setRuleModal(false)}>Cancel</Btn><Btn variant="brand" onClick={()=>saveRule.mutate()} disabled={!ruleForm.name||ruleForm.channels.length===0||saveRule.isPending}>{saveRule.isPending?'Saving…':editRule?'Save Changes':'Create Rule'}</Btn></>}>
        <Inp label="Rule Name *" value={ruleForm.name} onChange={(v:string)=>setRuleForm(f=>({...f,name:v}))} placeholder="e.g. Critical Alert — All Channels"/>
        <Sel label="Min Severity" value={ruleForm.min_severity} onChange={v=>setRuleForm(f=>({...f,min_severity:v}))}
          options={[{label:'Critical',value:'critical'},{label:'High',value:'high'},{label:'Warning',value:'warning'},{label:'Low',value:'low'}]}/>
        <Inp label="Min Subscribers" value={ruleForm.min_subscribers} onChange={(v:string)=>setRuleForm(f=>({...f,min_subscribers:v}))} type="number" placeholder="0"/>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.1em'}}>Channels *</div>
          <div style={{display:'flex',gap:8}}>
            {(['sms','email','whatsapp'] as const).map(ch=>(
              <div key={ch} onClick={()=>toggleChannel(ch)}
                style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,transition:'all .15s',
                  background:ruleForm.channels.includes(ch)?'rgba(6,182,212,.12)':'rgba(255,255,255,.04)',
                  border:`1px solid ${ruleForm.channels.includes(ch)?'rgba(6,182,212,.35)':'var(--wire2)'}`,
                  color:ruleForm.channels.includes(ch)?'var(--cyan)':'var(--chalk3)'}}>
                {ruleForm.channels.includes(ch)&&<span style={{fontSize:10}}>✓</span>}
                {ch.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:'block',fontSize:9,fontWeight:700,color:'var(--chalk3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'.1em'}}>Message Template</label>
          <textarea value={ruleForm.message_template} onChange={e=>setRuleForm(f=>({...f,message_template:e.target.value}))} rows={3}
            placeholder="Outage {reference}: {title} ({severity}). Status: {status}. Subs affected: {subscribers}."
            style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,padding:'9px 12px',color:'var(--chalk)',fontFamily:'var(--mono)',fontSize:11,outline:'none',resize:'vertical',lineHeight:1.6}}/>
          <div style={{fontSize:10,color:'var(--chalk3)',marginTop:4}}>Variables: <span style={{fontFamily:'var(--mono)',color:'var(--chalk2)'}}>&#123;reference&#125; &#123;title&#125; &#123;severity&#125; &#123;status&#125; &#123;olt&#125; &#123;subscribers&#125;</span></div>
        </div>
        <div style={{display:'flex',gap:16,marginBottom:4}}>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,color:'var(--chalk2)'}}>
            <input type="checkbox" checked={ruleForm.is_auto} onChange={e=>setRuleForm(f=>({...f,is_auto:e.target.checked}))}
              style={{accentColor:'var(--brand)',width:14,height:14}}/>
            Auto-fire on new outages
          </label>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,color:'var(--chalk2)'}}>
            <input type="checkbox" checked={ruleForm.is_active} onChange={e=>setRuleForm(f=>({...f,is_active:e.target.checked}))}
              style={{accentColor:'var(--brand)',width:14,height:14}}/>
            Rule active
          </label>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ACTIVITY TIMELINE
// ════════════════════════════════════════════════════════════════
export function ActivityPage(){
  const [entityFilter,setEntityFilter]=useState('');
  const [page,setPage]=useState(1);
  const qc=useQueryClient();

  const {data,isLoading,refetch}=useQuery({
    queryKey:['activity','global',entityFilter,page],
    queryFn:()=>activityApi.getGlobalFeed({entity_type:entityFilter||undefined,page,size:50}),
    refetchInterval:30000,
  });

  const items=(data as any)?.items??[];
  const total=(data as any)?.total??0;
  const totalPages=(data as any)?.total_pages??1;

  const ENTITY_COLORS:Record<string,string>={
    task:'var(--cyan)',project:'var(--violet)',outage:'var(--rose)',
    staff:'var(--green)',onboarding:'var(--amber)',system:'var(--chalk3)',
  };
  const EVENT_ICONS:Record<string,string>={
    comment:'💬',status_change:'🔄',created:'✨',approved:'✅',
    rejected:'❌',resolved:'✅',assigned:'👤',updated:'✏️',
  };

  return(
    <div style={{overflow:'auto',flex:1}}>
      <div style={{display:'flex',alignItems:'center',background:'linear-gradient(135deg,rgba(6,182,212,.04),rgba(139,92,246,.04))',borderBottom:'1px solid var(--wire)',padding:'8px 20px',fontSize:11,gap:16,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'var(--brand)',display:'block',animation:'pulse 2s infinite'}}/>
          <span style={{color:'var(--chalk3)'}}>Live feed · 30s refresh</span>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--chalk3)'}}>
          <span style={{fontFamily:'var(--mono)',fontWeight:600,color:'var(--cyan)'}}>{total}</span> total events
        </div>
      </div>

      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'var(--chalk)',letterSpacing:'-.03em'}}>Activity Feed</div>
            <div style={{fontSize:12,color:'var(--chalk3)',marginTop:4}}>Tenant-wide operational event stream · all entities</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <select value={entityFilter} onChange={e=>{setEntityFilter(e.target.value);setPage(1);}}
              style={{background:'var(--bg3)',border:'1px solid var(--wire2)',borderRadius:8,color:'var(--chalk2)',padding:'7px 10px',fontFamily:'var(--font)',fontSize:12,cursor:'pointer',outline:'none'}}>
              <option value="">All Entities</option>
              {['task','project','outage','staff','onboarding','system'].map(t=>(
                <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
              ))}
            </select>
            <Btn onClick={()=>refetch()} style={{fontSize:11,padding:'5px 10px'}}>Refresh</Btn>
          </div>
        </div>

        {isLoading?(
          <div style={{textAlign:'center',padding:60,color:'var(--chalk3)',fontSize:12}}>Loading activity feed…</div>
        ):items.length===0?(
          <div style={{textAlign:'center',padding:60,color:'var(--chalk3)',fontSize:12}}>
            <div style={{fontSize:28,marginBottom:12}}>📋</div>
            <div>No activity events yet</div>
            <div style={{fontSize:11,marginTop:6,opacity:.6}}>Events appear here as users interact with tasks, projects, outages, and staff</div>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:0}}>
            {items.map((e:any,idx:number)=>{
              const ecolor=ENTITY_COLORS[e.entity_type]||'var(--chalk3)';
              const icon=EVENT_ICONS[e.event_type]||'📌';
              const ts=new Date(e.created_at);
              const timeStr=ts.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
              return(
                <div key={e.id??idx} style={{display:'flex',gap:12,padding:'14px 0',borderBottom:'1px solid var(--wire)',position:'relative'}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0,width:32}}>
                    <div style={{width:32,height:32,borderRadius:9,background:'var(--bg3)',border:`1px solid ${ecolor}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>{icon}</div>
                    {idx<items.length-1&&<div style={{width:1,flex:1,background:'var(--wire)',marginTop:6}}/>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:8,flexWrap:'wrap'}}>
                      <span style={badge(ecolor,`${ecolor}1a`)}>{e.entity_type}</span>
                      <span style={{fontSize:12,fontWeight:600,color:'var(--chalk)',flex:1}}>{e.body||e.event_type}</span>
                    </div>
                    {e.meta&&Object.keys(e.meta).length>0&&(
                      <div style={{marginTop:5,fontSize:11,color:'var(--chalk3)',fontFamily:'var(--mono)',background:'var(--bg3)',borderRadius:6,padding:'4px 8px',display:'inline-block',maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {Object.entries(e.meta).slice(0,3).map(([k,v])=>`${k}: ${v}`).join(' · ')}
                      </div>
                    )}
                    <div style={{display:'flex',gap:12,marginTop:5,alignItems:'center'}}>
                      {e.entity_id&&<span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--chalk3)'}}>{String(e.entity_id).slice(0,8)}…</span>}
                      {e.actor_username&&<span style={{fontSize:11,color:'var(--chalk2)'}}>by {e.actor_username}</span>}
                      <span style={{fontSize:10,color:'var(--chalk3)',marginLeft:'auto'}}>{timeStr}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages>1&&(
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:16,paddingTop:14,borderTop:'1px solid var(--wire)'}}>
            <div style={{fontSize:11,color:'var(--chalk3)'}}>Page {page} of {totalPages} · {total} events</div>
            <div style={{display:'flex',gap:4}}>
              <Btn onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:'3px 8px',fontSize:11}}>← Prev</Btn>
              <Btn onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} style={{padding:'3px 8px',fontSize:11}}>Next →</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

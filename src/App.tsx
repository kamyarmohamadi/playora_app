import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowLeft, Bell, Check, ChevronDown, CircleHelp, Clock3, Compass, Gamepad2, Gift, Grid2X2, Heart, Home, Info, Medal, Menu, MessageCircle, Plus, Search, Settings2, ShieldCheck, Sparkles, Swords, Trophy, Users, X } from "lucide-react";

type Page = "home" | "games" | "friends" | "leaderboard" | "profile";
type Game = { id:string; title:string; category:string; description:string; players:string; duration:string; status:string; icon:LucideIcon; art:string };
const games:Game[] = [
  {id:"backgammon",title:"تخته‌نرد",category:"فکری و رومیزی",description:"یک رقابت دوستانه با طعم خاطره",players:"۲ بازیکن",duration:"۱۰–۲۰ دقیقه",status:"در حال آماده‌سازی",icon:Grid2X2,art:"board"},
  {id:"chess",title:"شطرنج",category:"استراتژی",description:"حرکت بعدی رو هوشمندانه انتخاب کن",players:"۲ بازیکن",duration:"۱۵ دقیقه",status:"به‌زودی",icon:Medal,art:"chess"},
  {id:"tictactoe",title:"دوز",category:"سریع و دوستانه",description:"ساده، سریع و همیشه هیجان‌انگیز",players:"۲ بازیکن",duration:"۲–۵ دقیقه",status:"به‌زودی",icon:Plus,art:"tic"},
  {id:"hokm",title:"حکم",category:"ورق",description:"تیمت رو جمع کن و برای برد بجنگ",players:"۴ بازیکن",duration:"۲۰ دقیقه",status:"به‌زودی",icon:Swords,art:"cards"}
];
const nav:{id:Page;label:string;icon:LucideIcon}[]=[
  {id:"home",label:"خانه",icon:Home},{id:"games",label:"بازی‌ها",icon:Grid2X2},
  {id:"friends",label:"دوستان",icon:Users},{id:"leaderboard",label:"جدول برترین‌ها",icon:Trophy}
];

function Artwork({game}:{game:Game}) {
  const Icon=game.icon;
  return <div className={"game-art art-"+game.art} aria-hidden="true">
    {game.art==="board"?<div className="mini-board">{Array.from({length:12},(_,i)=><i key={i} className={i%2?"point-dark":""}/>)}<div className="checkers"><b/><b/><b/><b/><i/><i/><i/><i/></div></div>
    :game.art==="chess"?<span className="chess-piece">♞</span>
    :game.art==="tic"?<div className="tic-grid">{["×","○","○","×","×","○","○","×","×"].map((s,i)=><span key={i}>{s}</span>)}</div>
    :<div className="playing-cards"><span>♠</span><span>♥</span><span>♦</span></div>}
    <span className="art-star star-a"><Sparkles size={15}/></span><span className="art-star star-b"><Icon size={17}/></span>
  </div>;
}

function GameCard({game,onSelect,saved,onToggleSave,showSave=false}:{game:Game;onSelect:(name:string)=>void;saved:boolean;onToggleSave:()=>void;showSave?:boolean}) {
  return <article className="game-card">
    <button className="game-card-main" onClick={()=>onSelect(game.title)} aria-label={"جزئیات "+game.title}>
      <Artwork game={game}/><div className="game-info">
        <div className="game-title-row"><div><h3>{game.title}</h3><p>{game.category}</p></div><span className={"status "+(game.status==="در حال آماده‌سازی"?"status-building":"")}>{game.status}</span></div>
        <p className="game-description">{game.description}</p>
        <div className="game-meta"><span><Users size={14}/>{game.players}</span><span><Clock3 size={14}/>{game.duration}</span></div>
      </div>
    </button>
    {showSave&&<button className={"save-game "+(saved?"saved":"")} aria-label={(saved?"حذف "+game.title+" از دلخواه‌ها":"افزودن "+game.title+" به دلخواه‌ها")} onClick={onToggleSave}><Heart size={16} fill={saved?"currentColor":"none"}/></button>}
  </article>;
}

function EmptyPage({type,onGames}:{type:"friends"|"leaderboard";onGames:()=>void}) {
  const friends=type==="friends", Icon=friends?Users:Trophy;
  return <section className="empty-page"><div className="empty-icon"><Icon size={30}/></div><span className="eyebrow">{friends?"با هم بهتره":"رقابت دوستانه"}</span><h1>{friends?"دوستات رو اینجا پیدا می‌کنی":"جدول برترین‌ها به‌زودی"}</h1><p>{friends?"بخش دوستان در حال آماده‌سازی است. بعداً می‌تونی دوستات رو دعوت کنی و با هم بازی کنی.":"وقتی بازی‌ها آماده بشن، رکوردها و امتیازها اینجا نمایش داده می‌شن."}</p><button className="btn primary" onClick={onGames}>دیدن بازی‌ها <ArrowLeft size={16}/></button></section>;
}

export default function App() {
  const [page,setPage]=useState<Page>("home"),[query,setQuery]=useState(""),[toast,setToast]=useState("");
  const [mobileOpen,setMobileOpen]=useState(false),[profileOpen,setProfileOpen]=useState(false),[alertsOpen,setAlertsOpen]=useState(false),[settingsOpen,setSettingsOpen]=useState(false);
  const [saved,setSaved]=useState<string[]>(["backgammon"]),[favoritesOnly,setFavoritesOnly]=useState(false);
  const visibleGames=useMemo(()=>games.filter(g=>(!favoritesOnly||saved.includes(g.id))&&[g.title,g.category,g.description].some(s=>s.toLocaleLowerCase("fa").includes(query.trim().toLocaleLowerCase("fa")))),[query,saved,favoritesOnly]);
  const go=(p:Page)=>{setPage(p);setMobileOpen(false);setProfileOpen(false);setAlertsOpen(false);setFavoritesOnly(false);if(p!=="games")setQuery("");};
  const inform=(name:string)=>setToast("بخش «"+name+"» هنوز در حال آماده‌سازی است.");
  const toggleSaved=(id:string)=>setSaved(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  const openFavorites=()=>{setPage("games");setQuery("");setFavoritesOnly(true);setMobileOpen(false);setProfileOpen(false);setAlertsOpen(false);};
  const activateShortcut=(id:string)=>{switch(id){case "home":go("home");break;case "games":go("games");break;case "favorites":openFavorites();break;case "friends":go("friends");break;case "leaderboard":go("leaderboard");break;case "profile":go("profile");break;case "alerts":setAlertsOpen(true);setProfileOpen(false);break;case "challenges":inform("چالش‌های روزانه");break;case "rewards":inform("جایزه‌ها");break;case "support":inform("پشتیبانی");break;default:break;}};

  return <div className="app" dir="rtl">
    <header className="topbar">
      <button className="icon-btn mobile-menu" aria-label="باز کردن منو" onClick={()=>setMobileOpen(!mobileOpen)}>{mobileOpen?<X size={21}/>:<Menu size={21}/>}</button>
      <button className="brand" aria-label="خانه Playora" onClick={()=>go("home")}><span className="brand-icon"><Gamepad2 size={22}/></span><span className="brand-name">playora<span>.</span></span></button>
      <label className="search"><Search size={18}/><input aria-label="جست‌وجوی بازی‌ها" placeholder="دنبال چه بازی‌ای می‌گردی؟" value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value)setPage("games");}}/><kbd>⌘ K</kbd></label>
      <div className="top-actions">
        <div className="popover-wrap"><button className="icon-btn" aria-label="اعلان‌ها" onClick={()=>{setAlertsOpen(!alertsOpen);setProfileOpen(false);}}><Bell size={19}/><i className="dot"/></button>
          {alertsOpen&&<div className="popover alerts"><b>اعلان‌ها <span>جدید</span></b><div className="alert-row"><Sparkles size={18}/><div><strong>به Playora خوش اومدی!</strong><p>فضای بازی‌هات رو داریم آماده می‌کنیم.</p><small>همین الان</small></div></div><div className="alert-row"><Info size={18}/><div><strong>بازی‌ها در راه‌اند</strong><p>اولین نسخه رو مرحله‌به‌مرحله می‌سازیم.</p><small>اطلاع‌رسانی</small></div></div></div>}
        </div>
        <button className="btn help-btn" onClick={()=>inform("راهنما")}><CircleHelp size={17}/> راهنما</button>
        <div className="popover-wrap"><button className="account" aria-label="حساب کاربری" onClick={()=>{setProfileOpen(!profileOpen);setAlertsOpen(false);}}><span className="avatar">م</span><span className="account-name">مهمان</span><ChevronDown size={14}/></button>
          {profileOpen&&<div className="popover account-popover"><div className="account-detail"><span className="avatar big-avatar">م</span><div><strong>بازیکن مهمان</strong><small>حساب کاربری محلی</small></div></div><button onClick={()=>go("profile")}><Users size={16}/> پروفایل من</button><button onClick={()=>{setSettingsOpen(true);setProfileOpen(false);}}><Settings2 size={16}/> تنظیمات</button><p>ساخت حساب در مرحله‌ای جداگانه اضافه می‌شود.</p></div>}
        </div>
      </div>
    </header>
    <div className="layout">
      <aside className={"sidebar "+(mobileOpen?"sidebar-open":"")}><div className="sidebar-label">فضای تو</div><nav aria-label="ناوبری اصلی">{nav.map(({id,label,icon:Icon})=><button key={id} onClick={()=>go(id)} className={"nav-item "+(page===id?"active":"")}><Icon size={19}/><span>{label}</span>{id==="friends"&&<small>۰</small>}</button>)}</nav>
        <div className="rule"/><div className="sidebar-label">بیشتر برای تو</div>
        <button className="nav-item subdued" onClick={()=>inform("چالش‌های روزانه")}><Activity size={19}/><span>چالش‌های روزانه</span><small>به‌زودی</small></button>
        <button className="nav-item subdued" onClick={()=>inform("جایزه‌ها")}><Gift size={19}/><span>جایزه‌ها</span><small>به‌زودی</small></button>
        <div className="sidebar-promo"><div className="promo-icon"><Sparkles size={18}/></div><strong>یه دنیای تازه در راهه</strong><p>یه فضای جدید برای رقابت با دوستات داریم آماده می‌کنیم.</p><button onClick={()=>inform("دعوت از دوستان")}>بیشتر بدون <ArrowLeft size={14}/></button></div>
        <div className="sidebar-bottom"><button className="nav-item" onClick={()=>setSettingsOpen(true)}><Settings2 size={19}/><span>تنظیمات</span></button><button className="nav-item" onClick={()=>inform("پشتیبانی")}><MessageCircle size={19}/><span>پشتیبانی</span></button></div>
      </aside>
      {mobileOpen&&<button className="scrim" aria-label="بستن منو" onClick={()=>setMobileOpen(false)}/>}
      <main className="main">
        {page==="home"&&<>
          <div className="page-heading"><div><span className="eyebrow"><i/> فضای بازی تو</span><h1>سلام، خوش اومدی <span className="wave">✦</span></h1><p>جای خودته؛ یه بازی خوب، یه رقابت شیرین.</p></div><button className="btn outline heading-btn" onClick={()=>go("games")}><Compass size={16}/> کشف بازی‌ها</button></div>
          <section className="hero"><div className="hero-copy"><span className="hero-tag"><Sparkles size={14}/> دنیای بازی‌های دورهمی</span><h2>لحظه‌های خوب،<br/><em>با یه بازی شروع می‌شن.</em></h2><p>بازی موردعلاقه‌ات رو پیدا کن، دوستات رو خبر کن و برای رقابت آماده شو.</p><div className="hero-actions"><button className="btn lime" onClick={()=>go("games")}>کشف بازی‌ها <ArrowLeft size={16}/></button><button className="hero-link" onClick={()=>inform("بازی سریع")}>بازی سریع <ArrowLeft size={15}/></button></div><div className="trust"><span><ShieldCheck size={15}/> یه فضای دوستانه</span><i/><span>شروعی ساده، سرگرمی بی‌پایان</span></div></div>
            <div className="hero-art" aria-hidden="true"><div className="orbit o1"/><div className="orbit o2"/><div className="float-chip chip-x">×</div><div className="float-chip chip-o">○</div><div className="hero-board"><div className="board-row">{Array.from({length:6},(_,i)=><i key={i}/>)}</div><div className="dice"><b>۳</b><b>۵</b></div><div className="board-row flip">{Array.from({length:6},(_,i)=><i key={i}/>)}</div></div><div className="win-card"><span><Trophy size={16}/></span><div><b>لحظهٔ پیروزی</b><small>به‌زودی در Playora</small></div><Check size={14}/></div><span className="sparkle s1">✳</span><span className="sparkle s2">✦</span></div>
          </section>
          <div className="section-title"><div><span className="eyebrow">انتخاب با توئه</span><h2>بازی‌های پیشنهادی</h2><p>چند انتخاب برای شروع ماجراجویی‌ات</p></div><button className="text-link" onClick={()=>go("games")}>همهٔ بازی‌ها <ArrowLeft size={15}/></button></div>
          <div className="games-grid">{games.slice(0,3).map(g=><GameCard key={g.id} game={g} saved={saved.includes(g.id)} onToggleSave={()=>toggleSaved(g.id)} onSelect={inform}/>)}</div>
          <section className="friends-promo"><span><Users size={21}/></span><div><b>بازی با دوستات یه چیز دیگه‌ست</b><p>فضای چندنفره و دعوت از دوست‌ها در مسیر توسعهٔ Playora قرار داره.</p></div><button className="btn outline" onClick={()=>go("friends")}>بخش دوستان <ArrowLeft size={15}/></button></section>
          <section className="quick-access" aria-labelledby="quick-access-title">
            <div className="quick-access-heading"><div><span className="eyebrow">همه‌چیز دم دستته</span><h2 id="quick-access-title">دسترسی سریع</h2><p>میانبر بخش‌های مختلف Playora</p></div><span className="quick-access-count">۱۰ میانبر</span></div>
            <div className="quick-access-grid">
              {[
                {id:"home",label:"خانه",icon:Home},
                {id:"games",label:"بازی‌ها",icon:Grid2X2},
                {id:"favorites",label:"دلخواه‌ها",icon:Heart},
                {id:"friends",label:"دوستان",icon:Users},
                {id:"leaderboard",label:"برترین‌ها",icon:Trophy},
                {id:"profile",label:"پروفایل",icon:Medal},
                {id:"challenges",label:"چالش روزانه",icon:Activity,soon:true},
                {id:"rewards",label:"جایزه‌ها",icon:Gift,soon:true},
                {id:"alerts",label:"اعلان‌ها",icon:Bell},
                {id:"support",label:"پشتیبانی",icon:MessageCircle,soon:true}
              ].map(({id,label,icon:Icon,soon})=><button key={id} className={"quick-access-item"+(soon?" quick-access-soon":"")} onClick={()=>activateShortcut(id)} aria-label={label}>
                <span className="quick-access-icon"><Icon size={19}/></span><span className="quick-access-label">{label}</span>{soon&&<small>به‌زودی</small>}
              </button>)}
            </div>
          </section>
        </>}
        {page==="games"&&<><div className="page-heading catalog-heading"><div><span className="eyebrow"><i/> کتابخانهٔ سرگرمی</span><h1>{favoritesOnly?"بازی‌های دلخواه تو":"یه بازی برای حال خوبت"}</h1><p>{favoritesOnly?"بازی‌هایی که برای دسترسی سریع ذخیره کردی.":"بازی‌ها رو بگرد و انتخاب‌های موردعلاقه‌ات رو نگه دار."}</p></div><span className="saved-count"><Heart size={16}/>{saved.length} بازی دلخواه</span></div><div className="catalog-tools"><span><b>{String(visibleGames.length).padStart(2,"۰")}</b> بازی در کتابخانه</span><button onClick={()=>setQuery("")}><X size={14}/> پاک کردن جست‌وجو</button></div>
          {visibleGames.length?<div className="games-grid catalog-grid">{visibleGames.map(g=><GameCard key={g.id} game={g} saved={saved.includes(g.id)} showSave onToggleSave={()=>toggleSaved(g.id)} onSelect={inform}/>)}</div>:<div className="no-results"><Search size={26}/><h2>چیزی پیدا نکردیم</h2><p>اسم بازی دیگه‌ای رو جست‌وجو کن یا عبارتت رو کوتاه‌تر کن.</p><button className="btn primary" onClick={()=>setQuery("")}>نمایش همهٔ بازی‌ها</button></div>}
          <div className="note"><Info size={16}/><span>فعلاً روی پوستهٔ اصلی Playora کار می‌کنیم؛ منطق اجرای بازی‌ها در مرحله‌ای جداگانه توسعه داده می‌شود.</span></div></>}
        {(page==="friends"||page==="leaderboard")&&<EmptyPage type={page} onGames={()=>go("games")}/>}
        {page==="profile"&&<section className="profile-page"><span className="eyebrow">فضای شخصی</span><h1>پروفایل تو</h1><p>فعلاً به‌صورت مهمان از Playora استفاده می‌کنی.</p><div className="profile-overview"><span className="avatar profile-avatar">م</span><div><b>بازیکن مهمان</b><p>حساب کاربری هنوز فعال نشده است.</p></div><span className="guest-badge">مهمان</span></div><div className="profile-stats"><div><span>بازی‌های دلخواه</span><b>{saved.length}</b></div><div><span>بازی‌های انجام‌شده</span><b>—</b></div><div><span>دوستان</span><b>—</b></div></div><div className="note"><Info size={16}/><span>ورود، آمار و همگام‌سازی حساب در مرحله‌های بعدی بررسی می‌شوند.</span></div></section>}
        <footer className="footer"><span>© ۲۰۲۶ Playora</span><span>با حال خوب بازی کن <b>♥</b></span><button onClick={()=>inform("حریم خصوصی")}>حریم خصوصی</button></footer>
      </main>
    </div>
    {settingsOpen&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSettingsOpen(false);}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-top"><span><Settings2 size={20}/></span><button className="icon-btn" aria-label="بستن تنظیمات" onClick={()=>setSettingsOpen(false)}><X size={18}/></button></div><h2 id="settings-title">تنظیمات Playora</h2><p>فعلاً تنظیمات پایه در دسترس است.</p><div className="setting-row"><div><b>زبان برنامه</b><small>زبان اصلی رابط کاربری</small></div><span>فارسی <Check size={14}/></span></div><div className="setting-row"><div><b>چیدمان صفحه</b><small>جهت نمایش محتوا</small></div><span>راست‌چین <Check size={14}/></span></div><div className="note"><Info size={15}/> تنظیمات پیشرفته بعداً اضافه می‌شوند.</div><button className="btn primary modal-done" onClick={()=>setSettingsOpen(false)}>متوجه شدم</button></section></div>}
    {toast&&<div className="toast" role="status"><Info size={16}/><span>{toast}</span><button aria-label="بستن پیام" onClick={()=>setToast("")}><X size={14}/></button></div>}
  </div>;
}

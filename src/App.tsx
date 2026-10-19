import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./lib/supabase";
import type { LucideIcon } from "lucide-react";
import { applyTicTacToeMove, chooseTicTacToeBotMove, createTicTacToeState } from "./games/tictactoe";
import type { TicTacToeState } from "./games/tictactoe";
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, Bell, BarChart3, Check, ChevronDown,
  Coins, Crown, CreditCard, Dices, Gamepad2, Grid2X2, Heart, Home,
  Languages, LockKeyhole, LogIn, Medal, Menu, Puzzle, Search, Settings,
  ShieldCheck, Sparkles, Spade, Ticket, Trophy, UserRound, Users,
  Wallet, X, Zap
} from "lucide-react";
import "./index.css";

type Locale = "en" | "fa";
type Page = "home" | "games" | "tournaments" | "friends" | "leaderboard" | "wallet" | "profile" | "settings";
type Category = "all" | "strategy" | "board" | "cards" | "puzzle";
type MemberProfile = { user_id: string; username: string; display_name: string; avatar_key: string | null; locale: Locale; created_at: string };
type MemberWallet = { user_id: string; free_coins: number | string; purchased_coins: number | string; reward_coins: number | string; updated_at: string };
type Game = {
  id: string;
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  category: Exclude<Category, "all">;
  players: Record<Locale, string>;
  icon: LucideIcon;
  art: string;
  color: string;
  featured?: boolean;
};

const gameList: Game[] = [
  { id: "chess", title: { en: "Chess", fa: "شطرنج" }, subtitle: { en: "Think three moves ahead", fa: "چند حرکت جلوتر فکر کن" }, category: "strategy", players: { en: "2 players", fa: "۲ بازیکن" }, icon: Crown, art: "chess", color: "cyan", featured: true },
  { id: "pool", title: { en: "Pool", fa: "بیلیارد" }, subtitle: { en: "Precision meets pressure", fa: "دقت در اوج هیجان" }, category: "strategy", players: { en: "2 players", fa: "۲ بازیکن" }, icon: Activity, art: "pool", color: "violet", featured: true },
  { id: "ludo", title: { en: "Ludo", fa: "منچ" }, subtitle: { en: "A classic, reimagined", fa: "یک بازی کلاسیک با حال‌وهوای تازه" }, category: "board", players: { en: "2–4 players", fa: "۲ تا ۴ بازیکن" }, icon: Dices, art: "ludo", color: "pink", featured: true },
  { id: "checkers", title: { en: "Checkers", fa: "چکرز" }, subtitle: { en: "Own the board", fa: "صفحه را در اختیار بگیر" }, category: "board", players: { en: "2 players", fa: "۲ بازیکن" }, icon: Grid2X2, art: "checkers", color: "blue" },
  { id: "hokm", title: { en: "Hokm", fa: "حکم" }, subtitle: { en: "Read the table", fa: "میز را هوشمندانه بخوان" }, category: "cards", players: { en: "4 players", fa: "۴ بازیکن" }, icon: Spade, art: "cards", color: "gold" },
  { id: "backgammon", title: { en: "Backgammon", fa: "تخته‌نرد" }, subtitle: { en: "Classic strategy, fast turns", fa: "استراتژی کلاسیک و حرکت‌های سریع" }, category: "board", players: { en: "2 players", fa: "۲ بازیکن" }, icon: Grid2X2, art: "backgammon", color: "cyan" },
  { id: "tictactoe", title: { en: "Tic Tac Toe", fa: "دوز" }, subtitle: { en: "Quick. Clever. Unpredictable.", fa: "سریع، هوشمندانه و غیرقابل‌پیش‌بینی" }, category: "puzzle", players: { en: "2 players", fa: "۲ بازیکن" }, icon: Puzzle, art: "tic", color: "violet" },
  { id: "rummy", title: { en: "Rummy", fa: "رامی" }, subtitle: { en: "Build your winning hand", fa: "دست برنده‌ات را بساز" }, category: "cards", players: { en: "2–4 players", fa: "۲ تا ۴ بازیکن" }, icon: Spade, art: "rummy", color: "pink" }
];


const copy: Record<Locale, Record<string, string>> = {
  en: {
    navHome: "Home", navGames: "Games", navTournaments: "Tournaments", navFriends: "Friends", navRank: "Leaderboard", navWallet: "Wallet", navProfile: "Profile", navSettings: "Settings",
    search: "Search games, modes, and more", coins: "Playora Coins", demo: "Preview mode",
    eyebrow: "THE NEXT MOVE IS YOURS", heroTitle: "Your skills.", heroTitle2: "Your victory.", heroBody: "Meet your next rival. Master your favorite games. Make every move count.", findGame: "Explore games", viewTournaments: "View tournaments", liveLabel: "GLOBAL GAME NETWORK", notLive: "UI preview · online play is not connected",
    quickAccess: "Jump back in", allGames: "All games", seeAll: "View all", popular: "Popular games", popularSub: "Choose your next challenge",
    weekly: "Weekly Championship", weeklyText: "A new arena. A fresh leaderboard.", upTo: "Preview prize pool", joinNow: "Explore event", featured: "FEATURED EVENT", eventStatus: "Coming soon",
    categoryAll: "All games", categoryStrategy: "Strategy", categoryBoard: "Board", categoryCards: "Card games", categoryPuzzle: "Puzzles",
    gamesTitle: "Find your game", gamesSub: "A growing collection for sharp minds and friendly rivals.", favorites: "Favorites", emptySearch: "No games found", clearSearch: "Clear search",
    soon: "Coming soon", details: "View details", previewNote: "Game engines and live matchmaking are not connected in this preview.",
    rankTitle: "The leaderboard", rankSub: "Competitive rankings will appear here when verified match results are connected.", friendsTitle: "Find your people", friendsSub: "Friends, invitations, and private rooms will arrive in a future release.",
    tournamentsTitle: "Enter the arena", tournamentsSub: "Explore the tournament interface. Entry fees and rewards are disabled in this preview.",
    walletTitle: "Your wallet", walletSub: "Preview-only balance. No funds or cryptocurrency can be sent from this screen.", balance: "Demo balance", deposit: "Deposit", history: "Transaction history", cryptoTitle: "Crypto deposits", cryptoText: "Wallet addresses and on-chain verification are not configured. Never send assets to this preview.", notConnected: "Not connected",
    profileTitle: "Player profile", profileSub: "This is sample UI data, not a signed-in account.", settingsTitle: "Preferences", settingsSub: "Choose your language and review the security model.", language: "Language", english: "English", persian: "فارسی",
    security: "Privacy by design", securityText: "Private account data is intended to be isolated server-side by authenticated user ID and database row-level security. Live authentication is not connected yet.",
    secureNote: "Never put secret keys in browser code. Client-side UI checks do not replace server authorization.", about: "About Playora", help: "Help & support", profileMenu: "Open profile", notifications: "Notifications", noAlerts: "You’re all caught up.", account: "Guest preview", online: "Online competition", privateRooms: "Private rooms", strategy: "Strategy", board: "Board", cards: "Card", puzzle: "Puzzle",
    gameNotReady: "This game is not playable yet. The card is a design preview.", settingsSaved: "Preference updated for this preview.", walletToast: "Deposits are disabled until the secure backend is configured.", nav: "Main navigation",
    statMatches: "Matches", statWins: "Wins", statRating: "Rating", footer: "Play anywhere. Compete with purpose.", rights: "Preview build · Not a live service", matchMade: "Skill-based matchmaking", safePlay: "Built with privacy in mind",
    matchType: "1v1 MATCH", findRival: "Find a rival", randomPairing: "Random opponent matching", balanced: "Skill-aware matchmaking", noGameYet: "Gameplay is not enabled in this build.",
    eventOne: "Chess Champions", eventTwo: "Pool Masters", eventThree: "Ludo League", eventPlayers: "Players", eventTime: "Starts soon", explore: "Explore", mode: "Game mode",
    demoCoins: "2,450", sampleProfile: "OrbitRider", level: "Level", points: "XP", noMoney: "No real-money functionality",
    signIn: "Sign in", signUp: "Create account", signOut: "Sign out", resetPassword: "Reset password", forgotPassword: "Forgot password?", backToSignIn: "Back to sign in",
    email: "Email address", password: "Password", displayName: "Display name", continueWithGoogle: "Continue with Google", authUnavailable: "Account services are not connected yet. Configure the Supabase project URL and publishable key, then enable Google OAuth and email redirects.",
    authFailure: "We couldn’t complete that request. Check your details or try again.", checkInbox: "Check your inbox for a confirmation link to finish creating your account.", resetSent: "If an account exists for this email, password reset instructions have been sent.",
    passwordHint: "Use at least 12 characters.", accountRequired: "Sign in to sync favorites and access your personal account.", signInSuccess: "You’re signed in.", signOutSuccess: "You’ve signed out.", favoriteFailed: "Favorites could not be saved. Try again.", loading: "Loading…", balanceUnavailable: "Balance unavailable", member: "Member", authTitle: "Welcome to Playora", authSubtitle: "Sign in to keep your profile and progress with you.", createAccountPrompt: "New to Playora?", existingAccountPrompt: "Already have an account?", securityLiveNote: "Your session is managed by Supabase Auth. Private records are scoped through database row-level security.", practiceTitle: "Practice vs Bot", practiceNoRewards: "Practice only — this match awards no XP, rank, coins, or prizes.", yourTurn: "Your turn · X", botThinking: "Bot turn · O", youWin: "You win!", botWins: "The bot wins this round.", draw: "It’s a draw.", restartGame: "Play again", closeGame: "Close game", gameBoard: "Tic Tac Toe board", cell: "Cell"
  },
  fa: {
    navHome: "خانه", navGames: "بازی‌ها", navTournaments: "تورنومنت‌ها", navFriends: "دوستان", navRank: "جدول برترین‌ها", navWallet: "کیف پول", navProfile: "پروفایل", navSettings: "تنظیمات",
    search: "جست‌وجوی بازی و حالت‌ها", coins: "سکه‌های پلیورا", demo: "حالت پیش‌نمایش",
    eyebrow: "حرکت بعدی با توست", heroTitle: "مهارت تو.", heroTitle2: "پیروزی تو.", heroBody: "حریف بعدی‌ات را پیدا کن، بازی محبوبت را یاد بگیر و هر حرکت را مهم کن.", findGame: "کشف بازی‌ها", viewTournaments: "دیدن تورنومنت‌ها", liveLabel: "شبکه جهانی بازی", notLive: "پیش‌نمایش رابط · بازی آنلاین متصل نیست",
    quickAccess: "دسترسی سریع", allGames: "همه بازی‌ها", seeAll: "مشاهده همه", popular: "بازی‌های محبوب", popularSub: "چالش بعدی‌ات را انتخاب کن",
    weekly: "قهرمانی هفتگی", weeklyText: "میدانی تازه و جدول امتیاز جدید.", upTo: "جایزه آزمایشی", joinNow: "دیدن رویداد", featured: "رویداد ویژه", eventStatus: "به‌زودی",
    categoryAll: "همه بازی‌ها", categoryStrategy: "استراتژی", categoryBoard: "رومیزی", categoryCards: "بازی‌های کارتی", categoryPuzzle: "فکری",
    gamesTitle: "بازی خودت را پیدا کن", gamesSub: "مجموعه‌ای رو به رشد برای ذهن‌های تیز و رقیب‌های دوستانه.", favorites: "دلخواه‌ها", emptySearch: "بازی‌ای پیدا نشد", clearSearch: "پاک‌کردن جست‌وجو",
    soon: "به‌زودی", details: "جزئیات", previewNote: "موتور بازی و سیستم پیدا کردن حریف هنوز متصل نیست.",
    rankTitle: "جدول برترین‌ها", rankSub: "پس از اتصال نتایج تأییدشده بازی، رتبه‌بندی رقابتی اینجا نمایش داده می‌شود.", friendsTitle: "دوستانت را پیدا کن", friendsSub: "دوستان، دعوت‌ها و اتاق‌های خصوصی در نسخه بعدی ارائه می‌شوند.",
    tournamentsTitle: "وارد میدان شو", tournamentsSub: "رابط تورنومنت‌ها را بررسی کن. ورودیه و جایزه در این پیش‌نمایش غیرفعال‌اند.",
    walletTitle: "کیف پول تو", walletSub: "موجودی فقط نمایشی است. از این صفحه پول یا رمزارز ارسال نمی‌شود.", balance: "موجودی نمایشی", deposit: "شارژ", history: "تاریخچه تراکنش", cryptoTitle: "شارژ رمزارزی", cryptoText: "آدرس کیف پول و بررسی زنجیره‌ای تنظیم نشده‌اند. به این پیش‌نمایش دارایی ارسال نکن.", notConnected: "متصل نیست",
    profileTitle: "پروفایل بازیکن", profileSub: "این اطلاعات نمونهٔ رابط است، نه یک حساب واردشده.", settingsTitle: "ترجیحات", settingsSub: "زبان را انتخاب و معماری امنیت را بررسی کن.", language: "زبان", english: "English", persian: "فارسی",
    security: "حریم خصوصی از ابتدا", securityText: "اطلاعات خصوصی حساب باید در سمت سرور با شناسه کاربر احراز هویت‌شده و امنیت سطح ردیف پایگاه داده جدا شود. ورود واقعی هنوز متصل نیست.",
    secureNote: "کلیدهای محرمانه را در کد مرورگر قرار نده. بررسی سمت رابط جایگزین مجوزدهی سمت سرور نیست.", about: "درباره پلیورا", help: "راهنما و پشتیبانی", profileMenu: "بازکردن پروفایل", notifications: "اعلان‌ها", noAlerts: "اعلان جدیدی نداری.", account: "پیش‌نمایش مهمان", online: "رقابت آنلاین", privateRooms: "اتاق خصوصی", strategy: "استراتژی", board: "رومیزی", cards: "کارتی", puzzle: "فکری",
    gameNotReady: "این بازی هنوز قابل اجرا نیست. کارت صرفاً پیش‌نمایش طراحی است.", settingsSaved: "ترجیح در این پیش‌نمایش تغییر کرد.", walletToast: "تا زمان پیکربندی backend امن، شارژ غیرفعال است.", nav: "ناوبری اصلی",
    statMatches: "بازی‌ها", statWins: "بردها", statRating: "رتبه", footer: "هرجا بازی کن. هدفمند رقابت کن.", rights: "نسخه پیش‌نمایش · سرویس زنده نیست", matchMade: "مسابقه‌یابی مبتنی بر مهارت", safePlay: "با توجه به حریم خصوصی ساخته شده",
    matchType: "مسابقه یک‌به‌یک", findRival: "پیداکردن حریف", randomPairing: "تطبیق با حریف تصادفی", balanced: "تطبیق متناسب با مهارت", noGameYet: "بازی در این نسخه فعال نیست.",
    eventOne: "قهرمانان شطرنج", eventTwo: "استادان بیلیارد", eventThree: "لیگ منچ", eventPlayers: "بازیکن", eventTime: "شروع به‌زودی", explore: "بررسی", mode: "حالت بازی",
    demoCoins: "۲٬۴۵۰", sampleProfile: "OrbitRider", level: "سطح", points: "XP", noMoney: "بدون قابلیت پول واقعی",
    signIn: "ورود", signUp: "ساخت حساب", signOut: "خروج از حساب", resetPassword: "بازنشانی رمز عبور", forgotPassword: "رمزت را فراموش کرده‌ای؟", backToSignIn: "بازگشت به ورود",
    email: "نشانی ایمیل", password: "رمز عبور", displayName: "نام نمایشی", continueWithGoogle: "ادامه با گوگل", authUnavailable: "سرویس حساب هنوز متصل نیست. آدرس پروژه و کلید عمومی Supabase را تنظیم کن و ورود گوگل و مسیرهای تأیید ایمیل را فعال کن.",
    authFailure: "درخواست انجام نشد. اطلاعات را بررسی کن یا دوباره تلاش کن.", checkInbox: "برای تکمیل ساخت حساب، ایمیل خود را برای پیوند تأیید بررسی کن.", resetSent: "اگر حسابی با این ایمیل وجود داشته باشد، دستور بازنشانی رمز ارسال شده است.",
    passwordHint: "حداقل ۱۲ نویسه استفاده کن.", accountRequired: "برای همگام‌سازی دلخواه‌ها و دسترسی به حساب شخصی وارد شو.", signInSuccess: "با موفقیت وارد شدی.", signOutSuccess: "از حساب خارج شدی.", favoriteFailed: "ذخیره دلخواه‌ها انجام نشد. دوباره تلاش کن.", loading: "در حال بارگذاری…", balanceUnavailable: "موجودی در دسترس نیست", member: "عضو", authTitle: "به پلیورا خوش آمدی", authSubtitle: "وارد شو تا پروفایل و پیشرفتت همراهت بماند.", createAccountPrompt: "تازه به پلیورا آمده‌ای؟", existingAccountPrompt: "از قبل حساب داری؟", securityLiveNote: "نشست ورود با Supabase Auth مدیریت می‌شود. اطلاعات خصوصی با امنیت سطح ردیف پایگاه داده جدا می‌شوند.", practiceTitle: "تمرین با ربات", practiceNoRewards: "فقط تمرین — این بازی XP، رتبه، سکه یا جایزه نمی‌دهد.", yourTurn: "نوبت تو · X", botThinking: "نوبت ربات · O", youWin: "تو برنده شدی!", botWins: "ربات این دور را برد.", draw: "بازی مساوی شد.", restartGame: "بازی دوباره", closeGame: "بستن بازی", gameBoard: "صفحه دوز", cell: "خانه"
  }
};

const categories: { id: Category; key: string }[] = [
  { id: "all", key: "categoryAll" }, { id: "strategy", key: "categoryStrategy" },
  { id: "board", key: "categoryBoard" }, { id: "cards", key: "categoryCards" },
  { id: "puzzle", key: "categoryPuzzle" }
];

const navigation: { id: Page; key: string; icon: LucideIcon }[] = [
  { id: "home", key: "navHome", icon: Home },
  { id: "games", key: "navGames", icon: Grid2X2 },
  { id: "tournaments", key: "navTournaments", icon: Trophy },
  { id: "friends", key: "navFriends", icon: Users },
  { id: "leaderboard", key: "navRank", icon: BarChart3 },
];

const extraNavigation: { id: Page; key: string; icon: LucideIcon }[] = [
  { id: "wallet", key: "navWallet", icon: Wallet },
  { id: "profile", key: "navProfile", icon: UserRound },
  { id: "settings", key: "navSettings", icon: Settings }
];

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><i /><b /></span>;
}

function GoogleGlyph() {
  return <span className="google-glyph" aria-hidden="true">G</span>;
}

function GameArtwork({ game }: { game: Game }) {
  const Icon = game.icon;
  return (
    <div className={`game-art art-${game.art} tone-${game.color}`} aria-hidden="true">
      <span className="art-orb orb-one" /><span className="art-orb orb-two" />
      <div className="art-platform" />
      {game.art === "chess" && <div className="chess-symbol">♞</div>}
      {game.art === "pool" && <div className="pool-table"><i /><i /><i /><b /><span /></div>}
      {game.art === "ludo" && <div className="ludo-board">{["red", "blue", "yellow", "green"].map(c => <i className={c} key={c} />)}</div>}
      {game.art === "checkers" && <div className="checker-board">{Array.from({ length: 16 }, (_, i) => <i key={i} className={i % 3 === 0 ? "piece" : ""} />)}</div>}
      {game.art === "cards" && <div className="card-fan"><i>♠</i><i>♥</i><i>♦</i></div>}
      {game.art === "backgammon" && <div className="mini-board">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>}
      {game.art === "tic" && <div className="tic-symbols"><i>×</i><b>○</b><i>×</i><b>○</b></div>}
      {game.art === "rummy" && <div className="rummy-cards"><i>A<span>♠</span></i><i>7<span>♥</span></i><i>K<span>♦</span></i></div>}
      <span className="art-badge"><Icon size={16} /></span>
    </div>
  );
}

function GameCard({ game, locale, onOpen, saved, onSave, t }: {
  game: Game; locale: Locale; onOpen: (g: Game) => void; saved: boolean; onSave: () => void; t: (key: string) => string;
}) {
  return (
    <article className="game-card">
      <button className="game-open" onClick={() => onOpen(game)} aria-label={`${t("details")}: ${game.title[locale]}`}>
        <GameArtwork game={game} />
        <div className="game-card-copy">
          <div className="game-card-heading">
            <div><h3>{game.title[locale]}</h3><p>{game.subtitle[locale]}</p></div>
            <span className="game-status"><span />{t("soon")}</span>
          </div>
          <div className="game-card-meta"><span><Users size={14} />{game.players[locale]}</span><span>{t(game.category)}</span><ArrowUpRight size={15} className="game-arrow" /></div>
        </div>
      </button>
      <button className={`favorite-btn ${saved ? "is-saved" : ""}`} aria-label={saved ? `Remove ${game.title[locale]} from favorites` : `Add ${game.title[locale]} to favorites`} onClick={onSave}>
        <Heart size={15} fill={saved ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

function SectionHeading({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="section-heading"><div>{eyebrow && <span className="section-eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action && <button className="text-action" onClick={onAction}>{action}<ArrowRight size={15} /></button>}</div>;
}

function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <section className="empty-state"><div className="empty-state-icon"><Icon size={27} /></div><h2>{title}</h2><p>{text}</p></section>;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const [page, setPage] = useState<Page>("home");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [favorites, setFavorites] = useState<string[]>(["chess", "pool"]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [toast, setToast] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [memberWallet, setMemberWallet] = useState<MemberWallet | null>(null);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [ticTacToeState, setTicTacToeState] = useState<TicTacToeState | null>(null);

  const t = (key: string) => copy[locale][key] ?? key;
  const direction = locale === "fa" ? "rtl" : "ltr";

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setAuthLoading(false);
      }
    }).catch(() => {
      if (active) setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) {
      setMemberProfile(null);
      setMemberWallet(null);
      return;
    }
    let active = true;
    const userId = session.user.id;
    // The authenticated client and RLS jointly enforce ownership. userId comes from the verified session.
    void Promise.all([
      supabase.from("member_profiles")
        .select("user_id, username, display_name, avatar_key, locale, created_at")
        .eq("user_id", userId).maybeSingle(),
      supabase.from("coin_wallets")
        .select("user_id, free_coins, purchased_coins, reward_coins, updated_at")
        .eq("user_id", userId).maybeSingle(),
      supabase.from("member_favorites").select("game_id").eq("user_id", userId)
    ]).then(([profileResult, walletResult, favoriteResult]) => {
      if (!active) return;
      setMemberProfile(!profileResult.error ? profileResult.data as MemberProfile | null : null);
      setMemberWallet(!walletResult.error ? walletResult.data as MemberWallet | null : null);
      if (!favoriteResult.error && favoriteResult.data) {
        setFavorites(favoriteResult.data.map(row => row.game_id));
      }
    }).catch(() => {
      if (active) {
        setMemberProfile(null);
        setMemberWallet(null);
      }
    });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (activeGame?.id !== "tictactoe" || !ticTacToeState || ticTacToeState.status !== "playing" || ticTacToeState.currentPlayer !== "O") return;
    const timer = window.setTimeout(() => {
      setTicTacToeState(current => {
        if (!current || current.status !== "playing" || current.currentPlayer !== "O") return current;
        const move = chooseTicTacToeBotMove(current.board, "O");
        return move === null ? current : applyTicTacToeMove(current, move);
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [activeGame?.id, ticTacToeState]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  const filteredGames = useMemo(() => gameList.filter((game) => {
    const matchesCategory = category === "all" || game.category === category;
    const matchesFavorite = !favoritesOnly || favorites.includes(game.id);
    const haystack = [game.title[locale], game.title.en, game.subtitle[locale], copy[locale][game.category] ?? game.category].join(" ").toLocaleLowerCase(locale);
    return matchesCategory && matchesFavorite && haystack.includes(search.trim().toLocaleLowerCase(locale));
  }), [category, favorites, favoritesOnly, locale, search]);

  const go = (nextPage: Page) => {
    setPage(nextPage);
    if (nextPage !== "games") setFavoritesOnly(false);
    setMobileNavOpen(false);
    setNoticeOpen(false);
    if (nextPage !== "games") { setSearch(""); setCategory("all"); }
  };

  const toggleFavorite = (id: string) => {
    const wasSaved = favorites.includes(id);
    const next = wasSaved ? favorites.filter(item => item !== id) : [...favorites, id];
    setFavorites(next);
    if (supabase && session?.user.id) {
      const userId = session.user.id;
      const request = wasSaved
        ? supabase.from("member_favorites").delete().eq("user_id", userId).eq("game_id", id)
        : supabase.from("member_favorites").insert({ user_id: userId, game_id: id });
      void request.then(({ error }) => {
        if (error) {
          setFavorites(current => wasSaved ? [...new Set([...current, id])] : current.filter(item => item !== id));
          setToast(t("favoriteFailed"));
        }
      });
    }
  };

  const openAuth = (mode: "signin" | "signup" | "reset" = "signin") => {
    setAuthMode(mode);
    setAuthMessage("");
    setPassword("");
    setAuthOpen(true);
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage("");
    if (!supabase || !supabaseConfigured) {
      setAuthMessage(t("authUnavailable"));
      return;
    }
    if (authMode === "signup" && password.length < 12) {
      setAuthMessage(t("passwordHint"));
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setAuthOpen(false);
        setPassword("");
        setToast(t("signInSuccess"));
      } else if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim().slice(0, 32) || "Player", locale },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        setAuthMessage(t("checkInbox"));
        setPassword("");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setAuthMessage(t("resetSent"));
      }
    } catch {
      setAuthMessage(t("authFailure"));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthMessage("");
    if (!supabase || !supabaseConfigured) {
      setAuthMessage(t("authUnavailable"));
      return;
    }
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch {
      setAuthMessage(t("authFailure"));
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setToast(t("authFailure"));
    else {
      setMemberProfile(null);
      setMemberWallet(null);
      setFavorites(["chess", "pool"]);
      setToast(t("signOutSuccess"));
      setPage("home");
    }
  };

  const currentName = session
    ? (memberProfile?.user_id === session.user.id ? memberProfile.display_name : t("member"))
    : t("account");
  const coinBalance = session
    ? (memberWallet?.user_id === session.user.id
      ? Number(memberWallet.free_coins) + Number(memberWallet.purchased_coins) + Number(memberWallet.reward_coins)
      : null)
    : 50;
  const formattedCoins = coinBalance === null || !Number.isFinite(coinBalance)
    ? t("balanceUnavailable")
    : new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: 0 }).format(coinBalance);

  const openGame = (game: Game) => {
    if (game.id === "tictactoe") {
      setToast("");
      setTicTacToeState(createTicTacToeState());
      setActiveGame(game);
      setMobileNavOpen(false);
      return;
    }
    setToast(t("gameNotReady"));
  };
  const makeTicTacToeMove = (index: number) => {
    setTicTacToeState(current => current ? applyTicTacToeMove(current, index) : current);
  };
  const restartTicTacToe = () => setTicTacToeState(createTicTacToeState());
  const closeTicTacToe = () => {
    setActiveGame(null);
    setTicTacToeState(null);
  };
  const ticTacToeStatus = !ticTacToeState ? "" :
    ticTacToeState.status === "won" ? (ticTacToeState.winner === "X" ? t("youWin") : t("botWins")) :
    ticTacToeState.status === "draw" ? t("draw") :
    ticTacToeState.currentPlayer === "X" ? t("yourTurn") : t("botThinking");

  const pageMeta: Record<Page, { title: string; subtitle: string }> = {
    home: { title: t("navHome"), subtitle: t("notLive") },
    games: { title: t("gamesTitle"), subtitle: t("gamesSub") },
    tournaments: { title: t("tournamentsTitle"), subtitle: t("tournamentsSub") },
    friends: { title: t("friendsTitle"), subtitle: t("friendsSub") },
    leaderboard: { title: t("rankTitle"), subtitle: t("rankSub") },
    wallet: { title: t("walletTitle"), subtitle: t("walletSub") },
    profile: { title: t("profileTitle"), subtitle: t("profileSub") },
    settings: { title: t("settingsTitle"), subtitle: t("settingsSub") }
  };

  return (
    <div className={`app-shell locale-${locale}`} dir={direction} lang={locale}>
      <header className="topbar">
        <button className="mobile-menu-btn" aria-label={mobileNavOpen ? "Close menu" : "Open menu"} onClick={() => setMobileNavOpen(!mobileNavOpen)}>{mobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <button className="brand-lockup" onClick={() => go("home")} aria-label="Playora home">
          <BrandMark /><span className="brand-word">PLAYORA<span>.</span></span>
        </button>
        <div className="topbar-tagline"><span className="status-pulse" />{t("liveLabel")}</div>
        <label className="global-search"><Search size={17} /><input aria-label={t("search")} placeholder={t("search")} value={search} onChange={e => { setSearch(e.target.value); setPage("games"); }} onFocus={() => setPage("games")} /><kbd>⌘ K</kbd></label>
        <div className="topbar-actions">
          <span className="demo-pill"><span />{t("demo")}</span>
          <button className="language-switch" onClick={() => setLocale(locale === "en" ? "fa" : "en")} aria-label={locale === "en" ? "Switch language to Persian" : "Switch language to English"}><Languages size={16} /><span>{locale === "en" ? "EN" : "فا"}</span><ChevronDown size={13} /></button>
          <div className="notice-wrap">
            <button className="top-icon-btn" aria-label={t("notifications")} onClick={() => setNoticeOpen(!noticeOpen)}><Bell size={18} /><i /></button>
            {noticeOpen && <div className="notice-popover"><div className="popover-heading"><b>{t("notifications")}</b><span>0</span></div><p>{t("noAlerts")}</p></div>}
          </div>
          <button className="user-chip" aria-busy={authLoading} onClick={() => session ? go("profile") : openAuth("signin")} aria-label={session ? t("profileMenu") : t("signIn")}><span className="user-avatar">{session ? currentName.charAt(0).toLocaleUpperCase(locale) : "O"}</span><span className="user-chip-label">{currentName}</span><ChevronDown size={13} /></button>
        </div>
      </header>

      <div className="app-body">
        <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-context"><span className="context-icon"><Gamepad2 size={15} /></span><span>PLAY<span>SPACE</span></span></div>
          <p className="sidebar-label">{locale === "en" ? "DISCOVER" : "کشف و بازی"}</p>
          <nav className="sidebar-nav" aria-label={t("nav")}>
            {navigation.map(item => {
              const Icon = item.icon;
              return <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => go(item.id)}><Icon size={18} /><span>{t(item.key)}</span>{page === item.id && <i className="nav-active-dot" />}</button>;
            })}
          </nav>
          <p className="sidebar-label secondary-label">{locale === "en" ? "YOUR SPACE" : "فضای تو"}</p>
          <nav className="sidebar-nav">
            {extraNavigation.map(item => {
              const Icon = item.icon;
              return <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => go(item.id)}><Icon size={18} /><span>{t(item.key)}</span></button>;
            })}
          </nav>
          <div className="sidebar-spacer" />
          <div className="sidebar-rank-card">
            <div className="rank-card-icon"><ShieldCheck size={17} /></div><div><b>{t("safePlay")}</b><p>{t("noMoney")}</p></div>
          </div>
          <div className="sidebar-footer"><BrandMark /><span>PLAYORA © 2026</span></div>
        </aside>

        {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

        <main className="main-content">
          {page !== "home" && <div className="page-title-row"><div><span className="page-kicker">{t("liveLabel")}</span><h1>{pageMeta[page].title}</h1><p>{pageMeta[page].subtitle}</p></div>{page === "games" && <span className="result-count">{filteredGames.length} {t("allGames").toLocaleLowerCase(locale)}</span>}</div>}

          {page === "home" && <>
            <section className="hero-panel">
              <div className="hero-glow hero-glow-a" /><div className="hero-glow hero-glow-b" /><div className="hero-grid-lines" />
              <div className="hero-copy">
                <span className="hero-eyebrow"><Sparkles size={14} />{t("eyebrow")}</span>
                <h1>{t("heroTitle")}<br /><span>{t("heroTitle2")}</span></h1>
                <p>{t("heroBody")}</p>
                <div className="hero-actions"><button className="btn-gradient" onClick={() => go("games")}>{t("findGame")}<ArrowRight size={17} /></button><button className="btn-ghost" onClick={() => go("tournaments")}><Trophy size={16} />{t("viewTournaments")}</button></div>
                <div className="hero-trust"><span><ShieldCheck size={14} />{t("safePlay")}</span><i /><span><Zap size={14} />{t("matchMade")}</span></div>
              </div>
              <div className="hero-artwork" aria-hidden="true">
                <div className="arena-ring ring-outer" /><div className="arena-ring ring-middle" /><div className="arena-ring ring-inner" />
                <div className="arena-core"><BrandMark /><b>PLAYORA</b><span>PLAY · COMPETE · WIN</span></div>
                <div className="floating-game floating-chess"><Crown size={24} /><span>CHESS</span></div>
                <div className="floating-game floating-cards"><span>♠</span><span>♥</span><span>♦</span></div>
                <div className="floating-rank"><Medal size={15} /><div><b>{t("matchMade")}</b><small>{t("demo")}</small></div></div>
                <span className="spark spark-one">✦</span><span className="spark spark-two">✧</span><span className="spark spark-three">✦</span>
              </div>
              <div className="hero-bottom-line"><span>{t("notLive")}</span><span>01 / 04</span></div>
            </section>

            <div className="stat-strip">
              <div><span className="stat-icon stat-cyan"><Gamepad2 size={17} /></span><div><b>08</b><small>{t("allGames")}</small></div></div>
              <div><span className="stat-icon stat-purple"><Users size={17} /></span><div><b>1v1</b><small>{t("online")}</small></div></div>
              <div><span className="stat-icon stat-pink"><Trophy size={17} /></span><div><b>24/7</b><small>{t("privateRooms")}</small></div></div>
              <div className="coins-stat"><span className="coin-symbol"><Coins size={18} /></span><div><b>{formattedCoins}</b><small>{t("coins")}</small></div>{!session && <span className="preview-caption">{t("demo")}</span>}</div>
            </div>

            <section className="games-section">
              <SectionHeading eyebrow={t("popularSub")} title={t("popular")} action={t("seeAll")} onAction={() => go("games")} />
              <div className="games-grid home-games">
                {gameList.filter(g => g.featured).map(game => <GameCard key={game.id} game={game} locale={locale} onOpen={openGame} saved={favorites.includes(game.id)} onSave={() => toggleFavorite(game.id)} t={t} />)}
              </div>
            </section>

            <section className="tournament-banner">
              <div className="tournament-trophy"><Trophy size={31} /></div><div className="tournament-copy"><span>{t("featured")}</span><h2>{t("weekly")}</h2><p>{t("weeklyText")}</p></div><div className="tournament-meta"><span><Ticket size={15} />{t("eventStatus")}</span><b>{t("upTo")}</b></div><button className="btn-gradient compact" onClick={() => go("tournaments")}>{t("joinNow")}<ArrowRight size={15} /></button>
            </section>
          </>}

          {page === "games" && <>
            <div className="catalog-toolbar"><div className="category-tabs" role="group" aria-label={t("mode")}>{categories.map(item => <button key={item.id} className={category === item.id ? "selected" : ""} onClick={() => setCategory(item.id)}>{t(item.key)}</button>)}</div><button className={`favorites-filter ${favoritesOnly ? "selected" : ""}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Heart size={15} fill={favoritesOnly ? "currentColor" : "none"} />{t("favorites")}</button></div>
            {filteredGames.length > 0 ? <div className="games-grid catalog-grid">{filteredGames.map(game => <GameCard key={game.id} game={game} locale={locale} onOpen={notifyGameNotReady} saved={favorites.includes(game.id)} onSave={() => toggleFavorite(game.id)} t={t} />)}</div> : <EmptyState icon={Search} title={t("emptySearch")} text={t("clearSearch")} />}
            <div className="preview-disclaimer"><ShieldCheck size={16} /><span>{t("previewNote")}</span></div>
          </>}

          {page === "tournaments" && <><section className="event-hero"><div><span className="hero-eyebrow"><Trophy size={14} />{t("featured")}</span><h2>{t("weekly")}</h2><p>{t("tournamentsSub")}</p><span className="event-coming">{t("eventStatus")}</span></div><div className="event-hero-icon"><Trophy size={68} /></div></section><div className="event-list">{[{key:"eventOne", icon:Crown, color:"cyan", players:"128"},{key:"eventTwo", icon:Activity, color:"violet", players:"64"},{key:"eventThree", icon:Dices, color:"pink", players:"32"}].map((event) => { const Icon=event.icon; return <article className="event-row" key={event.key}><span className={`event-game-icon tone-${event.color}`}><Icon size={23} /></span><div className="event-row-copy"><h3>{t(event.key)}</h3><p>{t("eventTime")} · {event.players} {t("eventPlayers")}</p></div><span className="event-row-status">{t("eventStatus")}</span><button className="btn-outline" onClick={() => setToast(t("noGameYet"))}>{t("explore")}<ArrowRight size={14} /></button></article>; })}</div><div className="preview-disclaimer"><ShieldCheck size={16} /><span>{t("noMoney")}</span></div></>}

          {page === "friends" && <EmptyState icon={Users} title={t("friendsTitle")} text={t("friendsSub")} />}
          {page === "leaderboard" && <EmptyState icon={Trophy} title={t("rankTitle")} text={t("rankSub")} />}

          {page === "wallet" && <section className="wallet-layout"><div className="wallet-balance-card"><span className="wallet-label"><Coins size={16} />{t("balance")}</span><b className="wallet-total">{formattedCoins} <small>{t("coins")}</small></b><span className="wallet-preview-tag"><LockKeyhole size={13} />{t("noMoney")}</span><div className="wallet-actions"><button disabled onClick={() => setToast(t("walletToast"))}><CreditCard size={16} />{t("deposit")}</button><button disabled onClick={() => setToast(t("walletToast"))}><Activity size={16} />{t("history")}</button></div></div><div className="crypto-info-card"><div className="crypto-card-head"><span className="security-icon"><ShieldCheck size={18} /></span><span className="connection-status">{t("notConnected")}</span></div><h2>{t("cryptoTitle")}</h2><p>{t("cryptoText")}</p><div className="crypto-list"><span className="crypto-token usdt">₮</span><div><b>USDT</b><small>Example asset · no deposit address</small></div><span className="crypto-token btc">₿</span><div><b>BTC</b><small>Not configured</small></div></div><button className="btn-disabled" disabled><LockKeyhole size={15} />{t("notConnected")}</button></div></section>}

          {page === "profile" && <section className="profile-layout"><div className="profile-card"><div className="profile-cover"><BrandMark /></div><div className="profile-identity"><span className="profile-avatar-large">{session ? currentName.charAt(0).toLocaleUpperCase(locale) : "O"}</span><div><h2>{session ? currentName : t("sampleProfile")}</h2><p>{session ? (memberProfile?.user_id === session.user.id ? "@" + memberProfile.username : t("loading")) : t("account")}</p></div>{session && <span className="profile-level"><BadgeCheck size={14} />{t("member")}</span>}</div><div className="profile-stats"><div><b>—</b><span>{t("statMatches")}</span></div><div><b>—</b><span>{t("statWins")}</span></div><div><b>—</b><span>{t("statRating")}</span></div></div>{session ? <div className="profile-auth-footer"><p>{t("securityLiveNote")}</p><button className="btn-outline" onClick={() => void handleSignOut()}><LogIn size={14} />{t("signOut")}</button></div> : <div className="profile-auth-footer"><p>{t("accountRequired")}</p><button className="btn-gradient" onClick={() => openAuth("signin")}><LogIn size={15} />{t("signIn")}</button></div>}</div></section>}

          {page === "settings" && <section className="settings-layout"><div className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Languages size={20} /></div><div><h2>{t("language")}</h2><p>{t("settingsSub")}</p></div></div><div className="language-options"><button className={locale === "en" ? "language-option selected" : "language-option"} onClick={() => { setLocale("en"); setToast(copy.en.settingsSaved); }}><span className="language-flag">EN</span><span><b>{t("english")}</b><small>English · LTR</small></span>{locale === "en" && <Check size={17} />}</button><button className={locale === "fa" ? "language-option selected" : "language-option"} onClick={() => { setLocale("fa"); setToast(copy.fa.settingsSaved); }}><span className="language-flag fa-flag">فا</span><span><b>{t("persian")}</b><small>فارسی · RTL</small></span>{locale === "fa" && <Check size={17} />}</button></div></div><div className="settings-card security-card"><div className="settings-card-heading"><div className="settings-icon shield"><ShieldCheck size={20} /></div><div><h2>{t("security")}</h2><p>{t("securityText")}</p></div></div><div className="security-check-row"><LockKeyhole size={16} /><span>{t("secureNote")}</span></div><p className="security-live-note">{session ? t("securityLiveNote") : t("securityText")}</p><button className="text-action" onClick={() => setToast(t("security"))}>{t("about")}<ArrowRight size={15} /></button></div></section>}

          <footer className="main-footer"><div><BrandMark /><span>{t("footer")}</span></div><span>{t("rights")}</span><button onClick={() => go("settings")}><ShieldCheck size={13} />{t("security")}</button></footer>
        </main>
      </div>
      {toast && <div className="toast-message" role="status"><span className="toast-check"><Check size={15} /></span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}><X size={15} /></button></div>}
      {authOpen && <div className="auth-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
        <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <div className="auth-modal-top"><span className="auth-modal-mark"><BrandMark /></span><button className="auth-close" type="button" aria-label="Close sign in" onClick={() => setAuthOpen(false)}><X size={18} /></button></div>
          <span className="auth-eyebrow">PLAYORA ACCOUNT</span>
          <h2 id="auth-modal-title">{authMode === "signup" ? t("signUp") : authMode === "reset" ? t("resetPassword") : t("authTitle")}</h2>
          <p>{t("authSubtitle")}</p>
          {!supabaseConfigured && <div className="auth-config-warning" role="status"><ShieldCheck size={17} /><span>{t("authUnavailable")}</span></div>}
          {authMode !== "reset" && <button type="button" className="google-auth-btn" disabled={!supabaseConfigured || authBusy} onClick={() => void handleGoogleSignIn()}><GoogleGlyph />{t("continueWithGoogle")}</button>}
          {authMode !== "reset" && <div className="auth-divider"><span>{locale === "en" ? "OR CONTINUE WITH EMAIL" : "یا با ایمیل ادامه بده"}</span></div>}
          <form className="auth-form" onSubmit={event => void handleAuthSubmit(event)}>
            {authMode === "signup" && <label>{t("displayName")}<input autoComplete="nickname" name="displayName" type="text" maxLength={32} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder={t("displayName")} /></label>}
            <label>{t("email")}<input required autoComplete="email" name="email" type="email" inputMode="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            {authMode !== "reset" && <label>{t("password")}<input required autoComplete={authMode === "signup" ? "new-password" : "current-password"} name="password" type="password" minLength={authMode === "signup" ? 12 : undefined} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder={authMode === "signup" ? t("passwordHint") : "••••••••••••"} /></label>}
            {authMode === "signin" && <button type="button" className="auth-text-action" onClick={() => { setAuthMode("reset"); setAuthMessage(""); }}>{t("forgotPassword")}</button>}
            {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
            <button className="btn-gradient auth-submit" type="submit" disabled={authBusy || !supabaseConfigured}>{authBusy ? t("loading") : authMode === "signup" ? t("signUp") : authMode === "reset" ? t("resetPassword") : t("signIn")}<ArrowRight size={16} /></button>
          </form>
          <div className="auth-mode-switch">
            {authMode === "reset" ? <button type="button" onClick={() => { setAuthMode("signin"); setAuthMessage(""); }}>{t("backToSignIn")}</button> : authMode === "signup" ? <><span>{t("existingAccountPrompt")}</span><button type="button" onClick={() => { setAuthMode("signin"); setAuthMessage(""); }}>{t("signIn")}</button></> : <><span>{t("createAccountPrompt")}</span><button type="button" onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}>{t("signUp")}</button></>}
          </div>
          <p className="auth-legal-note"><LockKeyhole size={12} />{t("secureNote")}</p>
        </section>
      </div>}
    </div>
  );
}

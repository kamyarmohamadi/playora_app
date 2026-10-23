import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import { supabase, supabaseConfigured, accountDeletionEnabled } from "./lib/supabase";
import { localCatalogPreview, localCatalogProvider } from "./catalog/localCatalogProvider";
import { createSupabaseCatalogProvider } from "./catalog/supabaseCatalogProvider";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./lib/database.types";
import type { CatalogGame as Game } from "./catalog/gameRegistry";
import type { ApprovedPluginDescriptor } from "@playora/game-sdk";
import { GamePluginHost } from "./plugin-host/GamePluginHost";
import { SupportReportDialog, type SupportReportSubmission, type SupportReportSummary } from "./components/SupportReportDialog";
import { listMySupportReports, submitMySupportReport } from "./platform/supportReportService";
import { prepareGameLaunch } from "./platform/prepareGameLaunch";
import type { PluginRuntimePolicy } from "./plugin-host/pluginPolicy";
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, Bell, BarChart3, Check, ChevronDown, Swords, Coins, Crown, CreditCard, Dices, Gamepad2, Grid2X2, Heart, Home, Languages, LifeBuoy, LockKeyhole, LogIn, Medal, Menu, Search, Settings, ShieldCheck, Sparkles, Ticket, Trophy, UserRound, Users, Wallet, X, Zap
} from "lucide-react";
import { copy, type Locale } from "./i18n/copy";
import "./index.css";

const supportReportsEnabled = import.meta.env.VITE_SUPPORT_REPORTS_ENABLED === "true";

const gameCatalogProvider = supabase
  ? createSupabaseCatalogProvider(supabase as unknown as SupabaseClient<Database>, {
      supportedSdkVersion: "1.0.0",
      allowedArtifactOrigins: String(import.meta.env.VITE_PLAYORA_GAME_ARTIFACT_ORIGINS ?? "")
        .split(",")
        .map((origin: string) => origin.trim())
        .filter((origin: string) => origin.length > 0),
    })
  : localCatalogProvider;

const pluginRuntimePolicy: PluginRuntimePolicy = {
  hostOrigin: typeof window === "undefined" ? "https://playora.invalid" : window.location.origin,
  allowedArtifactOrigins: String(import.meta.env.VITE_PLAYORA_GAME_ARTIFACT_ORIGINS ?? "")
    .split(",")
    .map((origin: string) => origin.trim())
    .filter((origin: string) => origin.length > 0),
  supportedSdkVersion: "1.0.0",
  // No ranked-match, room, wallet or payment broker is available to plugins yet.
  allowedCapabilities: ["locale:read", "profile:read", "session:lifecycle", "telemetry:submit"],
};

type Page = "home" | "games" | "online" | "tournaments" | "friends" | "rooms" | "leaderboard" | "wallet" | "profile" | "settings";
type Category = "all" | "strategy" | "board" | "cards" | "puzzle";
type MemberProfile = { user_id: string; username: string; display_name: string; avatar_key: string | null; locale: Locale; created_at: string };
type MemberWallet = { user_id: string; free_coins: number | string; purchased_coins: number | string; reward_coins: number | string; updated_at: string };
type SocialRelationship = { request_id: string; other_username: string; other_display_name: string; relationship_type: "friend" | "incoming" | "outgoing" | "blocked"; request_status: "pending" | "accepted" | "declined" | "blocked"; created_at: string };
const categories: { id: Category; key: string }[] = [
  { id: "all", key: "categoryAll" }, { id: "strategy", key: "categoryStrategy" },
  { id: "board", key: "categoryBoard" }, { id: "cards", key: "categoryCards" },
  { id: "puzzle", key: "categoryPuzzle" }
];

const supportCopy: Record<Locale, Record<string, string>> = {
  en: {
    supportEyebrow:"PLAYORA SUPPORT", supportSubtitle:"Send a report to the Playora team.",
    supportSignInRequired:"Sign in to submit and track a support report.",
    supportDiagnosticsNotice:"Only app version, language, page key and coarse browser/OS families are sent.",
    supportReportSubmitted:"Your report was submitted.", supportCategory:"Category", supportCategoryBug:"Bug report",
    supportCategoryAccount:"Account", supportCategoryCatalog:"Game catalogue", supportCategoryAccessibility:"Accessibility",
    supportCategoryOther:"Other", supportReportTitle:"Title", supportTitlePlaceholder:"Summarize what happened",
    supportReportDescription:"What happened?", supportDescriptionPlaceholder:"Describe the steps and what you expected.",
    supportSubmitReport:"Submit report", supportMyReports:"My reports",
    supportHistoryUnavailable:"Report history is temporarily unavailable.", supportNoReports:"You have not submitted any reports yet.",
    supportStatusOpen:"Open", supportStatusTriaged:"Triaged", supportStatusInProgress:"In progress",
    supportStatusResolved:"Resolved", supportStatusClosed:"Closed", supportReportInvalid:"Please review the report fields.",
    supportReportInvalidCategory:"Choose a category.", supportReportInvalidTitle:"Enter a title between 5 and 120 characters.",
    supportReportInvalidDescription:"Enter a description between 20 and 4000 characters.",
    supportReportRateLimited:"You have submitted too many reports. Please try again later.",
    supportReportSessionChanged:"Your session changed. Please try again.",
    supportSecureContextRequired:"Secure browser context is required to submit a report.",
    supportReportFailed:"Your report could not be submitted. Please retry.",
    supportBackendUnavailable:"Support submissions are not connected yet. Please try again after the service is enabled.",
  },
  fa: {
    supportEyebrow:"پشتیبانی پلیورا", supportSubtitle:"گزارش خود را برای تیم پلیورا بفرست.",
    supportSignInRequired:"برای ارسال و پیگیری گزارش، ابتدا وارد حساب شو.",
    supportDiagnosticsNotice:"فقط نسخهٔ برنامه، زبان، شناسهٔ صفحه و خانوادهٔ کلی مرورگر و سیستم‌عامل ارسال می‌شود.",
    supportReportSubmitted:"گزارش تو ثبت شد.", supportCategory:"دسته‌بندی", supportCategoryBug:"گزارش باگ",
    supportCategoryAccount:"حساب کاربری", supportCategoryCatalog:"فهرست بازی‌ها", supportCategoryAccessibility:"دسترس‌پذیری",
    supportCategoryOther:"سایر", supportReportTitle:"عنوان", supportTitlePlaceholder:"خلاصه کن چه اتفاقی افتاده",
    supportReportDescription:"چه اتفاقی افتاد؟", supportDescriptionPlaceholder:"مراحل و نتیجه‌ای را که انتظار داشتی توضیح بده.",
    supportSubmitReport:"ارسال گزارش", supportMyReports:"گزارش‌های من",
    supportHistoryUnavailable:"تاریخچهٔ گزارش‌ها موقتاً در دسترس نیست.", supportNoReports:"هنوز گزارشی ارسال نکرده‌ای.",
    supportStatusOpen:"باز", supportStatusTriaged:"بررسی اولیه", supportStatusInProgress:"در حال انجام",
    supportStatusResolved:"حل‌شده", supportStatusClosed:"بسته", supportReportInvalid:"اطلاعات گزارش را بررسی کن.",
    supportReportInvalidCategory:"یک دسته‌بندی انتخاب کن.", supportReportInvalidTitle:"عنوان باید بین ۵ تا ۱۲۰ نویسه باشد.",
    supportReportInvalidDescription:"توضیحات باید بین ۲۰ تا ۴۰۰۰ نویسه باشد.",
    supportReportRateLimited:"تعداد گزارش‌ها زیاد است. کمی بعد دوباره تلاش کن.",
    supportReportSessionChanged:"حساب کاربری تغییر کرده است. دوباره تلاش کن.",
    supportSecureContextRequired:"برای ارسال گزارش، مرورگر امن لازم است.",
    supportReportFailed:"گزارش ارسال نشد. دوباره تلاش کن.",
    supportBackendUnavailable:"ثبت گزارش هنوز به سرویس پشتیبانی متصل نشده است.",
  },
};

const navigation: { id: Page; key: string; icon: LucideIcon }[] = [
  { id: "home", key: "navHome", icon: Home },
  { id: "games", key: "navGames", icon: Grid2X2 },
  { id: "online", key: "navOnline", icon: Swords },
  { id: "tournaments", key: "navTournaments", icon: Trophy },
  { id: "friends", key: "navFriends", icon: Users },
  { id: "rooms", key: "navRooms", icon: ShieldCheck },
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
    <div className={`game-art tone-${game.color}`} aria-hidden="true">
      <span className="art-orb orb-one" /><span className="art-orb orb-two" />
      <div className="art-platform" />
      <div className="game-art-glyph"><Icon size={38} strokeWidth={1.6} /></div>
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
  const [activePlugin, setActivePlugin] = useState<ApprovedPluginDescriptor | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(228);
  const sidebarResizeStart = useRef<{ startX: number; startWidth: number } | null>(null);
  const toggleNavigationDrawer = () => {
    if (window.matchMedia("(max-width: 820px)").matches) setMobileNavOpen(open => !open);
    else setDesktopSidebarOpen(open => !open);
  };
  const resizeSidebar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = sidebarResizeStart.current;
    if (!start) return;
    const delta = direction === "rtl" ? start.startX - event.clientX : event.clientX - start.startX;
    setSidebarWidth(Math.max(190, Math.min(360, start.startWidth + delta)));
  };
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportReports, setSupportReports] = useState<SupportReportSummary[]>([]);
  const [supportReportsLoading, setSupportReportsLoading] = useState(false);
  const [supportReportsUnavailable, setSupportReportsUnavailable] = useState(false);
  const [supportRefresh, setSupportRefresh] = useState(0);
  const [memberWallet, setMemberWallet] = useState<MemberWallet | null>(null);
  const [socialRows, setSocialRows] = useState<SocialRelationship[]>([]);
  const [socialQuery, setSocialQuery] = useState("");
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialError, setSocialError] = useState("");
  const [socialRefresh, setSocialRefresh] = useState(0);
  const activeUserIdRef = useRef<string | null>(null);

  const t = (key: string) => supportCopy[locale][key] ?? copy[locale][key] ?? key;
  const [catalogGames, setCatalogGames] = useState<Game[]>(localCatalogPreview);

  useEffect(() => {
    let active = true;
    void gameCatalogProvider.listCatalog().then(entries => {
      if (active) setCatalogGames(entries as Game[]);
    }).catch(() => {
      if (active) setCatalogGames(localCatalogPreview);
    });
    return () => { active = false; };
  }, []);
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
    let authEventVersion = 0;

    const clearMemberScopedUi = (nextUserId: string | null, previousUserId: string | null) => {
      setMemberProfile(null);
      setProfileNameDraft("");
      setProfileSaveBusy(false);
      setProfileMessage("");
      setMemberWallet(null);
      setFavorites(nextUserId ? [] : ["chess", "pool"]);
      setFavoritesOnly(false);

      setSocialRows([]);
      setSocialQuery("");
      setSocialBusy(false);
      setSocialError("");

      setDeleteDialogOpen(false);
      setDeleteConfirmation("");
      setDeleteBusy(false);
      setDeleteMessage("");
      setAuthOpen(false);
      setAuthMessage("");
      setPassword("");
      setDisplayName("");
      setSearch("");
      setCategory("all");
      setNoticeOpen(false);

      // If one authenticated identity is replaced by another, return to a
      // neutral page so no member-specific view remains selected.
      if (previousUserId !== nextUserId && nextUserId !== null) {
        setLocale("en");
      }
      if (previousUserId !== null && nextUserId !== null && previousUserId !== nextUserId) {
        setPage("home");
      }
    };

    const adoptSession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      const previousUserId = activeUserIdRef.current;
      if (previousUserId !== nextUserId) {
        clearMemberScopedUi(nextUserId, previousUserId);
      }
      activeUserIdRef.current = nextUserId;
      setSession(nextSession);
    };

    void supabase.auth.getSession().then(({ data }) => {
      // A later auth event is newer than this startup snapshot; never let a
      // slow getSession result overwrite a session-change notification.
      if (active && authEventVersion === 0) {
        adoptSession(data.session);
        setAuthLoading(false);
      }
    }).catch(() => {
      if (active && authEventVersion === 0) setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authEventVersion += 1;
      adoptSession(nextSession);
      setAuthLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryReady(true);
        setAuthMode("reset");
        setAuthMessage("");
        setAuthOpen(true);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const db = supabase;
    const userId = session?.user.id;
    if (!db || !userId) {
      setMemberProfile(null);
      setProfileNameDraft("");
      setProfileMessage("");
      setMemberWallet(null);
      setFavorites(session ? [] : ["chess", "pool"]);
      return;
    }

    let active = true;
    setMemberProfile(null);
    setMemberWallet(null);
    setFavorites([]);
    void Promise.all([
      db.from("member_profiles")
        .select("user_id, username, display_name, avatar_key, locale, created_at")
        .eq("user_id", userId).maybeSingle(),
      db.from("coin_wallets")
        .select("user_id, free_coins, purchased_coins, reward_coins, updated_at")
        .eq("user_id", userId).maybeSingle(),
      db.from("member_favorites").select("game_id").eq("user_id", userId),
      db.from("member_preferences").select("locale").eq("user_id", userId).maybeSingle()
    ]).then(([profileResult, walletResult, favoriteResult, preferencesResult]) => {
      if (!active || activeUserIdRef.current !== userId) return;
      const loadedProfile = !profileResult.error ? profileResult.data as MemberProfile | null : null;
      setMemberProfile(loadedProfile);
      setProfileNameDraft(loadedProfile?.display_name ?? "");
      setMemberWallet(!walletResult.error ? walletResult.data as MemberWallet | null : null);
      setFavorites(!favoriteResult.error && favoriteResult.data
        ? favoriteResult.data.map(row => row.game_id)
        : []);
      const savedLocale = !preferencesResult.error ? preferencesResult.data?.locale : null;
      const profileLocale = !profileResult.error ? profileResult.data?.locale : null;
      if (savedLocale === "en" || savedLocale === "fa") setLocale(savedLocale);
      else if (profileLocale === "en" || profileLocale === "fa") setLocale(profileLocale);
    }).catch(() => {
      if (active && activeUserIdRef.current === userId) {
        setMemberProfile(null);
        setMemberWallet(null);
        setFavorites([]);
      }
    });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    const db = supabase;
    if (!db || !session?.user.id || page !== "friends") {
      setSocialRows([]);
      setSocialError("");
      setSocialBusy(false);
      return;
    }
    let stopped = false;
    let timer: number | undefined;
    const refreshRelationships = async () => {
      try {
        const { data, error } = await db.rpc("list_social_relationships");
        if (stopped || activeUserIdRef.current !== session.user.id) return;
        if (error) throw error;
        setSocialRows((data ?? []) as unknown as SocialRelationship[]);
        setSocialError("");
        setSocialBusy(false);
        timer = window.setTimeout(() => void refreshRelationships(), 12000);
      } catch {
        if (!stopped && activeUserIdRef.current === session.user.id) {
          setSocialRows([]);
          setSocialError(copy[locale].socialError);
          setSocialBusy(false);
          timer = window.setTimeout(() => void refreshRelationships(), 12000);
        }
      }
    };
    setSocialBusy(true);
    void refreshRelationships();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [page, session?.user.id, socialRefresh, locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  useEffect(() => {
    if (!supportDialogOpen || !supportReportsEnabled || !supabase || !session?.user.id) {
      setSupportReports([]);
      setSupportReportsLoading(false);
      setSupportReportsUnavailable(false);
      return;
    }
    let stopped = false;
    const userId = session.user.id;
    setSupportReportsLoading(true);
    setSupportReportsUnavailable(false);
    void listMySupportReports(supabase, userId, () => activeUserIdRef.current)
      .then(rows => { if (!stopped && activeUserIdRef.current === userId) setSupportReports(rows); })
      .catch(() => {
        if (stopped || activeUserIdRef.current !== userId) return;
        setSupportReports([]);
        setSupportReportsUnavailable(true);
      })
      .finally(() => { if (!stopped && activeUserIdRef.current === userId) setSupportReportsLoading(false); });
    return () => { stopped = true; };
  }, [supportDialogOpen, session?.user.id, supportRefresh]);

  const filteredGames = useMemo(() => catalogGames.filter((game) => {
    const matchesCategory = category === "all" || game.category === category;
    const matchesFavorite = !favoritesOnly || favorites.includes(game.id);
    const haystack = [game.title[locale], game.title.en, game.subtitle[locale], copy[locale][game.category] ?? game.category].join(" ").toLocaleLowerCase(locale);
    return matchesCategory && matchesFavorite && haystack.includes(search.trim().toLocaleLowerCase(locale));
  }), [catalogGames, category, favorites, favoritesOnly, locale, search]);

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
        if (activeUserIdRef.current !== userId) return;
        if (error) {
          setFavorites(current => wasSaved ? [...new Set([...current, id])] : current.filter(item => item !== id));
          setToast(t("favoriteFailed"));
        }
      });
    }
  };

  const openAuth = (mode: "signin" | "signup" | "reset" = "signin") => {
    setAuthMode(mode);
    setRecoveryReady(false);
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
    if ((authMode === "signup" || recoveryReady) && password.length < 12) {
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
      } else if (recoveryReady) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecoveryReady(false);
        setAuthOpen(false);
        setPassword("");
        setToast(t("passwordUpdated"));
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

  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    setToast(copy[nextLocale].settingsSaved);
    if (!supabase || !session?.user.id) return;
    const userId = session.user.id;
    setMemberProfile(current => current ? { ...current, locale: nextLocale } : current);
    void Promise.all([
      supabase.from("member_preferences").upsert({ user_id: userId, locale: nextLocale }, { onConflict: "user_id" }),
      supabase.from("member_profiles").update({ locale: nextLocale }).eq("user_id", userId)
    ]).then(([preferenceResult, profileResult]) => {
      if (activeUserIdRef.current !== userId) return;
      if (preferenceResult.error || profileResult.error) setToast(copy[nextLocale].authFailure);
    });
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = profileNameDraft.trim();
    if (!supabase || !session?.user.id || !memberProfile || memberProfile.user_id !== session.user.id) return;
    if (cleanName.length < 1 || cleanName.length > 32) {
      setProfileMessage(t("profileUpdateFailed"));
      return;
    }
    if (cleanName === memberProfile.display_name) {
      setProfileMessage("");
      return;
    }
    const userId = session.user.id;
    setProfileSaveBusy(true);
    setProfileMessage("");
    try {
      const { data, error } = await supabase
        .from("member_profiles")
        .update({ display_name: cleanName })
        .eq("user_id", userId)
        .select("user_id, username, display_name, avatar_key, locale, created_at")
        .maybeSingle();
      if (activeUserIdRef.current !== userId) return;
      if (error || !data || data.user_id !== userId) throw new Error("profile_update_failed");
      setMemberProfile(data as MemberProfile);
      setProfileNameDraft(data.display_name);
      setProfileMessage(t("profileUpdated"));
    } catch {
      if (activeUserIdRef.current === userId) setProfileMessage(t("profileUpdateFailed"));
    } finally {
      if (activeUserIdRef.current === userId) setProfileSaveBusy(false);
    }
  };

  const requestAccountDeletion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !session?.user.id || deleteConfirmation !== "DELETE") return;
    const userId = session.user.id;
    setDeleteBusy(true);
    setDeleteMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation: "DELETE" }
      });
      if (activeUserIdRef.current !== userId) return;
      if (error || !data || data.deleted !== true) throw new Error("account_delete_failed");

      // Do not sign out or clear a different member if the session changed
      // while the deletion request was in flight.
      await supabase.auth.signOut().catch(() => undefined);
      setSession(null);
      setMemberProfile(null);
      setMemberWallet(null);
      setFavorites(["chess", "pool"]);
      setSocialRows([]);
      setPage("home");
      setDeleteDialogOpen(false);
      setDeleteConfirmation("");
      setToast(t("deleteAccountSuccess"));
    } catch {
      if (activeUserIdRef.current === userId) setDeleteMessage(t("deleteAccountFailed"));
    } finally {
      if (activeUserIdRef.current === userId) setDeleteBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase || !session?.user.id) return;
    const userId = session.user.id;
    const { error } = await supabase.auth.signOut();
    if (activeUserIdRef.current !== userId) return;
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

  const openGame = async (game: Game) => {
    try {
      const result = await prepareGameLaunch(game.id, gameCatalogProvider, pluginRuntimePolicy);
      if (!result.allowed) {
        setToast(t("gameNotReady"));
        return;
      }
      setActivePlugin(result.descriptor);
    } catch {
      // Launch failures are intentionally generic; never surface raw registry or artifact data.
      setToast(t("gameNotReady"));
    }
  };

  const sendFriendRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !session?.user.id) {
      openAuth("signin");
      return;
    }
    const userId = session.user.id;
    const username = socialQuery.trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      setSocialError(t("usernameInvalid"));
      return;
    }
    setSocialBusy(true);
    setSocialError("");
    try {
      const { data, error } = await supabase.rpc("send_friend_request", { p_username: username });
      if (activeUserIdRef.current !== userId) return;
      if (error) {
        if (error.code === "22023" && error.message.toLowerCase().includes("rate")) {
          throw new Error("rate_limited");
        }
        if (error.code === "P0002") throw new Error("member_not_found");
        throw new Error("social_request_failed");
      }
      const result = (Array.isArray(data) ? data[0] : data) as {
        request_id?: string;
        relationship_status?: string;
      } | null;
      setSocialQuery("");
      setSocialRefresh(value => value + 1);
      if (result?.relationship_status === "accepted") setToast(t("alreadyFriends"));
      else if (result?.relationship_status === "incoming") setToast(t("incomingRequestExists"));
      else setToast(t("requestSent"));
    } catch (error) {
      if (activeUserIdRef.current !== userId) return;
      const code = error instanceof Error ? error.message : "social_request_failed";
      setSocialError(code === "rate_limited" ? t("socialRateLimit") : code === "member_not_found" ? t("memberNotFound") : t("socialError"));
    } finally {
      if (activeUserIdRef.current === userId) setSocialBusy(false);
    }
  };

  const respondToFriendRequest = async (
    relationship: SocialRelationship,
    action: "accepted" | "declined" | "blocked"
  ) => {
    if (!supabase || !session?.user.id || relationship.relationship_type !== "incoming") return;
    const userId = session.user.id;
    setSocialBusy(true);
    setSocialError("");
    try {
      const { error } = await supabase.rpc("respond_friend_request", {
        p_request_id: relationship.request_id,
        p_action: action
      });
      if (activeUserIdRef.current !== userId) return;
      if (error) throw error;
      setSocialRefresh(value => value + 1);
      setToast(action === "accepted" ? t("requestAccepted") : action === "declined" ? t("requestDeclined") : t("requestBlocked"));
    } catch {
      if (activeUserIdRef.current === userId) setSocialError(t("socialError"));
    } finally {
      if (activeUserIdRef.current === userId) setSocialBusy(false);
    }
  };

  const pageMeta: Record<Page, { title: string; subtitle: string }> = {
    home: { title: t("navHome"), subtitle: t("notLive") },
    games: { title: t("gamesTitle"), subtitle: t("gamesSub") },
    online: { title: t("onlineTitle"), subtitle: t("onlineSub") },
    tournaments: { title: t("tournamentsTitle"), subtitle: t("tournamentsSub") },
    friends: { title: t("friendsTitle"), subtitle: t("friendsSub") },
    rooms: { title: t("roomsTitle"), subtitle: t("roomsSub") },
    leaderboard: { title: t("rankTitle"), subtitle: t("rankSub") },
    wallet: { title: t("walletTitle"), subtitle: t("walletSub") },
    profile: { title: t("profileTitle"), subtitle: t("profileSub") },
    settings: { title: t("settingsTitle"), subtitle: t("settingsSub") }
  };

  return (
    <div className={`app-shell locale-${locale} ${desktopSidebarOpen ? "" : "sidebar-collapsed"}`} dir={direction} lang={locale} style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <header className="topbar">
        <button className="mobile-menu-btn" aria-label={locale === "en" ? (mobileNavOpen ? "Close menu" : "Open menu") : (mobileNavOpen ? "بستن منو" : "باز کردن منو")} aria-expanded={mobileNavOpen} aria-controls="playora-navigation-drawer" onClick={toggleNavigationDrawer}>{mobileNavOpen || !desktopSidebarOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <button className="brand-lockup" onClick={() => go("home")} aria-label="Playora home">
          <BrandMark /><span className="brand-word">PLAYORA<span>.</span></span>
        </button>
        <div className="topbar-tagline"><span className="status-pulse" />{t("liveLabel")}</div>
        <label className="global-search"><Search size={17} /><input aria-label={t("search")} placeholder={t("search")} value={search} onChange={e => { setSearch(e.target.value); setPage("games"); }} onFocus={() => setPage("games")} /><kbd>⌘ K</kbd></label>
        <div className="topbar-actions">
          <span className="demo-pill"><span />{t("demo")}</span>
          <button className="language-switch" onClick={() => changeLocale(locale === "en" ? "fa" : "en")} aria-label={locale === "en" ? "Switch language to Persian" : "Switch language to English"}><Languages size={16} /><span>{locale === "en" ? "EN" : "فا"}</span><ChevronDown size={13} /></button>
          <div className="notice-wrap">
            <button className="top-icon-btn" aria-label={t("notifications")} onClick={() => setNoticeOpen(!noticeOpen)}><Bell size={18} /><i /></button>
            {noticeOpen && <div className="notice-popover"><div className="popover-heading"><b>{t("notifications")}</b><span>0</span></div><p>{t("noAlerts")}</p></div>}
          </div>
          <button className="user-chip" aria-busy={authLoading} onClick={() => session ? go("profile") : openAuth("signin")} aria-label={session ? t("profileMenu") : t("signIn")}><span className="user-avatar">{session ? currentName.charAt(0).toLocaleUpperCase(locale) : "O"}</span><span className="user-chip-label">{currentName}</span><ChevronDown size={13} /></button>
        </div>
      </header>

      <div className="app-body">
        <aside id="playora-navigation-drawer" className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`} aria-hidden={typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches ? !mobileNavOpen : !desktopSidebarOpen} inert={typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches ? !mobileNavOpen : !desktopSidebarOpen}>
          <div className="sidebar-context"><span className="context-icon"><Gamepad2 size={15} /></span><span>PLAY<span>SPACE</span></span></div>
          <div className="sidebar-resize-handle" role="separator" aria-orientation="vertical" aria-label={locale === "en" ? "Resize navigation panel" : "تغییر اندازه پنل کناری"}
            onPointerDown={event => { sidebarResizeStart.current = { startX: event.clientX, startWidth: sidebarWidth }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }}
            onPointerMove={resizeSidebar}
            onPointerUp={() => { sidebarResizeStart.current = null; }}
            onPointerCancel={() => { sidebarResizeStart.current = null; }} />
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

        {mobileNavOpen && <button className="mobile-scrim" aria-label={locale === "en" ? "Close navigation" : "بستن ناوبری"} onClick={() => setMobileNavOpen(false)} />}

        <main className="main-content">
          {page !== "home" && <div className="page-title-row"><div><span className="page-kicker">{t("liveLabel")}</span><h1>{pageMeta[page].title}</h1><p>{pageMeta[page].subtitle}</p></div>{page === "games" && <span className="result-count">{filteredGames.length} {t("allGames").toLocaleLowerCase(locale)}</span>}</div>}

          {page === "home" && <>
            <section className="hero-panel">
              <div className="hero-glow hero-glow-a" /><div className="hero-glow hero-glow-b" /><div className="hero-grid-lines" />
              <div className="hero-copy">
                <span className="hero-eyebrow"><Sparkles size={14} />{t("eyebrow")}</span>
                <h1>{t("heroTitle")}<br /><span>{t("heroTitle2")}</span></h1>
                <p>{t("heroBody")}</p>
                <div className="hero-actions"><button className="btn-gradient" onClick={() => go("games")}>{t("findGame")}<ArrowRight size={17} /></button><button className="btn-ghost" onClick={() => go("online")}><Swords size={16} />{t("findRival")}</button></div>
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
                {catalogGames.filter(g => g.featured).map(game => <GameCard key={game.id} game={game} locale={locale} onOpen={openGame} saved={favorites.includes(game.id)} onSave={() => toggleFavorite(game.id)} t={t} />)}
              </div>
            </section>

            <section className="tournament-banner">
              <div className="tournament-trophy"><Trophy size={31} /></div><div className="tournament-copy"><span>{t("featured")}</span><h2>{t("weekly")}</h2><p>{t("weeklyText")}</p></div><div className="tournament-meta"><span><Ticket size={15} />{t("eventStatus")}</span><b>{t("upTo")}</b></div><button className="btn-gradient compact" onClick={() => go("tournaments")}>{t("joinNow")}<ArrowRight size={15} /></button>
            </section>
          </>}

          {page === "games" && <>
            <div className="preview-disclaimer"><ShieldCheck size={16} /><span>{t("allGamesUnavailable")}</span></div>
            <div className="catalog-toolbar"><div className="category-tabs" role="group" aria-label={t("mode")}>{categories.map(item => <button key={item.id} className={category === item.id ? "selected" : ""} onClick={() => setCategory(item.id)}>{t(item.key)}</button>)}</div><button className={`favorites-filter ${favoritesOnly ? "selected" : ""}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Heart size={15} fill={favoritesOnly ? "currentColor" : "none"} />{t("favorites")}</button></div>
            {filteredGames.length > 0 ? <div className="games-grid catalog-grid">{filteredGames.map(game => <GameCard key={game.id} game={game} locale={locale} onOpen={openGame} saved={favorites.includes(game.id)} onSave={() => toggleFavorite(game.id)} t={t} />)}</div> : <EmptyState icon={Search} title={t("emptySearch")} text={t("clearSearch")} />}
            <div className="preview-disclaimer"><ShieldCheck size={16} /><span>{t("previewNote")}</span></div>
          </>}

          {page === "online" && <section className="online-page">
            <div className="online-feature-card">
              <div className="online-feature-copy">
                <span className="hero-eyebrow"><ShieldCheck size={14} />{t("matchType")}</span>
                <h2>{t("findRival")}</h2>
                <p>{t("rankedUnavailable")}</p>
              </div>
              <div className="online-feature-art" aria-hidden="true">
                <div className="online-orbit orbit-a" /><div className="online-orbit orbit-b" />
                <div className="online-versus"><span>?</span><b>—</b><span>?</span></div>
              </div>
            </div>
            {!session && <div className="social-login-panel"><div className="social-login-icon"><LockKeyhole size={24} /></div><div><h3>{t("signIn")}</h3><p>{t("accountRequired")}</p></div><button className="btn-gradient" onClick={() => openAuth("signin")}><LogIn size={15} />{t("signIn")}</button></div>}
            <div className="preview-disclaimer"><ShieldCheck size={16} /><span>{t("rankedUnavailable")}</span></div>
          </section>}

          {page === "rooms" && <section className="private-rooms-page">
            <div className="private-room-hero">
              <div className="private-room-hero-copy">
                <span className="hero-eyebrow"><ShieldCheck size={14} />{t("privateRooms")}</span>
                <h2>{t("roomsTitle")}</h2>
                <p>{t("roomsSub")}</p>
                <div className="private-room-benefits"><span><LockKeyhole size={14} />{t("secureNote")}</span><span><ShieldCheck size={14} />{t("noGameYet")}</span></div>
              </div>
              <div className="private-room-emblem" aria-hidden="true"><div className="room-emblem-ring"><Users size={34} /></div><span className="room-emblem-dot dot-a" /><span className="room-emblem-dot dot-b" /><span className="room-emblem-dot dot-c" /></div>
            </div>
            {!session && <div className="social-login-panel"><div className="social-login-icon"><LockKeyhole size={24} /></div><div><h3>{t("signIn")}</h3><p>{t("accountRequired")}</p></div><button className="btn-gradient" onClick={() => openAuth("signin")}><LogIn size={15} />{t("signIn")}</button></div>}
            <div className="preview-disclaimer"><ShieldCheck size={16} /><span>{t("noGameYet")}</span></div>
          </section>}

          {page === "tournaments" && <><section className="event-hero"><div><span className="hero-eyebrow"><Trophy size={14} />{t("featured")}</span><h2>{t("weekly")}</h2><p>{t("tournamentsSub")}</p><span className="event-coming">{t("eventStatus")}</span></div><div className="event-hero-icon"><Trophy size={68} /></div></section><div className="event-list">{[{key:"eventOne", icon:Crown, color:"cyan", players:"128"},{key:"eventTwo", icon:Activity, color:"violet", players:"64"},{key:"eventThree", icon:Dices, color:"pink", players:"32"}].map((event) => { const Icon=event.icon; return <article className="event-row" key={event.key}><span className={`event-game-icon tone-${event.color}`}><Icon size={23} /></span><div className="event-row-copy"><h3>{t(event.key)}</h3><p>{t("eventTime")} · {event.players} {t("eventPlayers")}</p></div><span className="event-row-status">{t("eventStatus")}</span><button className="btn-outline" onClick={() => setToast(t("noGameYet"))}>{t("explore")}<ArrowRight size={14} /></button></article>; })}</div><div className="preview-disclaimer"><ShieldCheck size={16} /><span>{t("noMoney")}</span></div></>}

          {page === "friends" && <section className="social-page">
            <div className="social-feature-panel">
              <div className="social-feature-icon"><Users size={26} /></div>
              <div className="social-feature-copy"><span className="section-eyebrow">{t("friendsTitle")}</span><h2>{t("friendSearchTitle")}</h2><p>{t("friendsSub")}</p></div>
              <div className="social-feature-lock"><LockKeyhole size={16} />{t("secureNote")}</div>
            </div>
            {!session && <div className="social-login-panel"><div className="social-login-icon"><LockKeyhole size={24} /></div><div><h3>{t("signIn")}</h3><p>{t("accountRequired")}</p></div><button className="btn-gradient" onClick={() => openAuth("signin")}><LogIn size={15} />{t("signIn")}</button></div>}
            {session && <>
              <section className="social-search-card">
                <div className="social-card-heading"><div><span className="section-eyebrow">{t("friendsTitle")}</span><h2>{t("friendSearchTitle")}</h2></div><span className="social-search-symbol"><Search size={18} /></span></div>
                <p>{t("friendSearchBody")}</p>
                <form className="social-search-form" onSubmit={event => void sendFriendRequest(event)}>
                  <label className="social-username-field"><span>{t("friendUsername")}</span><input aria-label={t("friendUsername")} name="username" type="text" autoComplete="off" spellCheck={false} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" placeholder="player_123abc" value={socialQuery} onChange={event => setSocialQuery(event.target.value)} required /></label>
                  <button className="btn-gradient" type="submit" disabled={socialBusy || !socialQuery.trim()}>{socialBusy ? t("loading") : t("sendRequest")}<ArrowRight size={15} /></button>
                </form>
                <div className="social-privacy-note"><ShieldCheck size={14} />{t("secureNote")}</div>
              </section>
              {socialError && <p className="private-room-error" role="alert">{socialError}</p>}
              <section className="social-section">
                <div className="social-section-heading"><div><span className="section-eyebrow">{t("incomingRequests")}</span><h2>{t("incomingRequests")}</h2></div><span className="social-count">{socialRows.filter(row => row.relationship_type === "incoming").length}</span></div>
                {socialRows.filter(row => row.relationship_type === "incoming").length === 0
                  ? <div className="social-empty-row">{socialBusy ? t("loading") : t("noIncomingRequests")}</div>
                  : <div className="social-list">{socialRows.filter(row => row.relationship_type === "incoming").map(relationship => <article className="social-row" key={relationship.request_id}>
                      <span className="social-avatar">{(relationship.other_display_name || relationship.other_username).charAt(0).toLocaleUpperCase(locale)}</span>
                      <div className="social-person"><b>{relationship.other_display_name || relationship.other_username}</b><span>@{relationship.other_username}</span></div>
                      <span className="social-state state-incoming">{t("requestIncoming")}</span>
                      <div className="social-row-actions"><button className="btn-gradient" disabled={socialBusy} onClick={() => void respondToFriendRequest(relationship,"accepted")}><Check size={14} />{t("acceptRequest")}</button><button className="btn-outline" disabled={socialBusy} onClick={() => void respondToFriendRequest(relationship,"declined")}>{t("declineRequest")}</button><button className="btn-ghost" disabled={socialBusy} onClick={() => void respondToFriendRequest(relationship,"blocked")}>{t("blockRequest")}</button></div>
                    </article>)}</div>}
              </section>
              <section className="social-section">
                <div className="social-section-heading"><div><span className="section-eyebrow">{t("yourFriends")}</span><h2>{t("yourFriends")}</h2></div><span className="social-count">{socialRows.filter(row => row.relationship_type === "friend").length}</span></div>
                {socialRows.filter(row => row.relationship_type === "friend").length === 0
                  ? <div className="social-empty-row">{socialBusy ? t("loading") : t("noFriendsYet")}</div>
                  : <div className="social-list">{socialRows.filter(row => row.relationship_type === "friend").map(relationship => <article className="social-row" key={relationship.request_id}>
                      <span className="social-avatar friend-avatar">{(relationship.other_display_name || relationship.other_username).charAt(0).toLocaleUpperCase(locale)}</span>
                      <div className="social-person"><b>{relationship.other_display_name || relationship.other_username}</b><span>@{relationship.other_username}</span></div>
                      <span className="social-state state-friend"><Check size={13} />{t("friendStatus")}</span>
                    </article>)}</div>}
              </section>
              <section className="social-section">
                <div className="social-section-heading"><div><span className="section-eyebrow">{t("outgoingRequests")}</span><h2>{t("outgoingRequests")}</h2></div><span className="social-count">{socialRows.filter(row => row.relationship_type === "outgoing").length}</span></div>
                {socialRows.filter(row => row.relationship_type === "outgoing").length === 0
                  ? <div className="social-empty-row">{socialBusy ? t("loading") : t("noOutgoingRequests")}</div>
                  : <div className="social-list">{socialRows.filter(row => row.relationship_type === "outgoing").map(relationship => <article className="social-row" key={relationship.request_id}>
                      <span className="social-avatar">{(relationship.other_display_name || relationship.other_username).charAt(0).toLocaleUpperCase(locale)}</span>
                      <div className="social-person"><b>{relationship.other_display_name || relationship.other_username}</b><span>@{relationship.other_username}</span></div>
                      <span className="social-state state-outgoing">{t("requestOutgoing")}</span>
                    </article>)}</div>}
              </section>
              <section className="social-section">
                <div className="social-section-heading"><div><span className="section-eyebrow">{t("blockedPeople")}</span><h2>{t("blockedPeople")}</h2></div><span className="social-count">{socialRows.filter(row => row.relationship_type === "blocked").length}</span></div>
                {socialRows.filter(row => row.relationship_type === "blocked").length === 0
                  ? <div className="social-empty-row">{socialBusy ? t("loading") : t("noBlockedPeople")}</div>
                  : <div className="social-list">{socialRows.filter(row => row.relationship_type === "blocked").map(relationship => <article className="social-row" key={relationship.request_id}>
                      <span className="social-avatar blocked-avatar"><ShieldCheck size={17} /></span>
                      <div className="social-person"><b>{relationship.other_display_name || relationship.other_username}</b><span>@{relationship.other_username}</span></div>
                      <span className="social-state state-blocked">{t("blockedStatus")}</span>
                    </article>)}</div>}
              </section>
            </>}
          </section>}

          {page === "leaderboard" && <section className="leaderboard-page">
            <div className="leaderboard-hero">
              <div className="leaderboard-hero-icon"><Trophy size={29} /></div>
              <div className="leaderboard-hero-copy"><span className="section-eyebrow">{t("rankTitle")}</span><h2>{t("rankTitle")}</h2><p>{t("rankedUnavailable")}</p></div>
            </div>
            {!session && <div className="social-login-panel"><div className="social-login-icon"><LockKeyhole size={24} /></div><div><h3>{t("signIn")}</h3><p>{t("accountRequired")}</p></div><button className="btn-gradient" onClick={() => openAuth("signin")}><LogIn size={15} />{t("signIn")}</button></div>}
            <div className="leaderboard-empty"><div className="empty-state-icon"><Trophy size={26} /></div><h3>{t("rankedUnavailable")}</h3></div>
          </section>}

          {page === "wallet" && <section className="wallet-layout"><div className="wallet-balance-card"><span className="wallet-label"><Coins size={16} />{t("balance")}</span><b className="wallet-total">{formattedCoins} <small>{t("coins")}</small></b><span className="wallet-preview-tag"><LockKeyhole size={13} />{t("noMoney")}</span><div className="wallet-actions"><button disabled onClick={() => setToast(t("walletToast"))}><CreditCard size={16} />{t("deposit")}</button><button disabled onClick={() => setToast(t("walletToast"))}><Activity size={16} />{t("history")}</button></div></div><div className="crypto-info-card"><div className="crypto-card-head"><span className="security-icon"><ShieldCheck size={18} /></span><span className="connection-status">{t("notConnected")}</span></div><h2>{t("cryptoTitle")}</h2><p>{t("cryptoText")}</p><div className="crypto-list"><span className="crypto-token usdt">₮</span><div><b>USDT</b><small>Example asset · no deposit address</small></div><span className="crypto-token btc">₿</span><div><b>BTC</b><small>Not configured</small></div></div><button className="btn-disabled" disabled><LockKeyhole size={15} />{t("notConnected")}</button></div></section>}

          {page === "profile" && <section className="profile-layout"><div className="profile-card"><div className="profile-cover"><BrandMark /></div><div className="profile-identity"><span className="profile-avatar-large">{session ? currentName.charAt(0).toLocaleUpperCase(locale) : "O"}</span><div><h2>{session ? currentName : t("sampleProfile")}</h2><p>{session ? (memberProfile?.user_id === session.user.id ? "@" + memberProfile.username : t("loading")) : t("account")}</p></div>{session && <span className="profile-level"><BadgeCheck size={14} />{t("member")}</span>}</div>
              {session && memberProfile?.user_id === session.user.id && <form className="profile-edit-form" onSubmit={event => void saveProfile(event)}>
                <label htmlFor="profile-display-name">{t("displayName")}</label>
                <div className="profile-edit-controls"><input id="profile-display-name" name="profileDisplayName" value={profileNameDraft} onChange={event => setProfileNameDraft(event.target.value)} minLength={1} maxLength={32} required autoComplete="nickname" /><button className="btn-gradient" type="submit" disabled={profileSaveBusy || profileNameDraft.trim() === memberProfile.display_name}>{profileSaveBusy ? t("loading") : t("saveProfile")}<Check size={14} /></button></div>
                {profileMessage && <p className={"profile-edit-message " + (profileMessage === t("profileUpdated") ? "is-success" : "is-error")} role="status">{profileMessage}</p>}
              </form>}<div className="profile-stats">
                <div><b>—</b><span>{t("statMatches")}</span></div>
                <div><b>—</b><span>{t("statWins")}</span></div>
                <div><b>—</b><span>{t("statRating")}</span></div>
                <div><b>—</b><span>{t("profileXp")}</span></div>
              </div>
              {session && <section className="profile-history"><p className="profile-history-empty">{t("rankedUnavailable")}</p></section>}
              {session ? <div className="profile-auth-footer"><p>{t("securityLiveNote")}</p><button className="btn-outline" onClick={() => void handleSignOut()}><LogIn size={14} />{t("signOut")}</button></div> : <div className="profile-auth-footer"><p>{t("accountRequired")}</p><button className="btn-gradient" onClick={() => openAuth("signin")}><LogIn size={15} />{t("signIn")}</button></div>}</div></section>}

          {page === "settings" && <section className="settings-layout"><div className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Languages size={20} /></div><div><h2>{t("language")}</h2><p>{t("settingsSub")}</p></div></div><div className="language-options"><button className={locale === "en" ? "language-option selected" : "language-option"} onClick={() => changeLocale("en")}><span className="language-flag">EN</span><span><b>{t("english")}</b><small>English · LTR</small></span>{locale === "en" && <Check size={17} />}</button><button className={locale === "fa" ? "language-option selected" : "language-option"} onClick={() => changeLocale("fa")}><span className="language-flag fa-flag">فا</span><span><b>{t("persian")}</b><small>فارسی · RTL</small></span>{locale === "fa" && <Check size={17} />}</button></div></div><div className="settings-card security-card"><div className="settings-card-heading"><div className="settings-icon shield"><ShieldCheck size={20} /></div><div><h2>{t("security")}</h2><p>{t("securityText")}</p></div></div><div className="security-check-row"><LockKeyhole size={16} /><span>{t("secureNote")}</span></div><p className="security-live-note">{session ? t("securityLiveNote") : t("securityText")}</p><button className="text-action" onClick={() => setToast(t("security"))}>{t("about")}<ArrowRight size={15} /></button></div>{session && <div className="settings-card danger-card"><div className="settings-card-heading"><div className="settings-icon danger"><ShieldCheck size={20} /></div><div><h2>{t("accountDangerTitle")}</h2><p>{t("accountDangerBody")}</p></div></div><button className="danger-action" type="button" onClick={() => { setDeleteConfirmation(""); setDeleteMessage(""); setDeleteDialogOpen(true); }} disabled={!supabaseConfigured || !accountDeletionEnabled || deleteBusy}><X size={15} />{t("deleteAccount")}</button>{!accountDeletionEnabled && <p className="danger-unavailable-note">{t("deleteAccountNotEnabled")}</p>}</div>}</section>}

          <footer className="main-footer"><div><BrandMark /><span>{t("footer")}</span></div><span>{t("rights")}</span><button type="button" onClick={() => setSupportDialogOpen(true)}><LifeBuoy size={13} />{t("help")}</button><button onClick={() => go("settings")}><ShieldCheck size={13} />{t("security")}</button></footer>
        </main>
      </div>
      <SupportReportDialog
        open={supportDialogOpen}
        backendReady={supportReportsEnabled && supabaseConfigured}
        locale={locale}
        routeKey={page}
        isSignedIn={Boolean(session?.user.id)}
        recentReports={supportReports}
        reportsLoading={supportReportsLoading}
        reportsUnavailable={supportReportsUnavailable}
        t={t}
        onClose={() => setSupportDialogOpen(false)}
        onSignIn={() => { setSupportDialogOpen(false); openAuth("signin"); }}
        onSubmit={async (report: SupportReportSubmission) => {
          if (!supabase || !session?.user.id) throw new Error("session_changed");
          return submitMySupportReport(supabase, report, session.user.id, () => activeUserIdRef.current);
        }}
        onReportCreated={report => {
          setSupportReports(current => [report, ...current.filter(item => item.id !== report.id)].slice(0, 5));
          setSupportRefresh(value => value + 1);
          setToast(t("supportReportSubmitted"));
        }}
      />
      {toast && <div className="toast-message" role="status"><span className="toast-check"><Check size={15} /></span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}><X size={15} /></button></div>}
      {activePlugin && <div className="plugin-launch-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setActivePlugin(null); }}>
        <section className="plugin-launch-dialog" role="dialog" aria-modal="true" aria-label={locale === "fa" ? "نشست بازی ایزوله" : "Isolated game session"}>
          <GamePluginHost
            descriptor={activePlugin}
            policy={pluginRuntimePolicy}
            locale={locale}
            displayAlias={currentName}
            grantedCapabilities={activePlugin.capabilities}
            onExit={() => setActivePlugin(null)}
            onError={() => setToast(t("gameNotReady"))}
          />
        </section>
      </div>}
      {deleteDialogOpen && session && <div className="auth-backdrop deletion-backdrop" role="presentation" onMouseDown={event => { if (!deleteBusy && event.target === event.currentTarget) setDeleteDialogOpen(false); }}>
        <section className="auth-modal deletion-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
          <div className="auth-modal-top"><span className="auth-modal-mark deletion-mark"><ShieldCheck size={22} /></span><button className="auth-close" type="button" aria-label={t("cancel")} onClick={() => { if (!deleteBusy) setDeleteDialogOpen(false); }} disabled={deleteBusy}><X size={18} /></button></div>
          <span className="auth-eyebrow danger-eyebrow">{t("accountDangerTitle")}</span>
          <h2 id="delete-account-title">{t("deleteAccountConfirm")}</h2>
          <p>{t("deleteAccountInstruction")}</p>
          <div className="deletion-warning"><LockKeyhole size={17} /><span>{t("deleteAccountWarning")}</span></div>
          <form className="auth-form" onSubmit={event => void requestAccountDeletion(event)}>
            <label htmlFor="delete-account-confirmation">{t("typeDelete")}<input id="delete-account-confirmation" name="deleteConfirmation" autoComplete="off" spellCheck={false} value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} maxLength={12} required disabled={deleteBusy} /></label>
            {deleteMessage && <p className="auth-message deletion-error" role="alert">{deleteMessage}</p>}
            <div className="deletion-actions"><button type="button" className="btn-ghost" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmation(""); setDeleteMessage(""); }} disabled={deleteBusy}>{t("cancel")}</button><button type="submit" className="danger-action" disabled={deleteBusy || deleteConfirmation !== "DELETE" || !supabaseConfigured || !accountDeletionEnabled}><X size={15} />{deleteBusy ? t("deleteAccountBusy") : t("deleteAccount")}</button></div>
          </form>
        </section>
      </div>}
      {authOpen && <div className="auth-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
        <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <div className="auth-modal-top"><span className="auth-modal-mark"><BrandMark /></span><button className="auth-close" type="button" aria-label="Close sign in" onClick={() => setAuthOpen(false)}><X size={18} /></button></div>
          <span className="auth-eyebrow">PLAYORA ACCOUNT</span>
          <h2 id="auth-modal-title">{authMode === "signup" ? t("signUp") : authMode === "reset" ? (recoveryReady ? t("setNewPassword") : t("resetPassword")) : t("authTitle")}</h2>
          <p>{t("authSubtitle")}</p>
          {!supabaseConfigured && <div className="auth-config-warning" role="status"><ShieldCheck size={17} /><span>{t("authUnavailable")}</span></div>}
          {authMode !== "reset" && <button type="button" className="google-auth-btn" disabled={!supabaseConfigured || authBusy} onClick={() => void handleGoogleSignIn()}><GoogleGlyph />{t("continueWithGoogle")}</button>}
          {authMode !== "reset" && <div className="auth-divider"><span>{locale === "en" ? "OR CONTINUE WITH EMAIL" : "یا با ایمیل ادامه بده"}</span></div>}
          <form className="auth-form" onSubmit={event => void handleAuthSubmit(event)}>
            {authMode === "signup" && <label>{t("displayName")}<input autoComplete="nickname" name="displayName" type="text" maxLength={32} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder={t("displayName")} /></label>}
            {(authMode !== "reset" || !recoveryReady) && <label>{t("email")}<input required autoComplete="email" name="email" type="email" inputMode="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
            {(authMode !== "reset" || recoveryReady) && <label>{t("password")}<input required autoComplete={authMode === "signup" || recoveryReady ? "new-password" : "current-password"} name="password" type="password" minLength={authMode === "signup" || recoveryReady ? 12 : undefined} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder={authMode === "signup" || recoveryReady ? t("passwordHint") : "••••••••••••"} /></label>}
            {authMode === "signin" && <button type="button" className="auth-text-action" onClick={() => { setAuthMode("reset"); setRecoveryReady(false); setAuthMessage(""); }}>{t("forgotPassword")}</button>}
            {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
            <button className="btn-gradient auth-submit" type="submit" disabled={authBusy || !supabaseConfigured}>{authBusy ? t("loading") : authMode === "signup" ? t("signUp") : authMode === "reset" ? (recoveryReady ? t("setNewPassword") : t("resetPassword")) : t("signIn")}<ArrowRight size={16} /></button>
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

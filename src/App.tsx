import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import { supabase, supabaseConfigured, accountDeletionEnabled } from "./lib/supabase";
import { gameList } from "./catalog/gameRegistry";
import type { CatalogGame as Game } from "./catalog/gameRegistry";
import { applyTicTacToeMove, chooseTicTacToeBotMove, createTicTacToeState } from "./games/tictactoe";
import type { TicTacToeMark, TicTacToeState } from "./games/tictactoe";
import { applyCheckersMove, chooseCheckersBotMove, createCheckersState, getCheckersLegalMoves } from "./games/checkers";
import type { CheckersState } from "./games/checkers";
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, Bell, BarChart3, Check, ChevronDown, Swords,
  Coins, Crown, CreditCard, Dices, Gamepad2, Grid2X2, Heart, Home,
  Languages, LockKeyhole, LogIn, Medal, Menu, Plus, Search, Settings,
  ShieldCheck, Sparkles, Ticket, Trophy, UserRound, Users,
  Wallet, X, Zap
} from "lucide-react";
import "./index.css";

type Locale = "en" | "fa";
type Page = "home" | "games" | "online" | "tournaments" | "friends" | "rooms" | "leaderboard" | "wallet" | "profile" | "settings";
type Category = "all" | "strategy" | "board" | "cards" | "puzzle";
type MemberProfile = { user_id: string; username: string; display_name: string; avatar_key: string | null; locale: Locale; created_at: string };
type MemberWallet = { user_id: string; free_coins: number | string; purchased_coins: number | string; reward_coins: number | string; updated_at: string };
type MemberGameStats = { user_id: string; game_id: string; xp: number | string; competitive_rating: number; matches_played: number; wins: number; losses: number; draws: number; updated_at: string };
type RankedHistoryRow = { id: string; status: string; my_result: "win" | "loss" | "draw" | "forfeit" | null; finished_at: string | null; created_at: string; mode: string };
type OnlineMatchSnapshot = { id: string; status: "active" | "completed" | "cancelled" | "disputed" | "created" | "waiting"; server_state: { board?: TicTacToeMark[]; current_mark?: "X" | "O"; current_seat?: number }; my_result?: "win" | "loss" | "draw" | "forfeit" | null; state_version: number };
type PrivateRoomRow = { id: string; game_id: string; status: "open" | "active" | "closed" | "expired"; max_players: number; expires_at: string; created_at: string; match_id: string | null; my_role: "host" | "player" };
type SocialRelationship = { request_id: string; other_username: string; other_display_name: string; relationship_type: "friend" | "incoming" | "outgoing" | "blocked"; request_status: "pending" | "accepted" | "declined" | "blocked"; created_at: string };
type LeaderboardEntry = { rank_position: number | string; username: string; display_name: string; xp: number | string; competitive_rating: number; matches_played: number; wins: number; losses: number; draws: number; updated_at: string };
const copy: Record<Locale, Record<string, string>> = {
  en: {
    navHome: "Home", navGames: "Games", navOnline: "1v1 Arena", navTournaments: "Tournaments", navFriends: "Friends", navRooms: "Private Rooms", navRank: "Leaderboard", navWallet: "Wallet", navProfile: "Profile", navSettings: "Settings",
    search: "Search games, modes, and more", coins: "Playora Coins", demo: "Preview mode",
    eyebrow: "THE NEXT MOVE IS YOURS", heroTitle: "Your skills.", heroTitle2: "Your victory.", heroBody: "Meet your next rival. Master your favorite games. Make every move count.", findGame: "Explore games", viewTournaments: "View tournaments", liveLabel: "GLOBAL GAME NETWORK", notLive: "UI preview · online play is not connected",
    quickAccess: "Jump back in", allGames: "All games", seeAll: "View all", popular: "Popular games", popularSub: "Choose your next challenge",
    weekly: "Weekly Championship", weeklyText: "A new arena. A fresh leaderboard.", upTo: "Preview prize pool", joinNow: "Explore event", featured: "FEATURED EVENT", eventStatus: "Coming soon",
    categoryAll: "All games", categoryStrategy: "Strategy", categoryBoard: "Board", categoryCards: "Card games", categoryPuzzle: "Puzzles",
    gamesTitle: "Find your game", gamesSub: "A growing collection for sharp minds and friendly rivals.", favorites: "Favorites", emptySearch: "No games found", clearSearch: "Clear search",
    soon: "Coming soon", details: "View details", previewNote: "Game engines and live matchmaking are not connected in this preview.",
    rankTitle: "The leaderboard", rankSub: "Ranked Tic Tac Toe results only. Practice and private games never affect these standings.", friendsTitle: "Find your people", friendsSub: "Find players by username, accept requests and manage your friends. Email addresses are never searchable.", roomsTitle: "Private rooms", roomsSub: "Create a room and invite a friend with a one-time code. Private matches never affect XP, rating, coins or prizes.", friendSearchTitle: "Find a player", friendSearchBody: "Enter the exact username shown on their profile.", friendUsername: "Player username", sendRequest: "Send request", incomingRequests: "Requests for you", outgoingRequests: "Requests sent", yourFriends: "Your friends", blockedPeople: "Blocked", noIncomingRequests: "No pending requests.", noOutgoingRequests: "No outgoing requests.", noFriendsYet: "No friends yet. Search a username above to send a request.", noBlockedPeople: "No blocked players.", requestIncoming: "Incoming", requestOutgoing: "Pending", friendStatus: "Friend", blockedStatus: "Blocked", acceptRequest: "Accept", declineRequest: "Decline", blockRequest: "Block", requestSent: "Friend request sent.", incomingRequestExists: "This player has already requested to connect. Check your incoming requests.", requestAccepted: "Friend request accepted.", requestDeclined: "Request declined.", requestBlocked: "Request blocked.", alreadyFriends: "You are already friends.", memberNotFound: "That username was not found.", usernameInvalid: "Enter a valid username (3–24 letters, numbers or underscores).", socialRateLimit: "Too many requests. Wait a little and try again.", socialError: "The social request could not be completed. Please retry.", leaderboardEmpty: "No verified ranked matches yet. Complete a ranked online match to appear here.", leaderboardLoading: "Loading verified standings…", leaderboardError: "The leaderboard is temporarily unavailable.", leaderboardRefresh: "Refresh", leaderboardRank: "Rank", leaderboardRating: "Rating", leaderboardXp: "XP", leaderboardMatches: "Matches", leaderboardWins: "Wins", leaderboardHint: "Only server-verified ranked Tic Tac Toe matches count. Practice and private rooms never affect XP, rating or leaderboard position.",
    tournamentsTitle: "Enter the arena", tournamentsSub: "Explore the tournament interface. Entry fees and rewards are disabled in this preview.",
    walletTitle: "Your wallet", walletSub: "Preview-only balance. No funds or cryptocurrency can be sent from this screen.", balance: "Demo balance", deposit: "Deposit", history: "Transaction history", cryptoTitle: "Crypto deposits", cryptoText: "Wallet addresses and on-chain verification are not configured. Never send assets to this preview.", notConnected: "Not connected",
    profileTitle: "Player profile", profileSub: "This is sample UI data, not a signed-in account.", settingsTitle: "Preferences", settingsSub: "Choose your language and review the security model.", language: "Language", english: "English", persian: "فارسی",
    security: "Privacy by design", securityText: "Private account data is intended to be isolated server-side by authenticated user ID and database row-level security. Live authentication is not connected yet.",
    secureNote: "Never put secret keys in browser code. Client-side UI checks do not replace server authorization.", about: "About Playora", help: "Help & support", profileMenu: "Open profile", notifications: "Notifications", noAlerts: "You’re all caught up.", account: "Guest preview", online: "Online competition", privateRooms: "Private rooms", refresh: "Refresh", you: "You", strategy: "Strategy", board: "Board", cards: "Card", puzzle: "Puzzle",
    gameNotReady: "This game is not playable yet. The card is a design preview.", privateRoomOnlyGame: "Private rooms currently support Tic Tac Toe only.", createPrivateRoom: "Create a free room", joinPrivateRoom: "Join with invite code", inviteCode: "Invite code", inviteCreated: "Room created. Copy this code and share it with your friend.", copyInvite: "Copy code", codeCopied: "Invite code copied.", codeCopyFailed: "Copy failed. Select and copy the code manually.", enterInviteCode: "Enter the 32-character invite code", roomList: "Your rooms", noPrivateRooms: "No private rooms yet. Create one to invite a friend.", roomCreated: "Room created", roomOpen: "Waiting for a friend", roomActive: "Match ready", roomClosed: "Closed", roomExpired: "Expired", hostLabel: "Host", playerLabel: "Player", expiresLabel: "Expires", openPrivateMatch: "Open match", leavePrivateRoom: "Leave room", closePrivateRoom: "Close room", privateMatchTitle: "Private match", privateNoRewards: "Private play is free. No coins, XP, rating or prizes are awarded.", privateYourTurn: "Your turn", privateOpponentTurn: "Friend’s turn", privateWin: "You won the private match.", privateLoss: "Your friend won the private match.", privateWaiting: "Waiting for the other player to join…", privateRoomError: "That room could not be opened. Check the invite code or try again.", privateMatchError: "The private match request failed. Please refresh and try again.", noPrivateMatch: "This room has not started a match yet.", roomExpiredHint: "Invite codes expire after 24 hours.", settingsSaved: "Preference updated for this preview.", walletToast: "Deposits are disabled until the secure backend is configured.", nav: "Main navigation",
    statMatches: "Matches", statWins: "Wins", statRating: "Rating", footer: "Play anywhere. Compete with purpose.", rights: "Preview build · Not a live service", matchMade: "Skill-based matchmaking", safePlay: "Built with privacy in mind",
    matchType: "1v1 MATCH", findRival: "Find a rival", randomPairing: "Random opponent matching", balanced: "Skill-aware matchmaking", noGameYet: "Gameplay is not enabled in this build.",
    eventOne: "Chess Champions", eventTwo: "Pool Masters", eventThree: "Ludo League", eventPlayers: "Players", eventTime: "Starts soon", explore: "Explore", mode: "Game mode",
    demoCoins: "2,450", sampleProfile: "OrbitRider", level: "Level", points: "XP", noMoney: "No real-money functionality",
    practiceAvailable: "Practice", onlineTitle: "Find a rival", onlineSub: "Start a ranked match against a randomly selected player. No choosing opponents, no paid entry in this build.",
    rankedTtt: "Tic Tac Toe · Ranked 1v1", rankedTttDetails: "Server-validated turns, skill-aware random matchmaking, and ratings updated only after a verified result.",
    queueButton: "Find random opponent", cancelQueue: "Cancel search", queueIdle: "Ready when you are", queueing: "Joining matchmaking…", queueWaiting: "Searching for a fair match…", queueMatched: "Opponent found",
    onlineError: "The online match service could not complete that request. Check the backend setup and try again.", onlineNeedsLogin: "Sign in to join ranked matchmaking. Your match and rating are tied to your authenticated account.",
    onlineNoRewards: "XP and rating update only after a verified ranked result. This preview has no real-money entry or prizes.", yourMark: "You", opponentMark: "Random opponent",
    onlineYourTurn: "Your turn", onlineOpponentTurn: "Opponent’s turn", onlineWon: "You won the ranked match!", onlineLost: "The opponent won this match.", onlineDraw: "The match ended in a draw.",
    onlineLoading: "Loading authoritative match state…", moveRejected: "The server rejected that move. The authoritative match state has not changed.", playAnother: "Find another match",
    onlineRules: "How ranked play works", onlineRuleOne: "The server randomly selects an opponent within a suitable rating range.", onlineRuleTwo: "Moves, turn order, wins, XP and rating are verified server-side.",
    onlineRuleThree: "Practice against the bot never changes ranked XP or rating.", onlineRuleFour: "No entry fees or prize payouts are enabled here.",
    onlineGameEnabled: "Tic Tac Toe is the only online ranked mode implemented in this iteration.", matchIdLabel: "Match",
    signIn: "Sign in", signUp: "Create account", signOut: "Sign out", resetPassword: "Reset password", forgotPassword: "Forgot password?", backToSignIn: "Back to sign in",
    email: "Email address", password: "Password", displayName: "Display name", continueWithGoogle: "Continue with Google", authUnavailable: "Account services are not connected yet. Configure the Supabase project URL and publishable key, then enable Google OAuth and email redirects.",
    authFailure: "We couldn’t complete that request. Check your details or try again.", checkInbox: "Check your inbox for a confirmation link to finish creating your account.", resetSent: "If an account exists for this email, password reset instructions have been sent.",
    passwordHint: "Use at least 12 characters.", accountRequired: "Sign in to sync favorites and access your personal account.", signInSuccess: "You’re signed in.", signOutSuccess: "You’ve signed out.", favoriteFailed: "Favorites could not be saved. Try again.", loading: "Loading…", balanceUnavailable: "Balance unavailable", member: "Member", authTitle: "Welcome to Playora", authSubtitle: "Sign in to keep your profile and progress with you.", setNewPassword: "Set new password", passwordUpdated: "Your password has been updated.", createAccountPrompt: "New to Playora?", existingAccountPrompt: "Already have an account?", securityLiveNote: "Your session is managed by Supabase Auth. Private records are scoped through database row-level security.", accountDangerTitle: "Danger zone", accountDangerBody: "Permanently delete your Playora account and its profile data. This cannot be undone.", deleteAccountNotEnabled: "Account deletion becomes available after the secure server endpoint is configured and enabled.", deleteAccount: "Delete account", deleteAccountConfirm: "Confirm account deletion", deleteAccountInstruction: "This permanently removes your account. Any active matches are cancelled without rewards.", deleteAccountWarning: "Enter DELETE to confirm. For safety, sign in again if your current session is older than 10 minutes.", deleteAccountBusy: "Deleting account…", deleteAccountSuccess: "Your account has been deleted.", deleteAccountFailed: "Account deletion could not be completed. Sign in again and retry, or contact support.", typeDelete: "Type DELETE", profileXp: "Experience", recentMatches: "Recent ranked matches", noRecentMatches: "No completed ranked matches yet.", editProfile: "Edit profile", saveProfile: "Save changes", profileUpdated: "Profile updated.", profileUpdateFailed: "Profile could not be updated. Please try again.", cancel: "Cancel", resultWin: "Win", resultLoss: "Loss", resultDraw: "Draw", resultCompleted: "Completed", practiceTitle: "Practice vs Bot", practiceNoRewards: "Practice only — this match awards no XP, rank, coins, or prizes.", yourTurn: "Your turn · X", botThinking: "Bot turn · O", youWin: "You win!", botWins: "The bot wins this round.", draw: "It’s a draw.", restartGame: "Play again", closeGame: "Close game", gameBoard: "Tic Tac Toe board", cell: "Cell", checkersPracticeTitle: "Checkers · Practice vs Bot", checkersRulesNote: "American checkers: captures are compulsory, multi-jumps continue the same turn, and crowning ends the turn. Draw after 80 consecutive plies without a capture. No rewards.", checkersYourTurn: "Your turn · Red", checkersBotTurn: "Playora Bot is thinking · Black", checkersContinueCapture: "Continue the capture sequence", checkersHumanWon: "You won the checkers game!", checkersBotWon: "Playora Bot won this game.", checkersDraw: "Draw · 80 quiet plies", checkersSquare: "Square", checkersRedPiece: "Red piece", checkersBlackPiece: "Black piece", checkersKing: "King", checkersBoardLabel: "Checkers board"
  },
  fa: {
    navHome: "خانه", navGames: "بازی‌ها", navOnline: "میدان یک‌به‌یک", navTournaments: "تورنومنت‌ها", navFriends: "دوستان", navRooms: "اتاق‌های خصوصی", navRank: "جدول برترین‌ها", navWallet: "کیف پول", navProfile: "پروفایل", navSettings: "تنظیمات",
    search: "جست‌وجوی بازی و حالت‌ها", coins: "سکه‌های پلیورا", demo: "حالت پیش‌نمایش",
    eyebrow: "حرکت بعدی با توست", heroTitle: "مهارت تو.", heroTitle2: "پیروزی تو.", heroBody: "حریف بعدی‌ات را پیدا کن، بازی محبوبت را یاد بگیر و هر حرکت را مهم کن.", findGame: "کشف بازی‌ها", viewTournaments: "دیدن تورنومنت‌ها", liveLabel: "شبکه جهانی بازی", notLive: "پیش‌نمایش رابط · بازی آنلاین متصل نیست",
    quickAccess: "دسترسی سریع", allGames: "همه بازی‌ها", seeAll: "مشاهده همه", popular: "بازی‌های محبوب", popularSub: "چالش بعدی‌ات را انتخاب کن",
    weekly: "قهرمانی هفتگی", weeklyText: "میدانی تازه و جدول امتیاز جدید.", upTo: "جایزه آزمایشی", joinNow: "دیدن رویداد", featured: "رویداد ویژه", eventStatus: "به‌زودی",
    categoryAll: "همه بازی‌ها", categoryStrategy: "استراتژی", categoryBoard: "رومیزی", categoryCards: "بازی‌های کارتی", categoryPuzzle: "فکری",
    gamesTitle: "بازی خودت را پیدا کن", gamesSub: "مجموعه‌ای رو به رشد برای ذهن‌های تیز و رقیب‌های دوستانه.", favorites: "دلخواه‌ها", emptySearch: "بازی‌ای پیدا نشد", clearSearch: "پاک‌کردن جست‌وجو",
    soon: "به‌زودی", details: "جزئیات", previewNote: "موتور بازی و سیستم پیدا کردن حریف هنوز متصل نیست.",
    rankTitle: "جدول برترین‌ها", rankSub: "فقط نتایج تأییدشده دوز رتبه‌دار. تمرین و بازی خصوصی در رتبه‌بندی اثر ندارند.", friendsTitle: "دوستانت را پیدا کن", friendsSub: "بازیکن‌ها را با نام کاربری پیدا کن، درخواست‌ها را بپذیر و دوستانت را مدیریت کن. جست‌وجوی ایمیل وجود ندارد.", roomsTitle: "اتاق‌های خصوصی", roomsSub: "اتاق بساز و با یک کد یک‌بارمصرف دوستت را دعوت کن. مسابقه خصوصی روی XP، رتبه، سکه یا جایزه اثری ندارد.", friendSearchTitle: "پیداکردن بازیکن", friendSearchBody: "نام کاربری دقیق نمایش‌داده‌شده در پروفایل را وارد کن.", friendUsername: "نام کاربری بازیکن", sendRequest: "ارسال درخواست", incomingRequests: "درخواست‌های دریافتی", outgoingRequests: "درخواست‌های ارسالی", yourFriends: "دوستان تو", blockedPeople: "مسدودشده‌ها", noIncomingRequests: "درخواست در انتظار نداری.", noOutgoingRequests: "درخواست ارسالی نداری.", noFriendsYet: "هنوز دوستی نداری. برای ارسال درخواست نام کاربری را بالا وارد کن.", noBlockedPeople: "بازیکنی را مسدود نکرده‌ای.", requestIncoming: "دریافتی", requestOutgoing: "در انتظار", friendStatus: "دوست", blockedStatus: "مسدود", acceptRequest: "پذیرفتن", declineRequest: "ردکردن", blockRequest: "مسدودکردن", requestSent: "درخواست دوستی ارسال شد.", incomingRequestExists: "این بازیکن قبلاً برایت درخواست فرستاده است؛ درخواست‌های دریافتی را بررسی کن.", requestAccepted: "درخواست پذیرفته شد.", requestDeclined: "درخواست رد شد.", requestBlocked: "درخواست مسدود شد.", alreadyFriends: "شما از قبل دوست هستید.", memberNotFound: "این نام کاربری پیدا نشد.", usernameInvalid: "نام کاربری معتبر وارد کن (۳ تا ۲۴ حرف، عدد یا زیرخط).", socialRateLimit: "تعداد درخواست‌ها زیاد است. کمی صبر کن و دوباره تلاش کن.", socialError: "درخواست اجتماعی انجام نشد. دوباره تلاش کن.", leaderboardEmpty: "هنوز مسابقه رتبه‌دار تأییدشده‌ای ثبت نشده. یک مسابقه آنلاین رتبه‌دار کامل کن تا اینجا نمایش داده شوی.", leaderboardLoading: "در حال بارگذاری رتبه‌بندی تأییدشده…", leaderboardError: "جدول رتبه‌بندی موقتاً در دسترس نیست.", leaderboardRefresh: "به‌روزرسانی", leaderboardRank: "رتبه", leaderboardRating: "امتیاز", leaderboardXp: "XP", leaderboardMatches: "مسابقه", leaderboardWins: "برد", leaderboardHint: "فقط مسابقه‌های آنلاین دوز که سرور تأیید کرده محاسبه می‌شوند. تمرین و اتاق خصوصی بر XP، رتبه یا جایگاه اثر ندارند.",
    tournamentsTitle: "وارد میدان شو", tournamentsSub: "رابط تورنومنت‌ها را بررسی کن. ورودیه و جایزه در این پیش‌نمایش غیرفعال‌اند.",
    walletTitle: "کیف پول تو", walletSub: "موجودی فقط نمایشی است. از این صفحه پول یا رمزارز ارسال نمی‌شود.", balance: "موجودی نمایشی", deposit: "شارژ", history: "تاریخچه تراکنش", cryptoTitle: "شارژ رمزارزی", cryptoText: "آدرس کیف پول و بررسی زنجیره‌ای تنظیم نشده‌اند. به این پیش‌نمایش دارایی ارسال نکن.", notConnected: "متصل نیست",
    profileTitle: "پروفایل بازیکن", profileSub: "این اطلاعات نمونهٔ رابط است، نه یک حساب واردشده.", settingsTitle: "ترجیحات", settingsSub: "زبان را انتخاب و معماری امنیت را بررسی کن.", language: "زبان", english: "English", persian: "فارسی",
    security: "حریم خصوصی از ابتدا", securityText: "اطلاعات خصوصی حساب باید در سمت سرور با شناسه کاربر احراز هویت‌شده و امنیت سطح ردیف پایگاه داده جدا شود. ورود واقعی هنوز متصل نیست.",
    secureNote: "کلیدهای محرمانه را در کد مرورگر قرار نده. بررسی سمت رابط جایگزین مجوزدهی سمت سرور نیست.", about: "درباره پلیورا", help: "راهنما و پشتیبانی", profileMenu: "بازکردن پروفایل", notifications: "اعلان‌ها", noAlerts: "اعلان جدیدی نداری.", account: "پیش‌نمایش مهمان", online: "رقابت آنلاین", privateRooms: "اتاق خصوصی", refresh: "تازه‌سازی", you: "تو", strategy: "استراتژی", board: "رومیزی", cards: "کارتی", puzzle: "فکری",
    gameNotReady: "این بازی هنوز قابل اجرا نیست. کارت صرفاً پیش‌نمایش طراحی است.", privateRoomOnlyGame: "در حال حاضر اتاق خصوصی فقط از بازی دوز پشتیبانی می‌کند.", createPrivateRoom: "ساخت اتاق رایگان", joinPrivateRoom: "ورود با کد دعوت", inviteCode: "کد دعوت", inviteCreated: "اتاق ساخته شد. کد را کپی کن و برای دوستت بفرست.", copyInvite: "کپی کد", codeCopied: "کد دعوت کپی شد.", codeCopyFailed: "کپی انجام نشد. کد را دستی انتخاب و کپی کن.", enterInviteCode: "کد دعوت ۳۲ نویسه‌ای را وارد کن", roomList: "اتاق‌های تو", noPrivateRooms: "هنوز اتاق خصوصی نداری. یک اتاق بساز و دوستت را دعوت کن.", roomCreated: "اتاق ساخته شد", roomOpen: "در انتظار دوست", roomActive: "مسابقه آماده است", roomClosed: "بسته‌شده", roomExpired: "منقضی‌شده", hostLabel: "میزبان", playerLabel: "بازیکن", expiresLabel: "انقضا", openPrivateMatch: "ورود به مسابقه", leavePrivateRoom: "ترک اتاق", closePrivateRoom: "بستن اتاق", privateMatchTitle: "مسابقه خصوصی", privateNoRewards: "بازی خصوصی رایگان است و سکه، XP، رتبه یا جایزه نمی‌دهد.", privateYourTurn: "نوبت تو", privateOpponentTurn: "نوبت دوستت", privateWin: "تو مسابقه خصوصی را بردی.", privateLoss: "دوستت مسابقه خصوصی را برد.", privateWaiting: "در انتظار ورود بازیکن دیگر…", privateRoomError: "اتاق باز نشد. کد دعوت را بررسی و دوباره تلاش کن.", privateMatchError: "درخواست مسابقه خصوصی انجام نشد. صفحه را تازه‌سازی و دوباره تلاش کن.", noPrivateMatch: "این اتاق هنوز مسابقه‌ای را آغاز نکرده است.", roomExpiredHint: "کد دعوت پس از ۲۴ ساعت منقضی می‌شود.", settingsSaved: "ترجیح در این پیش‌نمایش تغییر کرد.", walletToast: "تا زمان پیکربندی backend امن، شارژ غیرفعال است.", nav: "ناوبری اصلی",
    statMatches: "بازی‌ها", statWins: "بردها", statRating: "رتبه", footer: "هرجا بازی کن. هدفمند رقابت کن.", rights: "نسخه پیش‌نمایش · سرویس زنده نیست", matchMade: "مسابقه‌یابی مبتنی بر مهارت", safePlay: "با توجه به حریم خصوصی ساخته شده",
    matchType: "مسابقه یک‌به‌یک", findRival: "پیداکردن حریف", randomPairing: "تطبیق با حریف تصادفی", balanced: "تطبیق متناسب با مهارت", noGameYet: "بازی در این نسخه فعال نیست.",
    eventOne: "قهرمانان شطرنج", eventTwo: "استادان بیلیارد", eventThree: "لیگ منچ", eventPlayers: "بازیکن", eventTime: "شروع به‌زودی", explore: "بررسی", mode: "حالت بازی",
    demoCoins: "۲٬۴۵۰", sampleProfile: "OrbitRider", level: "سطح", points: "XP", noMoney: "بدون قابلیت پول واقعی",
    practiceAvailable: "تمرینی", onlineTitle: "پیداکردن حریف", onlineSub: "مسابقه رتبه‌دار با بازیکنی تصادفی را شروع کن. در این نسخه ورودیه یا جایزه مالی فعال نیست.",
    rankedTtt: "دوز · رقابت رتبه‌دار یک‌به‌یک", rankedTttDetails: "نوبت‌ها در سرور بررسی می‌شوند، حریف تصادفی با توجه به مهارت انتخاب می‌شود و رتبه پس از نتیجه معتبر تغییر می‌کند.",
    queueButton: "پیداکردن حریف تصادفی", cancelQueue: "لغو جست‌وجو", queueIdle: "هر وقت آماده بودی شروع کن", queueing: "در حال ورود به صف…", queueWaiting: "در حال جست‌وجوی مسابقه متعادل…", queueMatched: "حریف پیدا شد",
    onlineError: "سرویس بازی آنلاین نتوانست درخواست را کامل کند. تنظیمات backend را بررسی و دوباره تلاش کن.", onlineNeedsLogin: "برای ورود به رقابت رتبه‌دار وارد حساب شو. مسابقه و رتبه به حساب احراز هویت‌شده تو متصل می‌شوند.",
    onlineNoRewards: "XP و رتبه فقط پس از نتیجه معتبر رقابت به‌روزرسانی می‌شوند. در این نسخه ورودیه یا جایزه با ارزش مالی وجود ندارد.", yourMark: "تو", opponentMark: "حریف تصادفی",
    onlineYourTurn: "نوبت تو", onlineOpponentTurn: "نوبت حریف", onlineWon: "تو مسابقه رتبه‌دار را بردی!", onlineLost: "حریف این مسابقه را برد.", onlineDraw: "مسابقه مساوی شد.",
    onlineLoading: "در حال دریافت وضعیت معتبر مسابقه…", moveRejected: "سرور این حرکت را رد کرد و وضعیت معتبر مسابقه تغییر نکرد.", playAnother: "پیداکردن مسابقه دیگر",
    onlineRules: "قوانین رقابت رتبه‌دار", onlineRuleOne: "حریف‌ها را سرور به‌صورت تصادفی و با توجه به محدوده رتبه انتخاب می‌کند.", onlineRuleTwo: "حرکت، نوبت، برد، XP و رتبه در سرور بررسی می‌شوند.",
    onlineRuleThree: "تمرین با ربات هیچ تغییری در XP یا رتبه رقابتی ایجاد نمی‌کند.", onlineRuleFour: "در این نسخه ورودیه یا پرداخت جایزه فعال نیست.",
    onlineGameEnabled: "در این مرحله فقط دوز آنلاین رتبه‌دار پیاده‌سازی شده است.", matchIdLabel: "مسابقه",
    signIn: "ورود", signUp: "ساخت حساب", signOut: "خروج از حساب", resetPassword: "بازنشانی رمز عبور", forgotPassword: "رمزت را فراموش کرده‌ای؟", backToSignIn: "بازگشت به ورود",
    email: "نشانی ایمیل", password: "رمز عبور", displayName: "نام نمایشی", continueWithGoogle: "ادامه با گوگل", authUnavailable: "سرویس حساب هنوز متصل نیست. آدرس پروژه و کلید عمومی Supabase را تنظیم کن و ورود گوگل و مسیرهای تأیید ایمیل را فعال کن.",
    authFailure: "درخواست انجام نشد. اطلاعات را بررسی کن یا دوباره تلاش کن.", checkInbox: "برای تکمیل ساخت حساب، ایمیل خود را برای پیوند تأیید بررسی کن.", resetSent: "اگر حسابی با این ایمیل وجود داشته باشد، دستور بازنشانی رمز ارسال شده است.",
    passwordHint: "حداقل ۱۲ نویسه استفاده کن.", accountRequired: "برای همگام‌سازی دلخواه‌ها و دسترسی به حساب شخصی وارد شو.", signInSuccess: "با موفقیت وارد شدی.", signOutSuccess: "از حساب خارج شدی.", favoriteFailed: "ذخیره دلخواه‌ها انجام نشد. دوباره تلاش کن.", loading: "در حال بارگذاری…", balanceUnavailable: "موجودی در دسترس نیست", member: "عضو", authTitle: "به پلیورا خوش آمدی", authSubtitle: "وارد شو تا پروفایل و پیشرفتت همراهت بماند.", setNewPassword: "تنظیم رمز جدید", passwordUpdated: "رمز عبور با موفقیت تغییر کرد.", createAccountPrompt: "تازه به پلیورا آمده‌ای؟", existingAccountPrompt: "از قبل حساب داری؟", securityLiveNote: "نشست ورود با Supabase Auth مدیریت می‌شود. اطلاعات خصوصی با امنیت سطح ردیف پایگاه داده جدا می‌شوند.", accountDangerTitle: "بخش خطرناک", accountDangerBody: "حساب پلیورا و اطلاعات پروفایل تو برای همیشه حذف می‌شود. این کار قابل بازگشت نیست.", deleteAccountNotEnabled: "پس از پیکربندی و فعال‌سازی امن سرویس سمت سرور، امکان حذف حساب فعال می‌شود.", deleteAccount: "حذف حساب", deleteAccountConfirm: "تأیید حذف حساب", deleteAccountInstruction: "این عملیات حساب را برای همیشه حذف می‌کند. مسابقه‌های فعال بدون جایزه لغو می‌شوند.", deleteAccountWarning: "برای تأیید DELETE را وارد کن. برای امنیت، اگر بیش از ۱۰ دقیقه از ورودت گذشته، دوباره وارد حساب شو.", deleteAccountBusy: "در حال حذف حساب…", deleteAccountSuccess: "حساب تو حذف شد.", deleteAccountFailed: "حذف حساب انجام نشد. دوباره وارد شو و تلاش کن یا با پشتیبانی تماس بگیر.", typeDelete: "عبارت DELETE را وارد کن", profileXp: "تجربه", recentMatches: "مسابقه‌های رتبه‌دار اخیر", noRecentMatches: "هنوز مسابقه رتبه‌دار تکمیل‌شده‌ای نداری.", editProfile: "ویرایش پروفایل", saveProfile: "ذخیره تغییرات", profileUpdated: "پروفایل به‌روزرسانی شد.", profileUpdateFailed: "به‌روزرسانی پروفایل انجام نشد. دوباره تلاش کن.", cancel: "انصراف", resultWin: "برد", resultLoss: "باخت", resultDraw: "مساوی", resultCompleted: "تکمیل‌شده", practiceTitle: "تمرین با ربات", practiceNoRewards: "فقط تمرین — این بازی XP، رتبه، سکه یا جایزه نمی‌دهد.", yourTurn: "نوبت تو · X", botThinking: "نوبت ربات · O", youWin: "تو برنده شدی!", botWins: "ربات این دور را برد.", draw: "بازی مساوی شد.", restartGame: "بازی دوباره", closeGame: "بستن بازی", gameBoard: "صفحه دوز", cell: "خانه", checkersPracticeTitle: "چکرز · تمرین با ربات", checkersRulesNote: "قواعد چکرز آمریکایی: گرفتن مهره اجباری است، پرش‌های زنجیره‌ای در همان نوبت ادامه می‌یابند و شاه‌شدن نوبت را تمام می‌کند. پس از ۸۰ نیم‌نوبت بدون گرفتن مهره، بازی مساوی است. جایزه‌ای ندارد.", checkersYourTurn: "نوبت تو · قرمز", checkersBotTurn: "ربات پلیورا در حال فکر کردن است · سیاه", checkersContinueCapture: "دنبالهٔ گرفتن مهره را کامل کن", checkersHumanWon: "تو بازی چکرز را بردی!", checkersBotWon: "ربات پلیورا این بازی را برد.", checkersDraw: "مساوی · ۸۰ نیم‌نوبت بدون گرفتن مهره", checkersSquare: "خانه", checkersRedPiece: "مهره قرمز", checkersBlackPiece: "مهره سیاه", checkersKing: "شاه", checkersBoardLabel: "صفحه چکرز"
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

function CopyIcon() {
  return <span className="copy-icon" aria-hidden="true">▢</span>;
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
            <span className={"game-status " + (game.id === "tictactoe" ? "status-practice" : "")}><span />{t(game.id === "tictactoe" ? "practiceAvailable" : "soon")}</span>
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
  const [memberWallet, setMemberWallet] = useState<MemberWallet | null>(null);
  const [memberStats, setMemberStats] = useState<MemberGameStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<RankedHistoryRow[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [ticTacToeState, setTicTacToeState] = useState<TicTacToeState | null>(null);
  const [checkersState, setCheckersState] = useState<CheckersState | null>(null);
  const [selectedCheckersFrom, setSelectedCheckersFrom] = useState<number | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<"idle" | "queueing" | "waiting" | "matched" | "error">("idle");
  const [onlineError, setOnlineError] = useState("");
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineMatchId, setOnlineMatchId] = useState<string | null>(null);
  const [onlineMatch, setOnlineMatch] = useState<OnlineMatchSnapshot | null>(null);
  const [onlineSeat, setOnlineSeat] = useState<number | null>(null);
  const [onlineMoveBusy, setOnlineMoveBusy] = useState(false);
  const [privateRooms, setPrivateRooms] = useState<PrivateRoomRow[]>([]);
  const [privateRoomBusy, setPrivateRoomBusy] = useState(false);
  const [privateRoomCode, setPrivateRoomCode] = useState("");
  const [latestInviteCode, setLatestInviteCode] = useState("");
  const [privateRoomError, setPrivateRoomError] = useState("");
  const [privateMatchId, setPrivateMatchId] = useState<string | null>(null);
  const [privateMatch, setPrivateMatch] = useState<OnlineMatchSnapshot | null>(null);
  const [privateSeat, setPrivateSeat] = useState<number | null>(null);
  const [privateMoveBusy, setPrivateMoveBusy] = useState(false);
  const [privateRoomRefresh, setPrivateRoomRefresh] = useState(0);
  const [socialRows, setSocialRows] = useState<SocialRelationship[]>([]);
  const [socialQuery, setSocialQuery] = useState("");
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialError, setSocialError] = useState("");
  const [socialRefresh, setSocialRefresh] = useState(0);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardEntry[]>([]);
  const [leaderboardBusy, setLeaderboardBusy] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const activeUserIdRef = useRef<string | null>(null);

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
    let authEventVersion = 0;

    const clearMemberScopedUi = (nextUserId: string | null, previousUserId: string | null) => {
      setMemberProfile(null);
      setProfileNameDraft("");
      setProfileSaveBusy(false);
      setProfileMessage("");
      setMemberWallet(null);
      setMemberStats(null);
      setRecentMatches([]);
      setFavorites(nextUserId ? [] : ["chess", "pool"]);
      setFavoritesOnly(false);

      setOnlineStatus("idle");
      setOnlineError("");
      setOnlineBusy(false);
      setOnlineMatchId(null);
      setOnlineMatch(null);
      setOnlineSeat(null);
      setOnlineMoveBusy(false);

      setPrivateRooms([]);
      setPrivateRoomBusy(false);
      setPrivateRoomCode("");
      setLatestInviteCode("");
      setPrivateRoomError("");
      setPrivateMatchId(null);
      setPrivateMatch(null);
      setPrivateSeat(null);
      setPrivateMoveBusy(false);

      setSocialRows([]);
      setSocialQuery("");
      setSocialBusy(false);
      setSocialError("");
      setLeaderboardRows([]);
      setLeaderboardBusy(false);
      setLeaderboardError("");

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
    if (!db || !session?.user.id) {
      setMemberProfile(null);
      setProfileNameDraft("");
      setProfileMessage("");
      setMemberWallet(null);
      setMemberStats(null);
      setRecentMatches([]);
      setFavorites(["chess", "pool"]);
      return;
    }
    setMemberProfile(null);
    setMemberWallet(null);
    setMemberStats(null);
    setRecentMatches([]);
    setFavorites([]);
    let active = true;
    const userId = session.user.id;
    // The authenticated client and RLS jointly enforce ownership. userId comes from the verified session.
    void Promise.all([
      db.from("member_profiles")
        .select("user_id, username, display_name, avatar_key, locale, created_at")
        .eq("user_id", userId).maybeSingle(),
      db.from("coin_wallets")
        .select("user_id, free_coins, purchased_coins, reward_coins, updated_at")
        .eq("user_id", userId).maybeSingle(),
      db.from("member_favorites").select("game_id").eq("user_id", userId),
      db.from("member_preferences").select("locale").eq("user_id", userId).maybeSingle(),
      db.from("member_game_stats").select("user_id,game_id,xp,competitive_rating,matches_played,wins,losses,draws,updated_at").eq("user_id", userId).eq("game_id", "tictactoe").maybeSingle(),
      db.from("matches").select("id,status,finished_at,created_at,mode").eq("game_id", "tictactoe").eq("mode", "ranked").eq("status", "completed").order("finished_at", { ascending: false }).limit(5)
    ]).then(async ([profileResult, walletResult, favoriteResult, preferencesResult, statsResult, historyResult]) => {
      if (!active) return;
      const loadedProfile = !profileResult.error ? profileResult.data as MemberProfile | null : null;
      setMemberProfile(loadedProfile);
      setProfileNameDraft(loadedProfile?.display_name ?? "");
      setMemberWallet(!walletResult.error ? walletResult.data as MemberWallet | null : null);
      setMemberStats(!statsResult.error ? statsResult.data as MemberGameStats | null : null);
      const historyIds = !historyResult.error && historyResult.data ? historyResult.data.map(row => row.id) : [];
      let ownResults = new Map<string, RankedHistoryRow["my_result"]>();
      let historyAccessFailed = false;
      if (historyIds.length > 0) {
        const ownHistoryResult = await db.from("match_participants")
          .select("match_id,final_result")
          .eq("user_id", userId)
          .in("match_id", historyIds);
        historyAccessFailed = Boolean(ownHistoryResult.error);
        if (!ownHistoryResult.error && ownHistoryResult.data) {
          ownResults = new Map(ownHistoryResult.data.map(row => [row.match_id, row.final_result as RankedHistoryRow["my_result"]]));
        }
      }
      if (!active || activeUserIdRef.current !== userId) return;
      setRecentMatches(!historyResult.error && !historyAccessFailed && historyResult.data
        ? (historyResult.data as Omit<RankedHistoryRow, "my_result">[]).map(row => ({ ...row, my_result: ownResults.get(row.id) ?? null })).filter(row => row.my_result !== null) as RankedHistoryRow[]
        : []);
      if (!favoriteResult.error && favoriteResult.data) {
        setFavorites(favoriteResult.data.map(row => row.game_id));
      } else {
        setFavorites([]);
      }
      const savedLocale = !preferencesResult.error ? preferencesResult.data?.locale : null;
      const profileLocale = !profileResult.error ? profileResult.data?.locale : null;
      if (savedLocale === "en" || savedLocale === "fa") setLocale(savedLocale);
      else if (profileLocale === "en" || profileLocale === "fa") setLocale(profileLocale);
    }).catch(() => {
      if (active && activeUserIdRef.current === userId) {
        setMemberProfile(null);
        setMemberWallet(null);
        setMemberStats(null);
        setRecentMatches([]);
      }
    });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (activeGame?.id !== "checkers" || !checkersState || checkersState.status !== "playing" || checkersState.currentPlayer !== "black") return;
    const timer = window.setTimeout(() => {
      setCheckersState(current => {
        if (!current || current.status !== "playing" || current.currentPlayer !== "black") return current;
        const move = chooseCheckersBotMove(current);
        if (!move) return { ...current, status: "won", winner: "red", forcedFrom: null };
        return applyCheckersMove(current, move.from, move.to);
      });
      setSelectedCheckersFrom(null);
    }, 360);
    return () => window.clearTimeout(timer);
  }, [activeGame?.id, checkersState]);

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
    const db = supabase;
    if (!db || !session?.user.id || page !== "online" || onlineStatus !== "waiting") return;
    let stopped = false;
    let timer: number | undefined;
    const userId = session.user.id;
    const pollQueue = async () => {
      try {
        const { data, error } = await db
          .from("matchmaking_queue")
          .select("status, match_id")
          .eq("user_id", userId)
          .eq("game_id", "tictactoe")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (stopped || activeUserIdRef.current !== userId) return;
        if (error) throw error;
        if (data?.status === "matched" && data.match_id) {
          setOnlineMatchId(data.match_id);
          setOnlineStatus("matched");
          return;
        }
        if (data?.status === "expired" || data?.status === "cancelled") {
          setOnlineStatus("idle");
          setOnlineError(t("onlineError"));
          return;
        }
        timer = window.setTimeout(() => void pollQueue(), 1400);
      } catch {
        if (!stopped && activeUserIdRef.current === userId) {
          setOnlineStatus("error");
          setOnlineError(t("onlineError"));
        }
      }
    };
    void pollQueue();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [page, onlineStatus, session?.user.id]);

  useEffect(() => {
    const db = supabase;
    if (!db || !session?.user.id || page !== "online" || !onlineMatchId) return;
    let stopped = false;
    let timer: number | undefined;
    const userId = session.user.id;
    const pollMatch = async () => {
      try {
        const [matchResult, seatResult] = await Promise.all([
          db.from("matches")
            .select("id, status, server_state, state_version")
            .eq("id", onlineMatchId).maybeSingle(),
          db.from("match_participants")
            .select("seat, final_result")
            .eq("match_id", onlineMatchId)
            .eq("user_id", userId)
            .maybeSingle()
        ]);
        if (stopped || activeUserIdRef.current !== userId) return;
        if (matchResult.error || seatResult.error || !matchResult.data || !seatResult.data) throw new Error("match_unavailable");
        const rawMatch = matchResult.data as unknown as OnlineMatchSnapshot;
        if (!Array.isArray(rawMatch.server_state?.board) || rawMatch.server_state.board.length !== 9 ||
            !Number.isInteger(rawMatch.server_state.current_seat) ||
            (rawMatch.server_state.current_mark !== "X" && rawMatch.server_state.current_mark !== "O")) {
          throw new Error("invalid_match_state");
        }
        setOnlineMatch({ ...rawMatch, my_result: seatResult.data.final_result as OnlineMatchSnapshot["my_result"] });
        setOnlineSeat(Number(seatResult.data.seat));
        if (rawMatch.status === "active") {
          timer = window.setTimeout(() => void pollMatch(), 1200);
        }
      } catch {
        if (!stopped && activeUserIdRef.current === userId) {
          setOnlineError(t("onlineError"));
          setOnlineStatus("error");
        }
      }
    };
    void pollMatch();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [page, session?.user.id, onlineMatchId]);

  useEffect(() => {
    const db = supabase;
    if (!db || !session?.user.id || page !== "rooms") {
      if (page !== "rooms" || !session) setPrivateRooms([]);
      return;
    }
    let stopped = false;
    let timer: number | undefined;
    const userId = session.user.id;
    const refreshRooms = async () => {
      try {
        const { data, error } = await db
          .from("private_rooms")
          .select("id,game_id,status,max_players,expires_at,created_at,match_id")
          .order("created_at", { ascending: false })
          .limit(30);
        if (stopped || activeUserIdRef.current !== userId) return;
        if (error) throw error;
        const visibleRooms = data ?? [];
        const roomIds = visibleRooms.map(room => room.id);
        let ownRoles = new Map<string, "host" | "player">();
        if (roomIds.length > 0) {
          const { data: membershipRows, error: membershipError } = await db
            .from("room_members")
            .select("room_id,role")
            .eq("user_id", userId)
            .in("room_id", roomIds);
          if (stopped || activeUserIdRef.current !== userId) return;
          if (membershipError) throw membershipError;
          ownRoles = new Map((membershipRows ?? []).map(row => [row.room_id, row.role as "host" | "player"]));
        }
        const privateRoomRows = visibleRooms.flatMap(room => {
          const myRole = ownRoles.get(room.id);
          return myRole ? [{ ...room, my_role: myRole }] : [];
        });
        setPrivateRooms(privateRoomRows as PrivateRoomRow[]);
        setPrivateRoomError("");
        timer = window.setTimeout(() => void refreshRooms(), 3500);
      } catch {
        if (!stopped && activeUserIdRef.current === userId) {
          setPrivateRooms([]);
          setPrivateRoomError(t("privateRoomError"));
          timer = window.setTimeout(() => void refreshRooms(), 5000);
        }
      }
    };
    void refreshRooms();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [page, session?.user.id, privateRoomRefresh]);

  useEffect(() => {
    const db = supabase;
    if (!db || !session?.user.id || page !== "rooms" || !privateMatchId) {
      if (!privateMatchId || !session) {
        setPrivateMatch(null);
        setPrivateSeat(null);
      }
      return;
    }
    let stopped = false;
    let timer: number | undefined;
    const userId = session.user.id;
    const pollPrivateMatch = async () => {
      try {
        const [matchResult, seatResult] = await Promise.all([
          db.from("matches")
            .select("id,status,server_state,state_version")
            .eq("id", privateMatchId).maybeSingle(),
          db.from("match_participants")
            .select("seat,final_result")
            .eq("match_id", privateMatchId)
            .eq("user_id", userId)
            .maybeSingle()
        ]);
        if (stopped || activeUserIdRef.current !== userId) return;
        if (matchResult.error || seatResult.error || !matchResult.data || !seatResult.data) {
          throw new Error("private_match_unavailable");
        }
        const rawMatch = matchResult.data as unknown as OnlineMatchSnapshot;
        if (!Array.isArray(rawMatch.server_state?.board) || rawMatch.server_state.board.length !== 9 ||
            !Number.isInteger(rawMatch.server_state.current_seat) ||
            (rawMatch.server_state.current_mark !== "X" && rawMatch.server_state.current_mark !== "O")) {
          throw new Error("invalid_private_match_state");
        }
        setPrivateMatch({ ...rawMatch, my_result: seatResult.data.final_result as OnlineMatchSnapshot["my_result"] });
        setPrivateSeat(Number(seatResult.data.seat));
        setPrivateRoomError("");
        if (rawMatch.status === "active") {
          timer = window.setTimeout(() => void pollPrivateMatch(), 1100);
        } else {
          setPrivateRoomRefresh(value => value + 1);
        }
      } catch {
        if (!stopped && activeUserIdRef.current === userId) {
          setPrivateRoomError(t("privateMatchError"));
          timer = window.setTimeout(() => void pollPrivateMatch(), 2500);
        }
      }
    };
    void pollPrivateMatch();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [page, session?.user.id, privateMatchId]);

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
    const db = supabase;
    if (!db || !session?.user.id || page !== "leaderboard") {
      setLeaderboardRows([]);
      setLeaderboardError("");
      setLeaderboardBusy(false);
      return;
    }
    let stopped = false;
    let timer: number | undefined;
    const refreshLeaderboard = async () => {
      try {
        const { data, error } = await db.rpc("get_game_leaderboard", {
          p_game_id: "tictactoe",
          p_limit: 25
        });
        if (stopped || activeUserIdRef.current !== session.user.id) return;
        if (error) throw error;
        setLeaderboardRows((data ?? []) as unknown as LeaderboardEntry[]);
        setLeaderboardError("");
        setLeaderboardBusy(false);
        timer = window.setTimeout(() => void refreshLeaderboard(), 15000);
      } catch {
        if (!stopped && activeUserIdRef.current === session.user.id) {
          setLeaderboardRows([]);
          setLeaderboardError(copy[locale].leaderboardError);
          setLeaderboardBusy(false);
          timer = window.setTimeout(() => void refreshLeaderboard(), 15000);
        }
      }
    };
    setLeaderboardBusy(true);
    void refreshLeaderboard();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [page, session?.user.id, leaderboardRefresh, locale]);

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
      setMemberStats(null);
      setRecentMatches([]);
      setFavorites(["chess", "pool"]);
      setPrivateRooms([]);
      setPrivateMatchId(null);
      setPrivateMatch(null);
      setPrivateSeat(null);
      setOnlineMatchId(null);
      setOnlineMatch(null);
      setOnlineSeat(null);
      setSocialRows([]);
      setLeaderboardRows([]);
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
      setMemberStats(null);
      setRecentMatches([]);
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
      setCheckersState(null);
      setSelectedCheckersFrom(null);
      setActiveGame(game);
      setMobileNavOpen(false);
      return;
    }
    if (game.id === "checkers") {
      setToast("");
      setCheckersState(createCheckersState());
      setSelectedCheckersFrom(null);
      setTicTacToeState(null);
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
  const restartCheckers = () => {
    setCheckersState(createCheckersState());
    setSelectedCheckersFrom(null);
  };
  const closePracticeGame = () => {
    setActiveGame(null);
    setTicTacToeState(null);
    setCheckersState(null);
    setSelectedCheckersFrom(null);
  };
  const makeCheckersMove = (index: number) => {
    const current = checkersState;
    if (!current || current.status !== "playing" || current.currentPlayer !== "red") return;
    const legalMoves = getCheckersLegalMoves(current);
    const selectedMove = selectedCheckersFrom === null ? undefined :
      legalMoves.find(move => move.from === selectedCheckersFrom && move.to === index);
    if (selectedMove) {
      const nextState = applyCheckersMove(current, selectedMove.from, selectedMove.to);
      setCheckersState(nextState);
      setSelectedCheckersFrom(nextState.forcedFrom);
      return;
    }
    const piece = current.board[index];
    if (piece?.player === "red" && legalMoves.some(move => move.from === index)) {
      setSelectedCheckersFrom(index);
      return;
    }
    setSelectedCheckersFrom(current.forcedFrom);
  };
  const legalCheckersMoves = checkersState ? getCheckersLegalMoves(checkersState) : [];
  const selectedCheckersDestinations = new Set(
    legalCheckersMoves.filter(move => move.from === selectedCheckersFrom).map(move => move.to)
  );
  const checkersStatus = !checkersState ? "" :
    checkersState.status === "won" ? (checkersState.winner === "red" ? t("checkersHumanWon") : t("checkersBotWon")) :
    checkersState.status === "draw" ? t("checkersDraw") :
    checkersState.forcedFrom !== null ? t("checkersContinueCapture") :
    checkersState.currentPlayer === "red" ? t("checkersYourTurn") : t("checkersBotTurn");
  const ticTacToeStatus = !ticTacToeState ? "" :
    ticTacToeState.status === "won" ? (ticTacToeState.winner === "X" ? t("youWin") : t("botWins")) :
    ticTacToeState.status === "draw" ? t("draw") :
    ticTacToeState.currentPlayer === "X" ? t("yourTurn") : t("botThinking");

  const startOnlineQueue = async () => {
    if (!supabase || !session?.user.id) {
      openAuth("signin");
      return;
    }
    const userId = session.user.id;
    setOnlineError("");
    setOnlineBusy(true);
    setOnlineStatus("queueing");
    setOnlineMatchId(null);
    setOnlineMatch(null);
    setOnlineSeat(null);
    try {
      const { data, error } = await supabase.rpc("queue_for_random_match", { p_game_id: "tictactoe" });
      if (activeUserIdRef.current !== userId) return;
      if (error) throw error;
      const result = (Array.isArray(data) ? data[0] : data) as { queue_status?: string; matched_match_id?: string | null } | null;
      if (result?.queue_status === "matched" && result.matched_match_id) {
        setOnlineMatchId(result.matched_match_id);
        setOnlineStatus("matched");
      } else {
        setOnlineStatus("waiting");
      }
    } catch {
      if (activeUserIdRef.current === userId) {
        setOnlineStatus("error");
        setOnlineError(t("onlineError"));
      }
    } finally {
      if (activeUserIdRef.current === userId) setOnlineBusy(false);
    }
  };

  const cancelOnlineQueue = async () => {
    if (!supabase || !session?.user.id) return;
    const userId = session.user.id;
    setOnlineBusy(true);
    setOnlineError("");
    try {
      const { error } = await supabase.rpc("cancel_random_match_queue", { p_game_id: "tictactoe" });
      if (activeUserIdRef.current !== userId) return;
      if (error) throw error;
      setOnlineStatus("idle");
      setOnlineMatchId(null);
      setOnlineMatch(null);
      setOnlineSeat(null);
    } catch {
      if (activeUserIdRef.current === userId) setOnlineError(t("onlineError"));
    } finally {
      if (activeUserIdRef.current === userId) setOnlineBusy(false);
    }
  };

  const submitOnlineMove = async (index: number) => {
    if (!supabase || !session?.user.id || !onlineMatchId || !onlineMatch || !onlineSeat) return;
    const userId = session.user.id;
    if (onlineMatch.status !== "active" || onlineMatch.server_state.current_seat !== onlineSeat ||
        onlineMatch.server_state.board?.[index] !== null) return;
    setOnlineMoveBusy(true);
    setOnlineError("");
    try {
      const { error } = await supabase.rpc("submit_tictactoe_move", {
        p_match_id: onlineMatchId,
        p_cell_index: index
      });
      if (activeUserIdRef.current !== userId) return;
      if (error) throw error;
    } catch {
      if (activeUserIdRef.current === userId) setOnlineError(t("moveRejected"));
    } finally {
      if (activeUserIdRef.current === userId) setOnlineMoveBusy(false);
    }
  };

  const createPrivateRoom = async () => {
    if (!supabase || !session?.user.id) {
      openAuth("signin");
      return;
    }
    const userId = session.user.id;
    setPrivateRoomBusy(true);
    setPrivateRoomError("");
    try {
      const { data, error } = await supabase.rpc("create_private_room", {
        p_game_id: "tictactoe",
        p_max_players: 2
      });
      if (activeUserIdRef.current !== userId) return;
      if (error) throw error;
      const result = (Array.isArray(data) ? data[0] : data) as {
        created_room_id?: string; invite_code?: string; room_expires_at?: string
      } | null;
      if (!result?.created_room_id || !result.invite_code) throw new Error("invalid_room_response");
      setLatestInviteCode(result.invite_code);
      setPrivateRoomCode("");
      setPrivateRoomRefresh(value => value + 1);
      setToast(t("inviteCreated"));
    } catch {
      if (activeUserIdRef.current === userId) setPrivateRoomError(t("privateRoomError"));
    } finally {
      if (activeUserIdRef.current === userId) setPrivateRoomBusy(false);
    }
  };

  const joinPrivateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !session?.user.id) {
      openAuth("signin");
      return;
    }
    const userId = session.user.id;
    const code = privateRoomCode.trim().toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(code)) {
      setPrivateRoomError(t("privateRoomError"));
      return;
    }
    setPrivateRoomBusy(true);
    setPrivateRoomError("");
    try {
      const { data, error } = await supabase.rpc("join_private_room", { p_invite_code: code });
      if (activeUserIdRef.current !== userId) return;
      if (error) throw error;
      const result = (Array.isArray(data) ? data[0] : data) as {
        joined_room_id?: string; joined_game_id?: string; room_status?: string; active_match_id?: string | null
      } | null;
      if (!result?.joined_room_id) throw new Error("invalid_join_response");
      setPrivateRoomCode("");
      setPrivateRoomRefresh(value => value + 1);
      if (result.active_match_id) {
        setPrivateMatchId(result.active_match_id);
        setPrivateMatch(null);
        setPrivateSeat(null);
      }
    } catch {
      if (activeUserIdRef.current === userId) setPrivateRoomError(t("privateRoomError"));
    } finally {
      if (activeUserIdRef.current === userId) setPrivateRoomBusy(false);
    }
  };

  const leavePrivateRoom = async (room: PrivateRoomRow) => {
    if (!supabase || !session?.user.id) return;
    const userId = session.user.id;
    setPrivateRoomBusy(true);
    setPrivateRoomError("");
    try {
      const { data, error } = await supabase.rpc("leave_private_room", { p_room_id: room.id });
      if (activeUserIdRef.current !== userId) return;
      if (error) throw error;
      if (data !== true) throw new Error("room_not_left");
      if (room.match_id && room.match_id === privateMatchId) {
        setPrivateMatchId(null);
        setPrivateMatch(null);
        setPrivateSeat(null);
      }
      setPrivateRoomRefresh(value => value + 1);
      setToast(room.my_role === "host" ? t("closePrivateRoom") : t("leavePrivateRoom"));
    } catch {
      if (activeUserIdRef.current === userId) setPrivateRoomError(t("privateRoomError"));
    } finally {
      if (activeUserIdRef.current === userId) setPrivateRoomBusy(false);
    }
  };

  const openPrivateMatch = (matchId: string) => {
    setPrivateRoomError("");
    setPrivateMatchId(matchId);
    setPrivateMatch(null);
    setPrivateSeat(null);
  };

  const closePrivateMatchView = () => {
    setPrivateMatchId(null);
    setPrivateMatch(null);
    setPrivateSeat(null);
    setPrivateMoveBusy(false);
    setPrivateRoomError("");
  };

  const submitPrivateMove = async (index: number) => {
    if (!supabase || !session?.user.id || !privateMatchId || !privateMatch || !privateSeat) return;
    const userId = session.user.id;
    if (privateMatch.status !== "active" || privateMatch.server_state.current_seat !== privateSeat ||
        privateMatch.server_state.board?.[index] !== null) return;
    setPrivateMoveBusy(true);
    setPrivateRoomError("");
    try {
      const { error } = await supabase.rpc("submit_private_tictactoe_move", {
        p_match_id: privateMatchId,
        p_cell_index: index
      });
      if (activeUserIdRef.current !== userId) return;
      if (error) throw error;
    } catch {
      if (activeUserIdRef.current === userId) setPrivateRoomError(t("privateMatchError"));
    } finally {
      if (activeUserIdRef.current === userId) setPrivateMoveBusy(false);
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

  const copyInviteCode = async () => {
    if (!latestInviteCode) return;
    try {
      await navigator.clipboard.writeText(latestInviteCode);
      setToast(t("codeCopied"));
    } catch {
      setToast(t("codeCopyFailed"));
    }
  };

  const resetOnlineMatch = () => {
    setOnlineStatus("idle");
    setOnlineError("");
    setOnlineMatchId(null);
    setOnlineMatch(null);
    setOnlineSeat(null);
    setOnlineMoveBusy(false);
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
          <button className="language-switch" onClick={() => changeLocale(locale === "en" ? "fa" : "en")} aria-label={locale === "en" ? "Switch language to Persian" : "Switch language to English"}><Languages size={16} /><span>{locale === "en" ? "EN" : "فا"}</span><ChevronDown size={13} /></button>
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
                {gameList.filter(g => g.featured).map(game => <GameCard key={game.id} game={game} locale={locale} onOpen={openGame} saved={favorites.includes(game.id)} onSave={() => toggleFavorite(game.id)} t={t} />)}
              </div>
            </section>

            <section className="tournament-banner">
              <div className="tournament-trophy"><Trophy size={31} /></div><div className="tournament-copy"><span>{t("featured")}</span><h2>{t("weekly")}</h2><p>{t("weeklyText")}</p></div><div className="tournament-meta"><span><Ticket size={15} />{t("eventStatus")}</span><b>{t("upTo")}</b></div><button className="btn-gradient compact" onClick={() => go("tournaments")}>{t("joinNow")}<ArrowRight size={15} /></button>
            </section>
          </>}

          {page === "games" && <>
            <div className="catalog-toolbar"><div className="category-tabs" role="group" aria-label={t("mode")}>{categories.map(item => <button key={item.id} className={category === item.id ? "selected" : ""} onClick={() => setCategory(item.id)}>{t(item.key)}</button>)}</div><button className={`favorites-filter ${favoritesOnly ? "selected" : ""}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Heart size={15} fill={favoritesOnly ? "currentColor" : "none"} />{t("favorites")}</button></div>
            {filteredGames.length > 0 ? <div className="games-grid catalog-grid">{filteredGames.map(game => <GameCard key={game.id} game={game} locale={locale} onOpen={openGame} saved={favorites.includes(game.id)} onSave={() => toggleFavorite(game.id)} t={t} />)}</div> : <EmptyState icon={Search} title={t("emptySearch")} text={t("clearSearch")} />}
            <div className="preview-disclaimer"><ShieldCheck size={16} /><span>{t("previewNote")}</span></div>
          </>}

          {page === "online" && <section className="online-page">
            <div className="online-feature-card">
              <div className="online-feature-copy">
                <span className="hero-eyebrow"><Swords size={14} />{t("matchType")}</span>
                <h2>{t("rankedTtt")}</h2>
                <p>{t("rankedTttDetails")}</p>
                <div className="online-feature-points">
                  <span><ShieldCheck size={14} />{t("balanced")}</span>
                  <span><Users size={14} />{t("randomPairing")}</span>
                  <span><Medal size={14} />{t("statRating")}</span>
                </div>
                <p className="online-small-note">{t("onlineNoRewards")}</p>
              </div>
              <div className="online-feature-art" aria-hidden="true">
                <div className="online-orbit orbit-a" /><div className="online-orbit orbit-b" />
                <div className="online-versus"><span>X</span><b>VS</b><span>O</span></div>
                <div className="online-game-grid"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
                <span className="online-art-glint">✦</span>
              </div>
            </div>

            <div className="online-content-grid">
              <section className="online-match-panel">
                <div className="online-panel-heading">
                  <div><span className="section-eyebrow">{t("onlineTitle")}</span><h2>{onlineMatchId ? t("queueMatched") : t("queueIdle")}</h2></div>
                  <span className={"online-state-pill state-" + onlineStatus}><i />{onlineStatus === "idle" ? t("queueIdle") : onlineStatus === "queueing" ? t("queueing") : onlineStatus === "waiting" ? t("queueWaiting") : onlineStatus === "matched" ? t("queueMatched") : t("onlineError")}</span>
                </div>

                {!session && <div className="online-login-prompt"><span className="online-large-icon"><LockKeyhole size={24} /></span><h3>{t("signIn")}</h3><p>{t("onlineNeedsLogin")}</p><button className="btn-gradient" onClick={() => openAuth("signin")}><LogIn size={15} />{t("signIn")}</button></div>}

                {session && !onlineMatchId && <div className="online-queue-state">
                  <div className="online-queue-illustration"><div><Swords size={30} /></div><span className="queue-scan scan-one" /><span className="queue-scan scan-two" /></div>
                  <p>{onlineStatus === "queueing" ? t("queueing") : onlineStatus === "waiting" ? t("queueWaiting") : onlineStatus === "error" ? (onlineError || t("onlineError")) : t("queueIdle")}</p>
                  {onlineStatus === "waiting" || onlineStatus === "queueing" ? <button className="btn-ghost" disabled={onlineBusy} onClick={() => void cancelOnlineQueue()}>{onlineBusy ? t("loading") : t("cancelQueue")}<X size={15} /></button> : <button className="btn-gradient" disabled={onlineBusy || authLoading} onClick={() => void startOnlineQueue()}>{onlineBusy ? t("queueing") : t("queueButton")}<ArrowRight size={16} /></button>}
                  <small>{t("onlineGameEnabled")}</small>
                </div>}

                {session && onlineMatchId && !onlineMatch && <div className="online-loading-state"><span className="online-loading-spinner" /><p>{t("onlineLoading")}</p></div>}

                {session && onlineMatchId && onlineMatch && onlineSeat && <div className="online-live-match">
                  <div className="online-player-row">
                    <div className={"online-player " + (onlineSeat === 1 ? "current-player" : "")}><span className="online-player-mark mark-x">X</span><div><b>{t("yourMark")}</b><small>{t("level")} · {t("member")}</small></div></div>
                    <span className="online-vs-label">VS</span>
                    <div className={"online-player " + (onlineSeat === 2 ? "current-player" : "")}><span className="online-player-mark mark-o">O</span><div><b>{t("opponentMark")}</b><small>{t("level")} · {t("statRating")}</small></div></div>
                  </div>
                  <div className="ttt-board online-ttt-board" role="group" aria-label={t("gameBoard")}>
                    {onlineMatch.server_state.board?.map((mark, index) => {
                      const isMyTurn = onlineMatch.status === "active" && onlineMatch.server_state.current_seat === onlineSeat;
                      const disabled = mark !== null || !isMyTurn || onlineMoveBusy;
                      return <button key={index} type="button" className={"tic-cell " + (mark ? "mark-" + mark.toLowerCase() : "")} aria-label={t("cell") + " " + (index + 1) + (mark ? " " + mark : "")} disabled={disabled} onClick={() => void submitOnlineMove(index)}>{mark && <span>{mark}</span>}</button>;
                    })}
                  </div>
                  <div className={"ttt-status " + (onlineMatch.status === "completed" ? "is-complete" : "")} role="status">
                    <span className="ttt-status-pulse" />
                    {onlineMatch.status === "completed"
                      ? (onlineMatch.my_result === "win" ? t("onlineWon") : onlineMatch.my_result === "draw" ? t("onlineDraw") : t("onlineLost"))
                      : onlineMatch.server_state.current_seat === onlineSeat ? t("onlineYourTurn") : t("onlineOpponentTurn")}
                  </div>
                  {onlineError && <p className="online-inline-error" role="alert">{onlineError}</p>}
                  <div className="online-match-footer"><span>{t("matchIdLabel")}: {onlineMatch.id.slice(0, 8).toUpperCase()}</span>{onlineMatch.status === "completed" && <button className="btn-gradient" onClick={resetOnlineMatch}>{t("playAnother")}<ArrowRight size={15} /></button>}</div>
                </div>}
                {session && onlineError && !onlineMatch && onlineStatus === "error" && <p className="online-inline-error" role="alert">{onlineError}</p>}
              </section>

              <aside className="online-rules-panel">
                <div className="online-rules-icon"><ShieldCheck size={19} /></div>
                <h2>{t("onlineRules")}</h2>
                <ul>
                  <li><span>01</span><p>{t("onlineRuleOne")}</p></li>
                  <li><span>02</span><p>{t("onlineRuleTwo")}</p></li>
                  <li><span>03</span><p>{t("onlineRuleThree")}</p></li>
                  <li><span>04</span><p>{t("onlineRuleFour")}</p></li>
                </ul>
                <div className="online-security-foot"><LockKeyhole size={14} />{t("secureNote")}</div>
              </aside>
            </div>
          </section>}

          {page === "rooms" && <section className="private-rooms-page">
            <div className="private-room-hero">
              <div className="private-room-hero-copy">
                <span className="hero-eyebrow"><ShieldCheck size={14} />{t("privateRooms")}</span>
                <h2>{t("roomsTitle")}</h2>
                <p>{t("roomsSub")}</p>
                <div className="private-room-benefits"><span><LockKeyhole size={14} />{t("secureNote")}</span><span><Coins size={14} />{t("privateNoRewards")}</span></div>
              </div>
              <div className="private-room-emblem" aria-hidden="true"><div className="room-emblem-ring"><Users size={34} /></div><span className="room-emblem-dot dot-a" /><span className="room-emblem-dot dot-b" /><span className="room-emblem-dot dot-c" /></div>
            </div>

            {!session && <div className="private-room-login"><div className="private-room-login-icon"><LockKeyhole size={25} /></div><div><h3>{t("signIn")}</h3><p>{t("accountRequired")}</p></div><button className="btn-gradient" onClick={() => openAuth("signin")}><LogIn size={15} />{t("signIn")}</button></div>}

            {session && <>
              <div className="private-room-actions-grid">
                <section className="private-room-action-card">
                  <span className="private-room-action-icon"><Plus size={20} /></span>
                  <div><h3>{t("createPrivateRoom")}</h3><p>{t("inviteCreated")}</p></div>
                  <button className="btn-gradient" disabled={privateRoomBusy} onClick={() => void createPrivateRoom()}>{privateRoomBusy ? t("loading") : t("createPrivateRoom")}<ArrowRight size={15} /></button>
                </section>
                <section className="private-room-action-card">
                  <span className="private-room-action-icon room-join-icon"><Ticket size={20} /></span>
                  <div><h3>{t("joinPrivateRoom")}</h3><p>{t("enterInviteCode")}</p></div>
                  <form className="private-room-join-form" onSubmit={event => void joinPrivateRoom(event)}>
                    <input aria-label={t("inviteCode")} name="inviteCode" type="text" inputMode="text" autoComplete="off" spellCheck={false} maxLength={32} minLength={32} pattern="[0-9a-fA-F]{32}" placeholder="0123456789abcdef…" value={privateRoomCode} onChange={event => setPrivateRoomCode(event.target.value)} required />
                    <button className="btn-ghost" type="submit" disabled={privateRoomBusy || privateRoomCode.trim().length !== 32}>{privateRoomBusy ? t("loading") : t("joinPrivateRoom")}<ArrowRight size={14} /></button>
                  </form>
                </section>
              </div>

              {latestInviteCode && <section className="private-invite-card">
                <div className="private-invite-icon"><Ticket size={19} /></div>
                <div className="private-invite-copy"><b>{t("roomCreated")}</b><p>{t("inviteCreated")}</p><code dir="ltr">{latestInviteCode}</code><small>{t("roomExpiredHint")}</small></div>
                <button className="btn-gradient" onClick={() => void copyInviteCode()}><CopyIcon />{t("copyInvite")}</button>
              </section>}

              {privateRoomError && <p className="private-room-error" role="alert"><ShieldCheck size={15} />{privateRoomError}</p>}

              {privateMatchId && <section className="private-match-panel">
                <div className="private-match-heading"><div><span className="section-eyebrow">{t("privateMatchTitle")}</span><h2>{t("privateNoRewards")}</h2></div><button className="btn-ghost" onClick={closePrivateMatchView}>{t("closeGame")}<X size={14} /></button></div>
                {!privateMatch && <div className="online-loading-state"><span className="online-loading-spinner" /><p>{t("onlineLoading")}</p></div>}
                {privateMatch && privateSeat && <div className="private-match-body">
                  <div className="online-player-row">
                    <div className={"online-player " + (privateSeat === 1 ? "current-player" : "")}><span className="online-player-mark mark-x">X</span><div><b>{t("yourMark")}</b><small>{t("hostLabel")}</small></div></div>
                    <span className="online-vs-label">VS</span>
                    <div className={"online-player " + (privateSeat === 2 ? "current-player" : "")}><span className="online-player-mark mark-o">O</span><div><b>{t("opponentMark")}</b><small>{t("playerLabel")}</small></div></div>
                  </div>
                  <div className="ttt-board online-ttt-board" role="group" aria-label={t("gameBoard")}>
                    {privateMatch.server_state.board?.map((mark,index) => {
                      const isMyTurn = privateMatch.status === "active" && privateMatch.server_state.current_seat === privateSeat;
                      const disabled = mark !== null || !isMyTurn || privateMoveBusy;
                      return <button key={index} type="button" className={"tic-cell " + (mark ? "mark-" + mark.toLowerCase() : "")} aria-label={t("cell") + " " + (index + 1) + (mark ? " " + mark : "")} disabled={disabled} onClick={() => void submitPrivateMove(index)}>{mark && <span>{mark}</span>}</button>;
                    })}
                  </div>
                  <div className={"ttt-status " + (privateMatch.status === "completed" ? "is-complete" : "")} role="status"><span className="ttt-status-pulse" />{privateMatch.status === "completed" ? (privateMatch.my_result === "win" ? t("privateWin") : privateMatch.my_result === "draw" ? t("onlineDraw") : t("privateLoss")) : privateMatch.server_state.current_seat === privateSeat ? t("privateYourTurn") : t("privateOpponentTurn")}</div>
                  {privateRoomError && <p className="private-room-error" role="alert">{privateRoomError}</p>}
                  <div className="online-match-footer"><span>{t("matchIdLabel")}: {privateMatch.id.slice(0,8).toUpperCase()}</span>{privateMatch.status === "completed" && <button className="btn-gradient" onClick={closePrivateMatchView}>{t("roomList")}<ArrowRight size={14} /></button>}</div>
                </div>}
              </section>}

              <section className="private-room-list-section">
                <div className="private-room-list-heading"><div><span className="section-eyebrow">{t("privateRooms")}</span><h2>{t("roomList")}</h2></div><span className="private-room-count">{privateRooms.length}</span></div>
                {privateRooms.length === 0 ? <div className="private-room-empty"><div><Users size={25} /></div><h3>{t("noPrivateRooms")}</h3><p>{t("roomExpiredHint")}</p></div> : <div className="private-room-list">
                  {privateRooms.map(room => {
                    const expired = room.status === "expired" || (room.status === "open" && new Date(room.expires_at).getTime() <= Date.now());
                    const stateKey = expired ? "roomExpired" : room.status === "open" ? "roomOpen" : room.status === "active" ? "roomActive" : "roomClosed";
                    const isHost = room.my_role === "host";
                    return <article className="private-room-row" key={room.id}>
                      <span className="private-room-row-icon"><Grid2X2 size={20} /></span>
                      <div className="private-room-row-copy"><h3>{t("privateMatchTitle")} <code>{room.id.slice(0,8).toUpperCase()}</code></h3><p><span>{isHost ? t("hostLabel") : t("playerLabel")}</span><i />{t("expiresLabel")}: {new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(room.expires_at))}</p></div>
                      <span className={"private-room-status " + (room.status === "active" ? "is-active" : expired ? "is-expired" : "")}><i />{t(stateKey)}</span>
                      <div className="private-room-row-actions">
                        {room.match_id && <button className="btn-outline" onClick={() => openPrivateMatch(room.match_id!)}>{t("openPrivateMatch")}<ArrowRight size={14} /></button>}
                        {room.status === "open" && <button className="btn-ghost" disabled={privateRoomBusy} onClick={() => void leavePrivateRoom(room)}>{isHost ? t("closePrivateRoom") : t("leavePrivateRoom")}<X size={14} /></button>}
                      </div>
                    </article>;
                  })}
                </div>}
              </section>
            </>}
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
              <div className="leaderboard-hero-copy"><span className="section-eyebrow">{t("rankTitle")}</span><h2>{t("rankTitle")}</h2><p>{t("rankSub")}</p></div>
              <span className="leaderboard-game-pill"><Grid2X2 size={14} />Tic Tac Toe</span>
            </div>
            {!session && <div className="social-login-panel"><div className="social-login-icon"><LockKeyhole size={24} /></div><div><h3>{t("signIn")}</h3><p>{t("accountRequired")}</p></div><button className="btn-gradient" onClick={() => openAuth("signin")}><LogIn size={15} />{t("signIn")}</button></div>}
            {session && <>
              <div className="leaderboard-toolbar"><div><b>{t("rankTitle")}</b><span>{t("leaderboardHint")}</span></div><button className="btn-ghost" disabled={leaderboardBusy} onClick={() => setLeaderboardRefresh(value => value + 1)}><Activity size={15} />{leaderboardBusy ? t("loading") : t("leaderboardRefresh")}</button></div>
              {leaderboardError && <p className="private-room-error" role="alert">{leaderboardError}</p>}
              {leaderboardBusy && leaderboardRows.length === 0
                ? <div className="leaderboard-empty"><span className="online-loading-spinner" /><p>{t("leaderboardLoading")}</p></div>
                : leaderboardRows.length === 0
                  ? <div className="leaderboard-empty"><div className="empty-state-icon"><Trophy size={26} /></div><h3>{t("leaderboardEmpty")}</h3><p>{t("leaderboardHint")}</p></div>
                  : <div className="leaderboard-table-wrap">
                    <div className="leaderboard-table-header"><span>{t("leaderboardRank")}</span><span>{t("member")}</span><span>{t("leaderboardRating")}</span><span>{t("leaderboardXp")}</span><span>{t("leaderboardMatches")}</span><span>{t("leaderboardWins")}</span></div>
                    <div className="leaderboard-list">{leaderboardRows.map(entry => {
                      const rank = Number(entry.rank_position);
                      return <article className={"leaderboard-row " + (rank <= 3 ? "is-top" : "")} key={entry.username}>
                        <span className={"leaderboard-rank rank-" + Math.min(rank,3)}>{rank === 1 ? "♛" : rank === 2 ? "Ⅱ" : rank === 3 ? "Ⅲ" : "#" + rank}</span>
                        <div className="leaderboard-player"><span className="leaderboard-avatar">{(entry.display_name || entry.username).charAt(0).toLocaleUpperCase(locale)}</span><div><b>{entry.display_name || entry.username}</b><small>@{entry.username}</small></div></div>
                        <b className="leaderboard-value rating-value">{new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(Number(entry.competitive_rating))}</b>
                        <span className="leaderboard-value">{new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(Number(entry.xp))}</span>
                        <span className="leaderboard-value">{new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(Number(entry.matches_played))}</span>
                        <span className="leaderboard-value">{new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(Number(entry.wins))}</span>
                      </article>;
                    })}</div>
                  </div>}
            </>}
          </section>}

          {page === "wallet" && <section className="wallet-layout"><div className="wallet-balance-card"><span className="wallet-label"><Coins size={16} />{t("balance")}</span><b className="wallet-total">{formattedCoins} <small>{t("coins")}</small></b><span className="wallet-preview-tag"><LockKeyhole size={13} />{t("noMoney")}</span><div className="wallet-actions"><button disabled onClick={() => setToast(t("walletToast"))}><CreditCard size={16} />{t("deposit")}</button><button disabled onClick={() => setToast(t("walletToast"))}><Activity size={16} />{t("history")}</button></div></div><div className="crypto-info-card"><div className="crypto-card-head"><span className="security-icon"><ShieldCheck size={18} /></span><span className="connection-status">{t("notConnected")}</span></div><h2>{t("cryptoTitle")}</h2><p>{t("cryptoText")}</p><div className="crypto-list"><span className="crypto-token usdt">₮</span><div><b>USDT</b><small>Example asset · no deposit address</small></div><span className="crypto-token btc">₿</span><div><b>BTC</b><small>Not configured</small></div></div><button className="btn-disabled" disabled><LockKeyhole size={15} />{t("notConnected")}</button></div></section>}

          {page === "profile" && <section className="profile-layout"><div className="profile-card"><div className="profile-cover"><BrandMark /></div><div className="profile-identity"><span className="profile-avatar-large">{session ? currentName.charAt(0).toLocaleUpperCase(locale) : "O"}</span><div><h2>{session ? currentName : t("sampleProfile")}</h2><p>{session ? (memberProfile?.user_id === session.user.id ? "@" + memberProfile.username : t("loading")) : t("account")}</p></div>{session && <span className="profile-level"><BadgeCheck size={14} />{t("member")}</span>}</div>
              {session && memberProfile?.user_id === session.user.id && <form className="profile-edit-form" onSubmit={event => void saveProfile(event)}>
                <label htmlFor="profile-display-name">{t("displayName")}</label>
                <div className="profile-edit-controls"><input id="profile-display-name" name="profileDisplayName" value={profileNameDraft} onChange={event => setProfileNameDraft(event.target.value)} minLength={1} maxLength={32} required autoComplete="nickname" /><button className="btn-gradient" type="submit" disabled={profileSaveBusy || profileNameDraft.trim() === memberProfile.display_name}>{profileSaveBusy ? t("loading") : t("saveProfile")}<Check size={14} /></button></div>
                {profileMessage && <p className={"profile-edit-message " + (profileMessage === t("profileUpdated") ? "is-success" : "is-error")} role="status">{profileMessage}</p>}
              </form>}<div className="profile-stats">
                <div><b>{session && memberStats ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(memberStats.matches_played) : "—"}</b><span>{t("statMatches")}</span></div>
                <div><b>{session && memberStats ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(memberStats.wins) : "—"}</b><span>{t("statWins")}</span></div>
                <div><b>{session && memberStats ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(memberStats.competitive_rating) : "—"}</b><span>{t("statRating")}</span></div>
                <div><b>{session && memberStats ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(Number(memberStats.xp)) : "—"}</b><span>{t("profileXp")}</span></div>
              </div>
              {session && <section className="profile-history">
                <div className="profile-history-heading"><div><span className="section-eyebrow">{t("online")}</span><h3>{t("recentMatches")}</h3></div><span>{recentMatches.length}</span></div>
                {recentMatches.length === 0 ? <p className="profile-history-empty">{t("noRecentMatches")}</p> : <div className="profile-history-list">
                  {recentMatches.map(match => {
                    const resultKey = match.my_result === "draw" ? "resultDraw" : match.my_result === "win" ? "resultWin" : "resultLoss";
                    return <article className="profile-history-row" key={match.id}>
                      <span className={"profile-result-dot result-" + resultKey.slice(6).toLowerCase()} />
                      <div className="profile-history-copy"><b>{t(resultKey)}</b><small dir="ltr">{match.id.slice(0, 8).toUpperCase()} · {new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", { dateStyle: "medium" }).format(new Date(match.finished_at ?? match.created_at))}</small></div>
                      <span className={"profile-result-label result-" + resultKey.slice(6).toLowerCase()}>{t("resultCompleted")}</span>
                    </article>;
                  })}
                </div>}
              </section>}
              {session ? <div className="profile-auth-footer"><p>{t("securityLiveNote")}</p><button className="btn-outline" onClick={() => void handleSignOut()}><LogIn size={14} />{t("signOut")}</button></div> : <div className="profile-auth-footer"><p>{t("accountRequired")}</p><button className="btn-gradient" onClick={() => openAuth("signin")}><LogIn size={15} />{t("signIn")}</button></div>}</div></section>}

          {page === "settings" && <section className="settings-layout"><div className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Languages size={20} /></div><div><h2>{t("language")}</h2><p>{t("settingsSub")}</p></div></div><div className="language-options"><button className={locale === "en" ? "language-option selected" : "language-option"} onClick={() => changeLocale("en")}><span className="language-flag">EN</span><span><b>{t("english")}</b><small>English · LTR</small></span>{locale === "en" && <Check size={17} />}</button><button className={locale === "fa" ? "language-option selected" : "language-option"} onClick={() => changeLocale("fa")}><span className="language-flag fa-flag">فا</span><span><b>{t("persian")}</b><small>فارسی · RTL</small></span>{locale === "fa" && <Check size={17} />}</button></div></div><div className="settings-card security-card"><div className="settings-card-heading"><div className="settings-icon shield"><ShieldCheck size={20} /></div><div><h2>{t("security")}</h2><p>{t("securityText")}</p></div></div><div className="security-check-row"><LockKeyhole size={16} /><span>{t("secureNote")}</span></div><p className="security-live-note">{session ? t("securityLiveNote") : t("securityText")}</p><button className="text-action" onClick={() => setToast(t("security"))}>{t("about")}<ArrowRight size={15} /></button></div>{session && <div className="settings-card danger-card"><div className="settings-card-heading"><div className="settings-icon danger"><ShieldCheck size={20} /></div><div><h2>{t("accountDangerTitle")}</h2><p>{t("accountDangerBody")}</p></div></div><button className="danger-action" type="button" onClick={() => { setDeleteConfirmation(""); setDeleteMessage(""); setDeleteDialogOpen(true); }} disabled={!supabaseConfigured || !accountDeletionEnabled || deleteBusy}><X size={15} />{t("deleteAccount")}</button>{!accountDeletionEnabled && <p className="danger-unavailable-note">{t("deleteAccountNotEnabled")}</p>}</div>}</section>}

          <footer className="main-footer"><div><BrandMark /><span>{t("footer")}</span></div><span>{t("rights")}</span><button onClick={() => go("settings")}><ShieldCheck size={13} />{t("security")}</button></footer>
        </main>
      </div>
      {toast && <div className="toast-message" role="status"><span className="toast-check"><Check size={15} /></span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}><X size={15} /></button></div>}
      {activeGame?.id === "tictactoe" && ticTacToeState && <div className="game-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closePracticeGame(); }}>
        <section className="game-modal" role="dialog" aria-modal="true" aria-labelledby="ttt-title">
          <div className="game-modal-top">
            <span className="practice-badge"><Dices size={14} />{t("practiceTitle")}</span>
            <button className="auth-close" type="button" aria-label={t("closeGame")} onClick={closePracticeGame}><X size={18} /></button>
          </div>
          <h2 id="ttt-title">{activeGame.title[locale]}</h2>
          <p className="game-practice-note"><ShieldCheck size={15} />{t("practiceNoRewards")}</p>
          <div className="ttt-player-strip"><span className="ttt-player human"><b>X</b><span>{locale === "en" ? "You" : "تو"}</span></span><span className="ttt-vs">VS</span><span className="ttt-player bot"><b>O</b><span>{locale === "en" ? "Playora Bot" : "ربات پلیورا"}</span></span></div>
          <div className="ttt-board" aria-label={t("gameBoard")}>
            {ticTacToeState.board.map((mark, index) => <button key={index} type="button" className={"tic-cell " + (mark ? "mark-" + mark.toLowerCase() : "")} aria-label={t("cell") + " " + (index + 1) + (mark ? " " + mark : "")} disabled={mark !== null || ticTacToeState.status !== "playing" || ticTacToeState.currentPlayer !== "X"} onClick={() => makeTicTacToeMove(index)}>{mark && <span>{mark}</span>}</button>)}
          </div>
          <div className={"ttt-status " + (ticTacToeState.status !== "playing" ? "is-complete" : "")} role="status"><span className="ttt-status-pulse" />{ticTacToeStatus}</div>
          <div className="game-modal-actions"><button type="button" className="btn-ghost" onClick={closePracticeGame}>{t("closeGame")}</button><button type="button" className="btn-gradient" onClick={restartTicTacToe}><Activity size={15} />{t("restartGame")}</button></div>
        </section>
      </div>}
      {activeGame?.id === "checkers" && checkersState && <div className="game-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closePracticeGame(); }}>
        <section className="game-modal checkers-modal" role="dialog" aria-modal="true" aria-labelledby="checkers-title">
          <div className="game-modal-top">
            <span className="practice-badge"><Crown size={14} />{t("checkersPracticeTitle")}</span>
            <button className="auth-close" type="button" aria-label={t("closeGame")} onClick={closePracticeGame}><X size={18} /></button>
          </div>
          <h2 id="checkers-title">{activeGame.title[locale]}</h2>
          <p className="game-practice-note"><ShieldCheck size={15} />{t("practiceNoRewards")}</p>
          <p className="checkers-rules-note">{t("checkersRulesNote")}</p>
          <div className="ttt-player-strip">
            <span className="ttt-player human"><b>R</b><span>{locale === "en" ? "You · Red" : "تو · قرمز"}</span></span>
            <span className="ttt-vs">VS</span>
            <span className="ttt-player bot"><b>B</b><span>{locale === "en" ? "Playora Bot · Black" : "ربات پلیورا · سیاه"}</span></span>
          </div>
          <div className="checkers-board" role="group" aria-label={t("checkersBoardLabel")}>
            {checkersState.board.map((piece, index) => {
              const playable = (Math.floor(index / 8) + (index % 8)) % 2 === 1;
              const selected = selectedCheckersFrom === index;
              const destination = selectedCheckersDestinations.has(index);
              const pieceLabel = piece
                ? ", " + (piece.player === "red" ? t("checkersRedPiece") : t("checkersBlackPiece")) + (piece.king ? ", " + t("checkersKing") : "")
                : "";
              const squareLabel = t("checkersSquare") + " " + (index + 1) + pieceLabel;
              return <button
                key={index}
                type="button"
                className={"checkers-square " + (playable ? "is-playable" : "is-light") +
                  (piece ? " has-" + piece.player : "") +
                  (piece?.king ? " is-king" : "") +
                  (selected ? " is-selected" : "") +
                  (destination ? " is-destination" : "")}
                aria-label={squareLabel}
                aria-pressed={selected}
                disabled={!playable || checkersState.status !== "playing" || checkersState.currentPlayer !== "red"}
                onClick={() => makeCheckersMove(index)}
              >
                {piece && <span className={"checkers-piece " + (piece.king ? "is-king" : "")}>
                  {piece.king ? <Crown size={18} /> : <span className="checkers-piece-dot" />}
                </span>}
                {destination && !piece && <span className="checkers-destination-dot" aria-hidden="true" />}
              </button>;
            })}
          </div>
          <div className={"ttt-status " + (checkersState.status !== "playing" ? "is-complete" : "")} role="status">
            <span className="ttt-status-pulse" />{checkersStatus}
          </div>
          <div className="game-modal-actions">
            <button type="button" className="btn-ghost" onClick={closePracticeGame}>{t("closeGame")}</button>
            <button type="button" className="btn-gradient" onClick={restartCheckers}><Activity size={15} />{t("restartGame")}</button>
          </div>
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
